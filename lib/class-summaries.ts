import { supabase } from './supabase';
import { localDateStr } from './storage';
import type { Translations } from './i18n';
import { loadHomeworkRecords } from './homework-deadlines';
import { buildStudentSummary, type ClassAnswer, type HistoryEntry, type Lang, type SentNote } from './student-summary';

export type StudentSummaryResult = ReturnType<typeof buildStudentSummary>;

// PostgREST returns at most 1000 rows per request — page through.
async function paged<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, max = 30_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

// Whole class's review answers for the last `days` days.
export function loadClassAnswers(classId: string, days = 30): Promise<ClassAnswer[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  return paged<ClassAnswer>((from, to) => supabase.from('class_review_events').select('user_id, knew, created_at')
    .eq('class_id', classId).gte('created_at', since).order('created_at', { ascending: false }).range(from, to));
}

// The per-student summary (lib/student-summary.ts) for every student in a
// class, for the Insights list. Class-wide queries, plus one XP-history RPC
// per student (teachers can't read class_xp_history directly). Review
// answers cover 60 days, so the "500+ reviews" milestone counts those only.
export async function loadClassSummaries(
  classId: string,
  students: { id: string; name: string }[],
  lang: Lang,
  t: Translations,
): Promise<Record<string, StudentSummaryResult>> {
  if (students.length === 0) return {};
  const ids = students.map(s => s.id);
  const [records, notes, srs, answers, members, histories] = await Promise.all([
    loadHomeworkRecords(classId, ids, t),
    paged<SentNote & { student_id: string }>((from, to) => supabase.from('class_notes').select('student_id, created_at, read_at')
      .eq('class_id', classId).order('created_at', { ascending: false }).range(from, to), 5000),
    paged<{ user_id: string; stage: number; next_due: string }>((from, to) => supabase.from('class_srs_states')
      .select('user_id, stage, next_due').eq('class_id', classId).order('user_id').range(from, to)),
    paged<ClassAnswer & { word: string }>((from, to) => supabase.from('class_review_events').select('user_id, word, knew, created_at')
      .eq('class_id', classId).gte('created_at', new Date(Date.now() - 60 * 86400_000).toISOString())
      .order('created_at', { ascending: false }).range(from, to)),
    supabase.from('class_members').select('student_id, joined_at').eq('class_id', classId).then(r => (r.data ?? []) as { student_id: string; joined_at: string | null }[]),
    Promise.all(ids.map(id => supabase.rpc('get_student_xp_history', { p_class_id: classId, p_student_id: id })
      .then(r => [id, (r.data ?? []) as HistoryEntry[]] as const))),
  ]);
  const today = localDateStr();
  const now = Date.now();
  const joined = new Map(members.map(m => [m.student_id, m.joined_at]));
  const history = new Map(histories);
  const classNames = Object.fromEntries(students.map(s => [s.id, s.name]));
  const since30 = new Date(now - 30 * 86400_000).toISOString();
  const classAnswers = answers.filter(a => a.created_at >= since30);

  const out: Record<string, StudentSummaryResult> = {};
  for (const s of students) {
    const mySrs = srs.filter(r => r.user_id === s.id);
    const pending = mySrs.filter(r => r.stage < 5 && r.next_due <= today);
    const joinedAt = joined.get(s.id);
    out[s.id] = buildStudentSummary({
      studentId: s.id, name: s.name, lang, today, now,
      joinDate: joinedAt ? localDateStr(new Date(joinedAt)) : null,
      homework: records.filter(r => r.studentId === s.id),
      notes: notes.filter(n => n.student_id === s.id).slice(0, 20),
      history: history.get(s.id) ?? [],
      dueCount: pending.length,
      overdueCount: pending.filter(r => r.next_due < today).length,
      answers: answers.filter(a => a.user_id === s.id),
      mastered: mySrs.filter(r => r.stage >= 5).length,
      learned: mySrs.length,
      classAnswers, classNames,
    });
  }
  return out;
}
