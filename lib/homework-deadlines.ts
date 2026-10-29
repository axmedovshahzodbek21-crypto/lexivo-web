import { supabase } from './supabase';
import { localDateStr } from './storage';
import { readingPassages } from './reading-data';
import type { Translations } from './i18n';

// One row per (past-due homework × assigned student) that wasn't fully done
// by its due date. Every mode counts (not just Learn, unlike the Smart
// Insights score), and partly-done homework is missed — same rule as the
// student "overdue" push in send-scheduled-push. Computed client-side from
// class_homework + class_homework_progress, which the teacher can already
// read. Keep in sync with lexivo/lib/screens/missed_homework.dart.
export interface MissedHomework {
  homeworkId: string;
  studentId: string;
  title: string;
  dueDate: string;        // yyyy-mm-dd
  missingModes: string[]; // still not done; empty = all done, but late
  lateDays: number;       // days after due the last mode was done (0 if missing)
}

const PAGE = 1000; // PostgREST row cap — a truncated progress list would show done homework as missed

export async function loadMissedHomework(
  classId: string,
  students: { id: string; joinDate: string | null | undefined }[],
  t: Translations,
): Promise<{ items: MissedHomework[]; checked: number }> { // checked = past-due (homework × student) pairs looked at
  if (students.length === 0) return { items: [], checked: 0 };
  const today = localDateStr();
  const { data: hwRows, error } = await supabase
    .from('class_homework')
    .select('id, unit_id, class_unit_id, collection_name, day_number, passage_id, modes, due_date, student_ids, teacher_units(name), class_word_units(name)')
    .eq('class_id', classId)
    .lt('due_date', today);
  if (error) throw error;
  const hws = (hwRows ?? []) as any[];
  if (hws.length === 0) return { items: [], checked: 0 };

  const studentIds = students.map(s => s.id);
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

  const out: MissedHomework[] = [];
  let checked = 0;
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
    for (const s of students) {
      if (assigned && !assigned.includes(s.id)) continue;
      // Due on or before the join day — never had a fair chance (same rule as the insights score).
      if (s.joinDate && due <= s.joinDate) continue;
      checked++;
      const missingModes: string[] = [];
      let lateDays = 0;
      for (const m of modes) {
        const d = doneOn.get(`${h.id}:${s.id}:${m}`);
        if (!d) missingModes.push(m);
        else if (d > due) lateDays = Math.max(lateDays, Math.round((Date.parse(d) - Date.parse(due)) / 86400000));
      }
      if (missingModes.length === 0 && lateDays === 0) continue;
      out.push({ homeworkId: h.id, studentId: s.id, title, dueDate: due, missingModes, lateDays: missingModes.length ? 0 : lateDays });
    }
  }
  return { items: out.sort((a, b) => b.dueDate.localeCompare(a.dueDate)), checked };
}
