import { SUMMARY_SENTENCES, SUMMARY_WORDS } from './student-summary-sentences';

// Picks the cases that fit one student and turns them into sentences from
// lib/student-summary-sentences.ts. Each sentence is a list of segments; a
// segment with `evidence` is a tappable phrase that shows the facts behind
// it. Pure — callers load the data. Keep in sync with
// lexivo/lib/screens/student_summary.dart.

export type Lang = 'uz' | 'en';

export interface HomeworkTiming {
  homeworkId: string;
  title: string;
  modes: string[];
  dueDate: string;                    // yyyy-mm-dd
  assignedDate: string;               // yyyy-mm-dd
  finishedDate: string | null;        // day the last mode was done; null = not fully done
  missingModes: string[];
  doneModes: Record<string, string>;  // mode -> yyyy-mm-dd it was done
}
export interface SentNote { created_at: string; read_at: string | null; }
export interface HistoryEntry { reason: string; amount: number; created_at: string; }

// E early, L on the last day, K late but done, N past due and not done,
// null = not due yet and not done (not judged).
export type HwStatus = 'E' | 'L' | 'K' | 'N';
export interface HwEvidence {
  homeworkId: string; title: string; modes: string[];
  dueDate: string; finishedDate: string | null; missingModes: string[];
  status: HwStatus | null;
  days: number; // E: days early, K: days late
}
export interface NoteEvidence { sentAt: string; readAt: string | null; practisedAt: string | null; }
export interface DayEvidence { date: string; xp: number; reasons: string[]; }
export interface ReviewEvidence { date: string; words: number; from: string; to: string; }
export type Evidence =
  | { kind: 'homework'; items: HwEvidence[] }
  | { kind: 'timing'; items: HwEvidence[] }
  | { kind: 'reminders'; items: NoteEvidence[] }
  | { kind: 'days'; items: DayEvidence[] }
  | { kind: 'review'; items: ReviewEvidence[] };
export type EvidenceKind = Evidence['kind'];
export interface Segment { text: string; evidence?: Evidence; }
export type SummarySentence = Segment[];

interface Pick {
  code: string;
  vars?: Record<string, string | number>;
  ev?: { homework?: HwEvidence[]; timing?: HwEvidence[]; reminders?: NoteEvidence[]; days?: DayEvidence[]; review?: ReviewEvidence[] };
}

const HOUR = 3600_000;
const localDate = (iso: string | number) => new Date(iso).toLocaleDateString('en-CA');
const dayDiff = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
const addDays = (ymd: string, n: number) => { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + n); return localDate(d.getTime()); };
const fmtShort = (ymd: string) => ymd.slice(8, 10) + '.' + ymd.slice(5, 7);
const fmtLong = (ymd: string) => ymd.split('-').reverse().join('.');

