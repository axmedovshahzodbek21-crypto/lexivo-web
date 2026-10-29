import { SUMMARY_SENTENCES, SUMMARY_FREQ } from './student-summary-sentences';

// Picks the cases that fit one student and turns them into sentences from
// lib/student-summary-sentences.ts. Pure — callers load the data. Keep in
// sync with lexivo/lib/screens/student_summary.dart.

export type Lang = 'uz' | 'en';

export interface HomeworkTiming {
  dueDate: string;             // yyyy-mm-dd
  assignedDate: string;        // yyyy-mm-dd
  finishedDate: string | null; // day the last mode was done; null = not fully done
}

export interface SentNote { created_at: string; read_at: string | null; }

interface Pick { code: string; vars?: Record<string, string | number>; }

const HOUR = 3600_000;

// ── Homework timing ──────────────────────────────────────────────────────────
// Each assignment: E early, L last day, K late but done, N not done (past
// due). Not due yet and not done = not judged. Last 10 judged, newest first.
type HwStatus = 'E' | 'L' | 'K' | 'N';

function homeworkPicks(records: HomeworkTiming[], today: string): Pick[] {
  const judged = records
    .map(r => {
      const s: HwStatus | null = r.finishedDate
        ? (r.finishedDate < r.dueDate ? 'E' : r.finishedDate === r.dueDate ? 'L' : 'K')
        : (r.dueDate < today ? 'N' : null);
      return s ? { ...r, s } : null;
    })
    .filter((r): r is HomeworkTiming & { s: HwStatus } => r !== null)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .slice(0, 10);
  const total = judged.length;
  if (total === 0) return [];
  const count = (s: HwStatus) => judged.filter(r => r.s === s).length;
  const [e, l, k, n] = [count('E'), count('L'), count('K'), count('N')];
  const done = total - n;

  if (total < 3) {
    if (n > 0) return [{ code: 'hw_few_open', vars: { missed: n } }];
    return [{ code: k > 0 ? 'hw_few_late' : 'hw_few_on_time' }];
  }

  let main: Pick;
  if (n === total) main = { code: 'hw_none_done', vars: { total } };
  else if (n / total >= 0.4) main = { code: 'hw_many_missing', vars: { total, done, missed: n } };
  else if (n > 0) main = { code: 'hw_some_missing', vars: { total, done, missed: n } };
  else if (k > 0) {
    const share = k / total;
    main = { code: 'hw_late_finishes', vars: { freq: share < 0.25 ? 'rarely' : share < 0.6 ? 'sometimes' : 'often' } };
  } else if (judged.filter(r => r.finishedDate === r.assignedDate).length / total >= 0.5) main = { code: 'hw_same_day' };
  else if (e / total >= 0.6) main = { code: 'hw_early' };
  else if (l / total >= 0.6) main = { code: 'hw_last_day' };
  else main = { code: 'hw_on_time', vars: { total } };

  // Trend: last 3 vs the 3 before, scored E3 L2 K1 N0.
  const picks = [main];
  if (total >= 6 && main.code !== 'hw_none_done') {
    const score = (rs: { s: HwStatus }[]) => rs.reduce((t, r) => t + ({ E: 3, L: 2, K: 1, N: 0 })[r.s], 0) / rs.length;
    const diff = score(judged.slice(0, 3)) - score(judged.slice(3, 6));
    if (diff >= 1) picks.push({ code: 'hw_improving' });
    else if (diff <= -1) picks.push({ code: 'hw_slipping' });
  }
  return picks;
}

// ── Reaction to reminders ────────────────────────────────────────────────────
// A teacher message counts only if the student hadn't studied in the 24h
// before it (otherwise they'd have practised anyway). R studied within 24h,
// S within 72h, O read but no practice, U not opened. Under 72h with no
// practice yet = not judged.
function reminderPick(notes: SentNote[], activity: number[], now: number, activeDays7: number, daysInClass: number | null): Pick | null {
  const judged: ('R' | 'S' | 'O' | 'U')[] = [];
  let lastHours = 0;
  const sorted = [...notes].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);
  for (const note of sorted) {
    const sent = Date.parse(note.created_at);
    if (activity.some(t => t >= sent - 24 * HOUR && t < sent)) continue;
    const after = activity.filter(t => t > sent).reduce((m, t) => Math.min(m, t), Infinity);
    const hours = (after - sent) / HOUR;
    if (after !== Infinity && hours <= 72) {
      judged.push(hours <= 24 ? 'R' : 'S');
      if (judged.length === 1) lastHours = Math.max(1, Math.ceil(hours));
    } else if (now - sent < 72 * HOUR) continue;
    else judged.push(note.read_at ? 'O' : 'U');
  }

  if (judged.length === 0) {
    return activeDays7 >= 5 && (daysInClass ?? 0) >= 7 ? { code: 'rem_not_needed' } : null;
  }
  if (judged.length === 1) {
    const s = judged[0];
    if (s === 'R' || s === 'S') return { code: 'rem_single_responded', vars: { hours: lastHours } };
    return { code: s === 'O' ? 'rem_single_read' : 'rem_single_unread' };
  }
  const share = (...ss: string[]) => judged.filter(s => ss.includes(s)).length / judged.length;
  if (share('R') >= 0.6) return { code: 'rem_quick' };
  if (share('R', 'S') >= 0.6) return { code: 'rem_slow' };
  if (share('O') >= 0.5) return { code: 'rem_read_no_action' };
  if (share('U') >= 0.5) return { code: 'rem_unread' };
  if (share('R', 'S') >= 0.3) return { code: 'rem_mixed' };
  return { code: share('O') >= share('U') ? 'rem_read_no_action' : 'rem_unread' };
}

// ── Rendering ────────────────────────────────────────────────────────────────

// Stable per student per day, different across days and cases.
function variantIndex(seed: string, n: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
}

function render(p: Pick, lang: Lang, name: string, seed: string): string {
  const versions = SUMMARY_SENTENCES[p.code][lang];
  const text = versions[variantIndex(`${seed}:${p.code}`, versions.length)];
  const vars: Record<string, string | number> = { name, ...p.vars };
  if (typeof vars.freq === 'string') vars.freq = SUMMARY_FREQ[lang][vars.freq];
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

export function buildStudentSummary(input: {
  studentId: string;
  name: string;
  lang: Lang;
  today: string;
  now: number;
  homework: HomeworkTiming[];
  notes: SentNote[];
  activity: number[];   // class activity timestamps (ms)
  activeDays7: number;  // days with class activity in the last 7
  daysInClass: number | null;
}): string[] {
  const picks = [
    ...homeworkPicks(input.homework, input.today),
    reminderPick(input.notes, input.activity, input.now, input.activeDays7, input.daysInClass),
  ].filter((p): p is Pick => p !== null);
  if (picks.length === 0) picks.push({ code: 'not_enough_data' });
  const seed = `${input.studentId}:${input.today}`;
  return picks.map(p => render(p, input.lang, input.name, seed));
}
