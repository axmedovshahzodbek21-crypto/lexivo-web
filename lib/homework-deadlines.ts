import { supabase } from './supabase';
import { localDateStr } from './storage';
import { readingPassages } from './reading-data';
import type { Translations } from './i18n';

// One (homework × assigned student) with a due date: when it was set, when
// it's due, and how far the student got. Feeds both the missed-deadline
// tracker below and the per-student summary (lib/student-summary.ts).
// Computed client-side from class_homework + class_homework_progress, which
// the teacher can already read. Keep in sync with
// lexivo/lib/screens/missed_homework.dart.
export interface HomeworkRecord {
  homeworkId: string;
  studentId: string;
  title: string;
  modes: string[];
  dueDate: string;             // yyyy-mm-dd
  assignedDate: string;        // yyyy-mm-dd
  finishedDate: string | null; // day the last mode was done; null = not fully done
  missingModes: string[];
  doneModes: Record<string, string>; // mode -> yyyy-mm-dd it was done
}

// A past-due homework that wasn't fully done by its due date. Every mode
// counts (not just Learn, unlike the Smart Insights score), and partly-done
// homework is missed — same rule as the student "overdue" push in
// send-scheduled-push.
export interface MissedHomework {
  homeworkId: string;
  studentId: string;
  title: string;
  dueDate: string;        // yyyy-mm-dd
  missingModes: string[]; // still not done; empty = all done, but late
  lateDays: number;       // days after due the last mode was done (0 if missing)
}

const PAGE = 1000; // PostgREST row cap — a truncated progress list would show done homework as missed

export async function loadHomeworkRecords(
  classId: string,
  studentIds: string[],
  t: Translations,
): Promise<HomeworkRecord[]> {
  if (studentIds.length === 0) return [];
  const [{ data: hwRows, error }, { data: members, error: memErr }] = await Promise.all([
    supabase
      .from('class_homework')
      .select('id, unit_id, class_unit_id, collection_name, day_number, passage_id, modes, due_date, created_at, student_ids, teacher_units(name), class_word_units(name)')
      .eq('class_id', classId)
      .not('due_date', 'is', null),
    supabase.from('class_members').select('student_id, joined_at').eq('class_id', classId).in('student_id', studentIds),
  ]);
  if (error) throw error;
  if (memErr) throw memErr;
  const hws = (hwRows ?? []) as any[];
  if (hws.length === 0) return [];
  const joinedAt = new Map(((members ?? []) as { student_id: string; joined_at: string | null }[]).map(m => [m.student_id, m.joined_at]));

  const doneOn = new Map<string, string>(); // `${hw}:${student}:${mode}` -> local yyyy-mm-dd
  for (let from = 0; ; from += PAGE) {
    const { data: prog, error: progErr } = await supabase
      .from('class_homework_progress')
      .select('homework_id, student_id, mode, completed_at')
      .in('homework_id', hws.map(h => h.id))
      .in('student_id', studentIds)
      .order('id')
      .range(from, from + PAGE - 1);
    if (progErr) throw progErr;
    for (const p of prog ?? []) doneOn.set(`${p.homework_id}:${p.student_id}:${p.mode}`, localDateStr(new Date(p.completed_at)));
    if ((prog ?? []).length < PAGE) break;
  }

  const out: HomeworkRecord[] = [];
  for (const h of hws) {
    const due = h.due_date as string;
    const modes = (h.modes ?? []) as string[];
    if (modes.length === 0) continue;
    const title = h.passage_id != null
      ? (readingPassages.find(p => p.id === h.passage_id)?.title ?? t.classesPage.defaultReadingPassageTitle)
      : h.collection_name ? `${h.collection_name} · ${t.classesPage.dayFallback(h.day_number)}`
      : h.class_unit_id ? (h.class_word_units?.name ?? t.classesPage.defaultUnitName)
      : (h.teacher_units?.name ?? t.classesPage.defaultUnitName);
    const assigned = h.student_ids as string[] | null;
    for (const sid of studentIds) {
      if (assigned && !assigned.includes(sid)) continue;
      // Set before the student joined and due by their join day — they never
      // had a fair chance. Homework set after joining always counts.
      const joined = joinedAt.get(sid);
      if (joined && Date.parse(h.created_at) < Date.parse(joined) && due <= localDateStr(new Date(joined))) continue;
      const missingModes: string[] = [];
      const doneModes: Record<string, string> = {};
      let last = '';
      for (const m of modes) {
        const d = doneOn.get(`${h.id}:${sid}:${m}`);
        if (!d) { missingModes.push(m); continue; }
        doneModes[m] = d;
        if (d > last) last = d;
      }
      out.push({
        homeworkId: h.id, studentId: sid, title, modes, dueDate: due,
        assignedDate: localDateStr(new Date(h.created_at)),
        finishedDate: missingModes.length ? null : last,
        missingModes, doneModes,
      });
    }
  }
  return out;
}

// checked = past-due records looked at (lets the UI say "all on time" vs "nothing due yet").
export function missedFromRecords(records: HomeworkRecord[]): { items: MissedHomework[]; checked: number } {
  const today = localDateStr();
  const past = records.filter(r => r.dueDate < today);
  const items: MissedHomework[] = [];
  for (const r of past) {
    if (r.missingModes.length > 0) {
      items.push({ homeworkId: r.homeworkId, studentId: r.studentId, title: r.title, dueDate: r.dueDate, missingModes: r.missingModes, lateDays: 0 });
    } else if (r.finishedDate! > r.dueDate) {
      const lateDays = Math.round((Date.parse(r.finishedDate!) - Date.parse(r.dueDate)) / 86400000);
      items.push({ homeworkId: r.homeworkId, studentId: r.studentId, title: r.title, dueDate: r.dueDate, missingModes: [], lateDays });
    }
  }
  return { items: items.sort((a, b) => b.dueDate.localeCompare(a.dueDate)), checked: past.length };
}

export async function loadMissedHomework(
  classId: string,
  studentIds: string[],
  t: Translations,
): Promise<{ items: MissedHomework[]; checked: number }> {
  return missedFromRecords(await loadHomeworkRecords(classId, studentIds, t));
}