function fill(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

function names(items: { title: string }[], w: Record<string, string>): string {
  const t = Array.from(new Set(items.map(i => i.title)));
  if (t.length === 1) return t[0];
  if (t.length === 2) return `${t[0]} ${w.and} ${t[1]}`;
  return fill(w.andMore, { a: t[0], b: t[1], n: t.length - 2 });
}

const modeList = (modes: string[], w: Record<string, string>) => modes.map(m => w[m] ?? m).join(', ');

// ── Homework ─────────────────────────────────────────────────────────────────

function hwEvidence(r: HomeworkTiming, today: string): HwEvidence {
  const f = r.finishedDate;
  const status: HwStatus | null = f ? (f < r.dueDate ? 'E' : f === r.dueDate ? 'L' : 'K') : (r.dueDate < today ? 'N' : null);
  const days = status === 'E' ? dayDiff(f!, r.dueDate) : status === 'K' ? dayDiff(r.dueDate, f!) : 0;
  return { homeworkId: r.homeworkId, title: r.title, modes: r.modes, dueDate: r.dueDate, finishedDate: f, missingModes: r.missingModes, status, days };
}

// Returns the picks plus the ids they named, so "what they did" doesn't repeat them.
function homeworkPicks(records: HomeworkTiming[], today: string, w: Record<string, string>): { picks: Pick[]; named: Set<string> } {
  const judged = records.map(r => ({ r, e: hwEvidence(r, today) }))
    .filter(x => x.e.status !== null)
    .sort((a, b) => b.e.dueDate.localeCompare(a.e.dueDate))
    .slice(0, 10);
  const all = judged.map(x => x.e);
  const total = all.length;
  if (total === 0) return { picks: [], named: new Set() };
  const by = (s: HwStatus) => all.filter(e => e.status === s);
  const [E, L, K, N] = [by('E'), by('L'), by('K'), by('N')];
  const done = total - N.length;

  if (total < 3) {
    let p: Pick;
    if (N.length > 0 && N.length < total) p = { code: 'hw_few_mixed', vars: { hw: names(all, w) }, ev: { homework: all, timing: N } };
    else if (N.length > 0) {
      p = total === 1
        ? { code: 'hw_few_open', vars: { hw: N[0].title, left: modeList(N[0].missingModes, w) }, ev: { homework: N, timing: N } }
        : { code: 'hw_few_open_many', vars: { hw: names(N, w) }, ev: { homework: N, timing: N } };
    } else if (K.length > 0) {
      const late = K.length !== 1 ? w.aLittleLate : K[0].days === 1 ? w.daysLate1 : fill(w.daysLate, { n: K[0].days });
      p = { code: 'hw_few_late', vars: { hw: names(K, w), late }, ev: { homework: K, timing: K } };
    } else if (total === 1 && E.length === 1) {
      p = { code: 'hw_few_early', vars: { hw: E[0].title, early: E[0].days === 1 ? w.daysEarly1 : fill(w.daysEarly, { n: E[0].days }) }, ev: { homework: E, timing: E } };
    } else p = { code: 'hw_few_on_time', vars: { hw: names(all, w) }, ev: { homework: all, timing: all } };
    return { picks: [p], named: new Set(all.map(e => e.homeworkId)) };
  }

  const ev = (timing: HwEvidence[]) => ({ homework: all, timing });
  let main: Pick;
  if (N.length === total) main = { code: 'hw_none_done', vars: { total }, ev: ev(N) };
  else if (N.length / total >= 0.4) main = { code: 'hw_many_missing', vars: { total, done, missed: N.length }, ev: ev(N) };
  else if (N.length > 0) main = { code: 'hw_some_missing', vars: { total, done, missed: N.length }, ev: ev(N) };
  else if (K.length > 0) {
    const share = K.length / total;
    main = { code: 'hw_late_finishes', vars: { freq: w[share < 0.25 ? 'rarely' : share < 0.6 ? 'sometimes' : 'often'] }, ev: ev(K) };
  } else if (judged.filter(x => x.r.finishedDate === x.r.assignedDate).length / total >= 0.5) main = { code: 'hw_same_day', ev: ev(all) };
  else if (E.length / total >= 0.6) main = { code: 'hw_early', ev: ev(all) };
  else if (L.length / total >= 0.6) main = { code: 'hw_last_day', ev: ev(all) };
  else main = { code: 'hw_on_time', vars: { total }, ev: ev(all) };

  // Trend: last 3 vs the 3 before, scored E3 L2 K1 N0.
  const picks = [main];
  if (total >= 6 && main.code !== 'hw_none_done') {
    const score = (es: HwEvidence[]) => es.reduce((t, e) => t + ({ E: 3, L: 2, K: 1, N: 0 })[e.status!], 0) / es.length;
    const diff = score(all.slice(0, 3)) - score(all.slice(3, 6));
    if (diff >= 1) picks.push({ code: 'hw_improving', ev: { timing: all.slice(0, 6) } });
    else if (diff <= -1) picks.push({ code: 'hw_slipping', ev: { timing: all.slice(0, 6) } });
  }
  return { picks, named: new Set() };
}

// ── Activity: days, review sessions ─────────────────────────────────────────

function dayItems(history: HistoryEntry[], dates: string[]): DayEvidence[] {
  return dates.map(date => {
    const es = history.filter(e => localDate(e.created_at) === date);
    return { date, xp: es.reduce((s, e) => s + e.amount, 0), reasons: Array.from(new Set(es.map(e => e.reason))) };
  });
}

// Review rows less than 30 min apart are one session. Newest first.
function reviewSessions(history: HistoryEntry[]): ReviewEvidence[] {
  const rows = history.filter(e => e.reason === 'SRS Review').sort((a, b) => b.created_at.localeCompare(a.created_at));
  const out: ReviewEvidence[] = [];
  for (const e of rows) {
    const s = out[out.length - 1];
    if (s && Date.parse(s.from) - Date.parse(e.created_at) < 30 * 60_000) { s.words++; s.from = e.created_at; }
    else out.push({ date: localDate(e.created_at), words: 1, from: e.created_at, to: e.created_at });
  }
  return out;
}

function contextPick(history: HistoryEntry[], today: string, joinDate: string | null, w: Record<string, string>): Pick | null {
  const active = Array.from(new Set(history.map(e => localDate(e.created_at)))).sort().reverse(); // newest first
  if (joinDate) {
    const inClass = dayDiff(joinDate, today);
    if (inClass <= 0) {
      return active.includes(today)
        ? { code: 'ctx_joined_today_active', ev: { days: dayItems(history, [today]) } }
        : { code: 'ctx_joined_today' };
    }
    if (inClass < 7) {
      const span = inClass + 1;
      const since = active.filter(d => d >= joinDate);
      const vars = { since: inClass === 1 ? w.sinceYesterday : fill(w.sinceDays, { n: inClass }) };
      const ev = { days: dayItems(history, since) };
      if (since.length === 0) return { code: 'ctx_new_inactive', vars };
      if (since.length >= span) return { code: 'ctx_new_all_active', vars, ev };
      return { code: 'ctx_new_some_active', vars: { ...vars, active: since.length, days: span }, ev };
    }
  }
  if (active.length === 0) return { code: 'ctx_never' };
  const week = active.filter(d => d > addDays(today, -7));
  const ev = { days: dayItems(history, week) };
  if (week.length >= 6) return { code: 'ctx_week_high', vars: { active: week.length }, ev };
  if (week.length >= 3) return { code: 'ctx_week_mid', vars: { active: week.length }, ev };
  if (week.length >= 1) return { code: 'ctx_week_low', vars: { active: week.length, dayWord: week.length === 1 ? w.day1 : w.dayN }, ev };
  return { code: 'ctx_week_none', vars: { last: fmtLong(active[0]) }, ev: { days: dayItems(history, [active[0]]) } };
}

// What they did on their latest active day (within the last 7 days).
function activityPicks(history: HistoryEntry[], records: HomeworkTiming[], named: Set<string>, today: string, dueCount: number, w: Record<string, string>): { picks: Pick[]; cleared: boolean } {
  const days = Array.from(new Set(history.map(e => localDate(e.created_at)))).sort().reverse();
  const last = days[0];
  if (!last || last <= addDays(today, -7)) return { picks: [], cleared: false };
  const when = last === today ? w.today : last === addDays(today, -1) ? w.yesterday : fill(w.onDate, { d: fmtShort(last) });
  const sessions = reviewSessions(history).filter(s => s.date === last);
  const words = sessions.reduce((s, x) => s + x.words, 0);
  const finished = records.filter(r => r.finishedDate === last && !named.has(r.homeworkId)).map(r => hwEvidence(r, today));
  const partial = records.filter(r => !r.finishedDate && !named.has(r.homeworkId) && Object.values(r.doneModes).includes(last)).map(r => hwEvidence(r, today));
  const cleared = last === today && words > 0 && dueCount === 0;

  const picks: Pick[] = [];
  if (cleared) {
    picks.push({ code: 'act_review_cleared', vars: { when, n: words }, ev: { review: sessions } });
    if (finished.length) picks.push({ code: 'act_hw', vars: { when, hw: names(finished, w) }, ev: { homework: finished } });
  } else if (words > 0 && finished.length) {
    picks.push({ code: 'act_review_hw', vars: { when, n: words, hw: names(finished, w) }, ev: { review: sessions, homework: finished } });
  } else if (words > 0) {
    picks.push({ code: 'act_review', vars: { when, n: words }, ev: { review: sessions } });
  } else if (finished.length) {
    picks.push({ code: 'act_hw', vars: { when, hw: names(finished, w) }, ev: { homework: finished } });
  } else if (partial.length) {
    picks.push({ code: 'act_hw_partial', vars: { when, hw: partial[0].title, left: modeList(partial[0].missingModes, w) }, ev: { homework: [partial[0]], timing: [partial[0]] } });
  } else {
    picks.push({ code: 'act_other', vars: { when }, ev: { days: dayItems(history, [last]) } });
  }
  return { picks, cleared };
}

function reviewPick(history: HistoryEntry[], today: string, dueCount: number, overdueCount: number): Pick | null {
  if (dueCount === 0) return null;
  const sessions = reviewSessions(history);
  if (sessions.length === 0) return { code: 'rev_never', vars: { n: dueCount } };
  const since = dayDiff(sessions[0].date, today);
  if (since >= 3) return { code: 'rev_stopped', vars: { days: since, n: dueCount }, ev: { review: sessions.slice(0, 5) } };
  if (overdueCount > 0) return { code: 'rev_overdue', vars: { n: dueCount, m: overdueCount } };
  return { code: 'rev_waiting', vars: { n: dueCount } };
}

// ── Reminders ────────────────────────────────────────────────────────────────
// A teacher message counts only if the student hadn't studied in the 24h
// before it (otherwise they'd have practised anyway). R studied within 24h,
// S within 72h, O read but no practice, U not opened. Under 72h with no
// practice yet = not judged.
function reminderPick(notes: SentNote[], history: HistoryEntry[], now: number, today: string, joinDate: string | null): Pick | null {
  const activity = history.map(e => Date.parse(e.created_at));
  const judged: ('R' | 'S' | 'O' | 'U')[] = [];
  const items: NoteEvidence[] = [];
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
      items.push({ sentAt: note.created_at, readAt: note.read_at, practisedAt: new Date(after).toISOString() });
    } else if (now - sent < 72 * HOUR) continue;
    else {
      judged.push(note.read_at ? 'O' : 'U');
      items.push({ sentAt: note.created_at, readAt: note.read_at, practisedAt: null });
    }
  }
  const ev = { reminders: items };

  if (judged.length === 0) {
    const week = Array.from(new Set(history.map(e => localDate(e.created_at)))).filter(d => d > addDays(today, -7));
    const inClass = joinDate ? dayDiff(joinDate, today) : 0;
    return week.length >= 5 && inClass >= 7 ? { code: 'rem_not_needed', ev: { days: dayItems(history, week) } } : null;
  }
  if (judged.length === 1) {
    const s = judged[0];
    if (s === 'R' || s === 'S') return { code: 'rem_single_responded', vars: { hours: lastHours }, ev };
    return { code: s === 'O' ? 'rem_single_read' : 'rem_single_unread', ev };
  }
  const share = (...ss: string[]) => judged.filter(s => ss.includes(s)).length / judged.length;
  if (share('R') >= 0.6) return { code: 'rem_quick', ev };
  if (share('R', 'S') >= 0.6) return { code: 'rem_slow', ev };
  if (share('O') >= 0.5) return { code: 'rem_read_no_action', ev };
  if (share('U') >= 0.5) return { code: 'rem_unread', ev };
  if (share('R', 'S') >= 0.3) return { code: 'rem_mixed', ev };
  return { code: share('O') >= share('U') ? 'rem_read_no_action' : 'rem_unread', ev };
}

