import { supabase } from './supabase';
import { addDaysToDateStr, displayXP, localDateStr } from './storage';
import type { Translations } from './i18n';
import { loadHomeworkRecords } from './homework-deadlines';
import { paged } from './class-summaries';
import { loadArchiveStates } from './class-hard-words';
import { buildClassDigest, type ClassDigest, type DigestInput } from './class-digest';
import type { Lang } from './student-summary';

// Everything the weekly class digest reads. All of it is already visible to
// the class's teacher; nothing is sent anywhere else.
export async function loadClassDigest(
  classId: string,
  students: { id: string; name: string }[],
  lang: Lang,
  t: Translations,
): Promise<ClassDigest> {
  const ids = students.map(s => s.id);
  const today = localDateStr();
  const now = Date.now();
  const startOf = (ymd: string) => new Date(`${ymd}T00:00:00`).toISOString();
  const weekStart = startOf(addDaysToDateStr(today, -7));
  const reviewCount = (before: string) => supabase.from('class_review_events')
    .select('id', { count: 'exact', head: true }).eq('class_id', classId).lt('created_at', before).then(r => r.count ?? 0);

  const [members, xp, homework, srs, answers, notes, hardRows, auto, progress, reviewsBeforeWeek, reviewsToYesterday] = await Promise.all([
    supabase.from('class_members').select('student_id, joined_at').eq('class_id', classId)
      .then(r => (r.data ?? []) as { student_id: string; joined_at: string | null }[]),
    paged<DigestInput['xp'][number]>((from, to) => supabase.rpc('get_class_xp_by_hour', { p_class_id: classId, p_since: addDaysToDateStr(today, -400) }).range(from, to)),
    loadHomeworkRecords(classId, ids, t),
    paged<DigestInput['srs'][number]>((from, to) => supabase.from('class_srs_states').select('user_id, stage, next_due, last_reviewed')
      .eq('class_id', classId).order('user_id').order('word').range(from, to)),
    paged<DigestInput['answers'][number]>((from, to) => supabase.from('class_review_events').select('user_id, word, knew, created_at')
      .eq('class_id', classId).gte('created_at', startOf(addDaysToDateStr(today, -56))).order('created_at', { ascending: false }).range(from, to)),
    paged<DigestInput['notes'][number]>((from, to) => supabase.from('class_notes').select('student_id, created_at, read_at')
      .eq('class_id', classId).order('created_at', { ascending: false }).range(from, to), 5000),
    paged<{ user_id: string; word: string }>((from, to) => supabase.from('class_hard_words').select('user_id, word')
      .eq('class_id', classId).order('word').range(from, to)),
    supabase.from('class_auto_homework').select('paused, last_status').eq('class_id', classId)
      .then(r => (r.data ?? []) as { paused: boolean; last_status: string | null }[]),
    supabase.rpc('get_class_progress_over_time', { p_class_id: classId, p_days: 21 })
      .then(r => (r.data ?? []) as DigestInput['learnedByDay']),
    reviewCount(weekStart),
    reviewCount(startOf(today)),
  ]);

  const hardBy = new Map<string, string[]>();
  for (const r of hardRows) if (ids.includes(r.user_id)) hardBy.set(r.word, [...(hardBy.get(r.word) ?? []), r.user_id]);
  const archive = await loadArchiveStates(classId, hardBy);
  const joined = new Map(members.map(m => [m.student_id, m.joined_at]));
  const summary = t.studentSummary;

  return buildClassDigest({
    classId, lang, today, now,
    students: students.map(s => {
      const j = joined.get(s.id);
      return { ...s, joinDate: j ? localDateStr(new Date(j)) : null };
    }),
    xp, homework, srs, answers, notes,
    untaughtHardWords: Array.from(hardBy.keys()).filter(w => !archive.has(w)).length,
    archive: Array.from(archive.entries()).map(([word, a]) => ({ word, state: a.state })),
    autoHomework: auto.some(a => !a.paused && a.last_status !== 'done'),
    learnedByDay: progress,
    reviewsBeforeWeek, reviewsToYesterday,
    fmt: {
      activeDays: summary.activeDays,
      xp: n => `+${displayXP(n)} XP`,
      words: t.classXpHistory.wordsCount,
      correct: summary.correctOf,
      thisWeek: summary.thisWeek,
    },
  });
}