// ── Rendering ────────────────────────────────────────────────────────────────

// Stable per student per day, different across days and cases.
function variantIndex(seed: string, n: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
}

// Splits [[label|key]] markup before filling placeholders, so a homework
// title containing "|" or "]]" can't break the parse.
// English verb endings after {name}: singular for "Student 1", plural for "they".
const AGREE_ONE = { s: 's', es: 'es', has: 'has', hasnt: "hasn't", is: 'is', was: 'was', doesnt: "doesn't" };
const AGREE_THEY = { s: '', es: '', has: 'have', hasnt: "haven't", is: 'are', was: 'were', doesnt: "don't" };

function render(p: Pick, lang: Lang, name: string, seed: string, pronoun: boolean): { sentence: SummarySentence; usesName: boolean } {
  const versions = SUMMARY_SENTENCES[p.code][lang];
  const text = versions[variantIndex(`${seed}:${p.code}`, versions.length)];
  const w = SUMMARY_WORDS[lang];
  const who = pronoun
    ? { name: w.pronoun, nameObj: w.pronounObj, ...AGREE_THEY }
    : { name, nameObj: name, ...AGREE_ONE };
  return { sentence: renderText(text, p, who), usesName: /\{name(Obj)?\}/.test(text) };
}

function renderText(text: string, p: Pick, who: Record<string, string>): SummarySentence {
  const vars: Record<string, string | number> = { ...who, ...p.vars };
  const out: SummarySentence = [];
  const re = /\[\[(.+?)\|(\w+)\]\]/g;
  let at = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > at) out.push({ text: fill(text.slice(at, m.index), vars) });
    const kind = m[2] as EvidenceKind;
    const items = p.ev?.[kind];
    out.push(items && items.length ? { text: fill(m[1], vars), evidence: { kind, items } as Evidence } : { text: fill(m[1], vars) });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: fill(text.slice(at), vars) });
  // Templates may open with a placeholder ("{since} qo'shilganidan beri…").
  if (out[0]) out[0] = { ...out[0], text: out[0].text.charAt(0).toUpperCase() + out[0].text.slice(1) };
  return out;
}

export function buildStudentSummary(input: {
  studentId: string;
  name: string;
  lang: Lang;
  today: string;
  now: number;
  joinDate: string | null; // yyyy-mm-dd
  homework: HomeworkTiming[];
  notes: SentNote[];
  history: HistoryEntry[]; // class XP history (any order)
  dueCount: number;        // words waiting for review now
  overdueCount: number;
}): SummarySentence[] {
  const w = SUMMARY_WORDS[input.lang];
  const hw = homeworkPicks(input.homework, input.today, w);
  const act = activityPicks(input.history, input.homework, hw.named, input.today, input.dueCount, w);
  const picks = [
    contextPick(input.history, input.today, input.joinDate, w),
    ...act.picks,
    act.cleared ? null : reviewPick(input.history, input.today, input.dueCount, input.overdueCount),
    ...hw.picks,
    reminderPick(input.notes, input.history, input.now, input.today, input.joinDate),
  ].filter((p): p is Pick => p !== null);
  if (picks.length === 0) picks.push({ code: 'not_enough_data' });
  const seed = `${input.studentId}:${input.today}`;
  // The paragraph names the student once; later sentences say "u" (Uzbek
  // has no gendered pronoun) or "they" / "them".
  let named = false;
  return picks.map(p => {
    const r = render(p, input.lang, input.name, seed, named);
    named ||= r.usesName;
    return r.sentence;
  });
}
