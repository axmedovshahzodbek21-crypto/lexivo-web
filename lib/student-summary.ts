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
export interface WeekEvidence { from: string; to: string; xp: number; activeDays: number; } // from/to yyyy-mm-dd; [0] = this week
export interface SessionEvidence { date: string; from: string; to: string; } // from/to ISO
export interface ReviewAnswer { word: string; knew: boolean; created_at: string; } // class_review_events row
export interface AccuracyEvidence { from: string; to: string; right: number; total: number; }
export interface WordEvidence { word: string; right: number; wrong: number; }
export interface ModeEvidence { mode: string; count: number; } // mode: learn | flashcard | quiz | match | read | review
export interface RankEvidence { place: number; name: string; value: number; unit: 'words' | 'pct'; me: boolean; }
export interface ClassAnswer { user_id: string; knew: boolean; created_at: string; } // whole-class class_review_events row
export type Evidence =
  | { kind: 'homework'; items: HwEvidence[] }
  | { kind: 'timing'; items: HwEvidence[] }
  | { kind: 'reminders'; items: NoteEvidence[] }
  | { kind: 'days'; items: DayEvidence[] }
  | { kind: 'review'; items: ReviewEvidence[] }
  | { kind: 'weeks'; items: WeekEvidence[] }
  | { kind: 'sessions'; items: SessionEvidence[] }
  | { kind: 'accuracy'; items: AccuracyEvidence[] }
  | { kind: 'words'; items: WordEvidence[] }
  | { kind: 'modes'; items: ModeEvidence[] }
  | { kind: 'ranking'; items: RankEvidence[] };
export type EvidenceKind = Evidence['kind'];
export interface Segment { text: string; evidence?: Evidence; }
export type SummarySentence = Segment[];

interface Pick {
  code: string;
  vars?: Record<string, string | number>;
  ev?: {
    homework?: HwEvidence[]; timing?: HwEvidence[]; reminders?: NoteEvidence[]; days?: DayEvidence[];
    review?: ReviewEvidence[]; weeks?: WeekEvidence[]; sessions?: SessionEvidence[];
    accuracy?: AccuracyEvidence[]; words?: WordEvidence[]; modes?: ModeEvidence[]; ranking?: RankEvidence[];
  };
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
  return joinList(items.map(i => i.title), w);
}

function joinList(list: string[], w: Record<string, string>): string {
  const t = Array.from(new Set(list));
  if (t.length === 1) return t[0];
  if (t.length === 2) return `${t[0]} ${w.and} ${t[1]}`;
  if (t.length === 3) return `${t[0]}, ${t[1]} ${w.and} ${t[2]}`;
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

// ── This week vs their own usual ────────────────────────────────────────────
// Weeks are rolling 7-day windows ending today; "usual" = average XP of the
// 3 weeks before this one. Only weeks that start on/after the join day (or
// the first activity) count, so a new student isn't compared with empty weeks.
function weekItems(history: HistoryEntry[], today: string, joinDate: string | null): WeekEvidence[] {
  const dates = history.map(e => localDate(e.created_at)).sort();
  const earliest = joinDate ?? dates[0];
  if (!earliest) return [];
  const out: WeekEvidence[] = [];
  for (let k = 0; k < 26; k++) {
    const from = addDays(today, -6 - 7 * k), to = addDays(today, -7 * k);
    if (k > 0 && from < earliest) break;
    const es = history.filter(e => { const d = localDate(e.created_at); return d >= from && d <= to; });
    out.push({ from, to, xp: es.reduce((s, e) => s + e.amount, 0), activeDays: new Set(es.map(e => localDate(e.created_at))).size });
  }
  return out;
}

function trendPick(history: HistoryEntry[], today: string, joinDate: string | null): Pick | null {
  const weeks = weekItems(history, today, joinDate);
  const [cur, ...prev] = weeks;
  if (!cur || prev.length < 2 || cur.xp === 0) return null;
  const ev = { weeks: weeks.slice(0, 4) };
  if (prev[0].xp === 0 && prev.slice(1).some(w => w.xp > 0)) return { code: 'trd_back', ev };
  // "Usual" needs a real baseline: activity in at least 2 of the 3 weeks before.
  if (prev.slice(0, 3).filter(w => w.xp > 0).length < 2) return null;
  const usual = prev.slice(0, 3).reduce((s, w) => s + w.xp, 0) / Math.min(3, prev.length);
  const ratio = cur.xp / usual;
  // XP and active days must agree: one long session isn't a "better week"
  // if there were fewer days than usual (and vice versa).
  const usualDays = Math.round(prev.slice(0, 3).reduce((s, w) => s + w.activeDays, 0) / Math.min(3, prev.length));
  const up = cur.activeDays >= usualDays, down = cur.activeDays <= usualDays;
  if (up && prev.length >= 3 && ratio >= 1.3 && cur.xp > Math.max(...prev.map(w => w.xp))) return { code: 'trd_record', ev };
  if (up && ratio >= 2) return { code: 'trd_up_strong', vars: { pct: Math.round((ratio - 1) * 100) }, ev };
  if (up && ratio >= 1.3) return { code: 'trd_up', vars: { pct: Math.round((ratio - 1) * 100) }, ev };
  if (ratio > 0.7 && ratio < 1.3) return { code: 'trd_steady', ev };
  if (down && ratio <= 0.7 && ratio > 0.3) return { code: 'trd_down', vars: { pct: Math.round((1 - ratio) * 100) }, ev };
  if (down && ratio <= 0.3) return { code: 'trd_down_strong', vars: { pct: Math.round((1 - ratio) * 100) }, ev };
  return null;
}

// ── Streaks ──────────────────────────────────────────────────────────────────
// Skipped in the first week — "every day since joining" already says it.
function streakPick(history: HistoryEntry[], today: string, joinDate: string | null): Pick | null {
  if (joinDate && dayDiff(joinDate, today) < 7) return null;
  const set = new Set(history.map(e => localDate(e.created_at)));
  const dates = Array.from(set).sort();
  if (dates.length === 0) return null;
  // Longest run (oldest → newest).
  let longest: string[] = [], run: string[] = [];
  for (const d of dates) {
    run = run.length && addDays(run[run.length - 1], 1) === d ? [...run, d] : [d];
    if (run.length > longest.length) longest = run;
  }
  // Current run ends today or yesterday.
  const current: string[] = [];
  for (let d = set.has(today) ? today : addDays(today, -1); set.has(d); d = addDays(d, -1)) current.push(d);
  const n = current.length;
  if (n >= 5 && n === longest.length && dates.length > n) return { code: 'str_record', vars: { streak: n }, ev: { days: dayItems(history, current) } };
  if (n >= 7) return { code: 'str_long', vars: { streak: n }, ev: { days: dayItems(history, current) } };
  if (n >= 3) return { code: 'str_mid', vars: { streak: n }, ev: { days: dayItems(history, current) } };
  if (n === 0 && longest.length >= 5) {
    const since = dayDiff(dates[dates.length - 1], today);
    if (since >= 2 && since <= 7) return { code: 'str_broken', vars: { longest: longest.length, days: since }, ev: { days: dayItems(history, [...longest].reverse()) } };
  }
  return null;
}

// ── Study habits (last 30 days) ─────────────────────────────────────────────
// Any class activity rows less than 30 min apart are one session. Newest first.
function sessionItems(history: HistoryEntry[]): SessionEvidence[] {
  const rows = [...history].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const out: SessionEvidence[] = [];
  for (const e of rows) {
    const s = out[out.length - 1];
    if (s && Date.parse(s.from) - Date.parse(e.created_at) < 30 * 60_000) s.from = e.created_at;
    else out.push({ date: localDate(e.created_at), from: e.created_at, to: e.created_at });
  }
  return out;
}

const PERIOD = (h: number) => (h >= 5 && h < 12 ? 'morning' : h < 17 && h >= 12 ? 'afternoon' : h >= 17 && h < 22 ? 'evening' : 'night');

// One habit sentence at most: a fixed hour, else a time of day, else
// weekends, else several sessions a day, else "varied".
function habitPick(history: HistoryEntry[], today: string): Pick | null {
  const sessions = sessionItems(history).filter(s => s.date > addDays(today, -30));
  if (sessions.length < 8) return null;
  const hours = sessions.map(s => new Date(s.from).getHours());
  // Busiest ±1h window; ties go to the hour that itself has the most starts.
  let bestH = 0, best = 0, bestExact = 0;
  for (let h = 0; h < 24; h++) {
    const c = hours.filter(x => x === h || x === (h + 1) % 24 || x === (h + 23) % 24).length;
    const exact = hours.filter(x => x === h).length;
    if (c > best || (c === best && exact > bestExact)) { best = c; bestH = h; bestExact = exact; }
  }
  const ev = (filter: (s: SessionEvidence) => boolean) => ({ sessions: sessions.filter(filter).slice(0, 10) });
  if (best / sessions.length >= 0.6) {
    const near = (s: SessionEvidence) => Math.min(Math.abs(new Date(s.from).getHours() - bestH), 24 - Math.abs(new Date(s.from).getHours() - bestH)) <= 1;
    return { code: 'tim_same_hour', vars: { hour: `${String(bestH).padStart(2, '0')}:00` }, ev: ev(near) };
  }
  for (const p of ['morning', 'afternoon', 'evening', 'night']) {
    if (hours.filter(h => PERIOD(h) === p).length / sessions.length >= 0.6) {
      return { code: `tim_${p}`, ev: ev(s => PERIOD(new Date(s.from).getHours()) === p) };
    }
  }
  const days = Array.from(new Set(sessions.map(s => s.date)));
  const weekend = days.filter(d => [0, 6].includes(new Date(d + 'T00:00:00').getDay()));
  if (days.length >= 6 && weekend.length / days.length >= 0.6) return { code: 'wk_weekend', ev: { days: dayItems(history, weekend) } };
  const perDay = sessions.length / days.length;
  if (days.length >= 5 && perDay >= 2) return { code: 'ses_multi', vars: { x: Math.round(perDay) }, ev: ev(() => true) };
  return { code: 'tim_varied', ev: ev(() => true) };
}

// ── Review quality ───────────────────────────────────────────────────────────
// From class_review_events (one row per graded card). Accuracy needs 20+
// answers in the last 30 days; a trend needs 15+ in each of the last two
// fortnights and a 10-point move. Then the words: still hard (2+ misses in
// 30 days and the latest answer wrong or more misses than hits), else
// recovered (2+ misses in 60 days, last two answers right).
function accuracyItem(answers: ReviewAnswer[], from: string, to: string): AccuracyEvidence {
  const a = answers.filter(x => { const d = localDate(x.created_at); return d >= from && d <= to; });
  return { from, to, right: a.filter(x => x.knew).length, total: a.length };
}
const pctOf = (a: AccuracyEvidence) => Math.round((a.right / a.total) * 100);

function reviewQualityPicks(answers: ReviewAnswer[], today: string, w: Record<string, string>): Pick[] {
  const picks: Pick[] = [];
  const acc30 = accuracyItem(answers, addDays(today, -29), today);
  if (acc30.total >= 20) {
    const recent = accuracyItem(answers, addDays(today, -13), today);
    const prior = accuracyItem(answers, addDays(today, -27), addDays(today, -14));
    const diff = recent.total >= 15 && prior.total >= 15 ? pctOf(recent) - pctOf(prior) : 0;
    if (diff >= 10) picks.push({ code: 'rq_improving', vars: { from: pctOf(prior), to: pctOf(recent) }, ev: { accuracy: [prior, recent] } });
    else if (diff <= -10) picks.push({ code: 'rq_dropping', vars: { from: pctOf(prior), to: pctOf(recent) }, ev: { accuracy: [prior, recent] } });
    else {
      const pct = pctOf(acc30);
      const code = pct >= 90 ? 'rq_strong' : pct >= 75 ? 'rq_good' : pct >= 55 ? 'rq_mixed' : 'rq_hard';
      picks.push({ code, vars: { pct, total: acc30.total }, ev: { accuracy: [acc30] } });
    }
  }
  const byWord = new Map<string, ReviewAnswer[]>(); // oldest first, last 60 days
  for (const a of [...answers].sort((x, y) => x.created_at.localeCompare(y.created_at))) {
    if (localDate(a.created_at) <= addDays(today, -60)) continue;
    const list = byWord.get(a.word) ?? [];
    list.push(a);
    byWord.set(a.word, list);
  }
  const stat = (word: string, list: ReviewAnswer[]): WordEvidence => ({ word, right: list.filter(a => a.knew).length, wrong: list.filter(a => !a.knew).length });
  const from30 = addDays(today, -29);
  const hard: WordEvidence[] = [], recovered: WordEvidence[] = [];
  byWord.forEach((list, word) => {
    const recent = list.filter(a => localDate(a.created_at) >= from30);
    const r = stat(word, recent);
    const last = list[list.length - 1];
    if (r.wrong >= 2 && (!last.knew || r.wrong > r.right)) hard.push(r);
    else if (stat(word, list).wrong >= 2 && list.length >= 2 && list.slice(-2).every(a => a.knew)) recovered.push(stat(word, list));
  });
  hard.sort((a, b) => b.wrong - a.wrong);
  recovered.sort((a, b) => b.wrong - a.wrong);
  if (hard.length) picks.push({ code: 'rq_hard_words', vars: { words: joinList(hard.slice(0, 3).map(x => x.word), w) }, ev: { words: hard.slice(0, 5) } });
  else if (recovered.length) picks.push({ code: 'rq_recovered', vars: { words: joinList(recovered.slice(0, 3).map(x => x.word), w) }, ev: { words: recovered.slice(0, 5) } });
  return picks;
}

// ── Milestones: one sentence at most ────────────────────────────────────────
// A run of on-time homework (only when the homework sentence isn't already
// an "always on time" one), else mastered words (SRS stage 5 — every
// interval done), else total review answers.
const ON_TIME_CODES = ['hw_on_time', 'hw_early', 'hw_last_day', 'hw_same_day', 'hw_few_on_time', 'hw_few_early'];
function milestonePick(records: HomeworkTiming[], hwCodes: string[], today: string, mastered: number, learned: number, reviews: number): Pick | null {
  const judged = records.map(r => hwEvidence(r, today)).filter(e => e.status !== null).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const run: HwEvidence[] = [];
  for (const e of judged) { if (e.status === 'E' || e.status === 'L') run.push(e); else break; }
  if (run.length >= 5 && !hwCodes.some(c => ON_TIME_CODES.includes(c))) return { code: 'mst_hw_streak', vars: { n: run.length }, ev: { timing: run } };
  if (mastered > 100) return { code: 'mst_mastered_big', vars: { n: mastered, learned } };
  if (mastered >= 25) return { code: 'mst_mastered_mid', vars: { n: mastered, learned } };
  if (mastered >= 5) return { code: 'mst_mastered_small', vars: { n: mastered, learned } };
  if (mastered >= 1) return { code: 'mst_mastered_first', vars: { n: mastered } };
  const mark = [2000, 1000, 500, 250, 100].find(m => reviews > m);
  return mark ? { code: 'mst_reviews_total', vars: { n: mark } } : null;
}

// ── Activity preferences: one sentence at most ──────────────────────────────
// A homework mode left undone in 2+ past-due assignments (half or more of
// those that had it, with other modes done), else nearly-only review, else
// mostly new words with little review, else a favourite practice mode
// (counted in days used, not rows — Cards writes a row per word).
const PRACTICE_MODE: Record<string, string> = { Flashcard: 'flashcard', Cards: 'flashcard', Quiz: 'quiz', 'Quiz (perfect)': 'quiz', Match: 'match' };

function preferencePick(history: HistoryEntry[], records: HomeworkTiming[], today: string, w: Record<string, string>): Pick | null {
  const past = records.filter(r => r.dueDate < today && Object.keys(r.doneModes).length > 0);
  const skip: Record<string, { missing: number; total: number }> = {};
  for (const r of past) for (const m of r.modes) {
    const s = (skip[m] ??= { missing: 0, total: 0 });
    s.total++;
    if (r.missingModes.includes(m)) s.missing++;
  }
  const skipped = Object.entries(skip).filter(([, s]) => s.missing >= 2 && s.missing / s.total >= 0.5).sort((a, b) => b[1].missing - a[1].missing)[0];
  if (skipped) {
    const [mode, s] = skipped;
    const ev = past.filter(r => r.missingModes.includes(mode)).map(r => hwEvidence(r, today));
    return { code: 'mode_skips', vars: { mode: w[mode] ?? mode, n: s.missing, m: s.total }, ev: { timing: ev } };
  }
  const rows = history.filter(e => localDate(e.created_at) > addDays(today, -30));
  if (rows.length >= 20) {
    const review = rows.filter(e => e.reason === 'SRS Review').length;
    const learn = rows.filter(e => e.reason === 'Learn' || e.reason === 'learn').length;
    const modes: ModeEvidence[] = [
      { mode: 'review', count: review }, { mode: 'learn', count: learn },
      ...['flashcard', 'quiz', 'match'].map(m => ({ mode: m, count: rows.filter(e => PRACTICE_MODE[e.reason] === m || e.reason === m).length })),
    ].filter(x => x.count > 0);
    if (review / rows.length >= 0.85 && learn === 0) return { code: 'mode_review_only', ev: { modes } };
    if (learn / rows.length >= 0.5 && review / rows.length < 0.15) return { code: 'mode_learn_heavy', ev: { modes } };
  }
  const days: Record<string, Set<string>> = {};
  for (const e of rows) { const m = PRACTICE_MODE[e.reason]; if (m) (days[m] ??= new Set()).add(localDate(e.created_at)); }
  const used = Object.entries(days).map(([mode, s]) => ({ mode, count: s.size })).sort((a, b) => b.count - a.count);
  const total = used.reduce((s, x) => s + x.count, 0);
  if (total >= 5 && used[0].count / total >= 0.6) return { code: 'mode_favourite', vars: { mode: w[used[0].mode] }, ev: { modes: used } };
  return null;
}

// ── Compared with the class: one sentence at most ──────────────────────────
// From the whole class's class_review_events: words reviewed in the last 7
// days, and accuracy over 30 days (students with 20+ answers). Needs 3+
// comparable students. "Top" = place 1–3 in a class of 5+ (or place 1 in
// 3–4); otherwise above / below the median.
function rankItems(values: Map<string, number>, studentId: string, names: Record<string, string>, unit: 'words' | 'pct'): RankEvidence[] {
  const sorted = Array.from(values.entries()).sort((a, b) => b[1] - a[1]);
  const place = (v: number) => 1 + sorted.filter(([, x]) => x > v).length;
  const items = sorted.map(([id, v]) => ({ place: place(v), name: names[id] ?? '—', value: v, unit, me: id === studentId }));
  const top = items.slice(0, 5);
  const me = items.find(x => x.me);
  return me && !top.includes(me) ? [...top, me] : top;
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function classPick(classAnswers: ClassAnswer[], names: Record<string, string>, studentId: string, today: string): Pick | null {
  const from7 = addDays(today, -6), from30 = addDays(today, -29);
  const week = new Map<string, number>(), right = new Map<string, number>(), total = new Map<string, number>();
  for (const a of classAnswers) {
    if (!(a.user_id in names)) continue; // approved members only
    const d = localDate(a.created_at);
    if (d >= from7) week.set(a.user_id, (week.get(a.user_id) ?? 0) + 1);
    if (d >= from30) {
      total.set(a.user_id, (total.get(a.user_id) ?? 0) + 1);
      if (a.knew) right.set(a.user_id, (right.get(a.user_id) ?? 0) + 1);
    }
  }
  const acc = new Map<string, number>();
  total.forEach((t, id) => { if (t >= 20) acc.set(id, Math.round(((right.get(id) ?? 0) / t) * 100)); });
  const isTop = (place: number, n: number) => (n >= 5 && place <= 3) || (n >= 3 && place === 1);

  const myWeek = week.get(studentId) ?? 0;
  const weekOk = week.size >= 3 && myWeek > 0;
  const weekPlace = 1 + Array.from(week.values()).filter(v => v > myWeek).length;
  const myAcc = acc.get(studentId);
  const accOk = acc.size >= 3 && myAcc !== undefined;
  const accPlace = myAcc === undefined ? 0 : 1 + Array.from(acc.values()).filter(v => v > myAcc).length;
  const weekEv = () => ({ ranking: rankItems(week, studentId, names, 'words') });
  const accEv = () => ({ ranking: rankItems(acc, studentId, names, 'pct') });

  if (weekOk && isTop(weekPlace, week.size)) return { code: 'cls_review_top', vars: { rank: weekPlace, total: week.size }, ev: weekEv() };
  if (accOk && isTop(accPlace, acc.size)) return { code: 'cls_accuracy_top', vars: { rank: accPlace, total: acc.size, pct: myAcc! }, ev: accEv() };
  const weekMed = weekOk ? median(Array.from(week.values())) : 0;
  const accMed = accOk ? Math.round(median(Array.from(acc.values()))) : 0;
  if (weekOk && myWeek >= 1.25 * weekMed) return { code: 'cls_review_above', ev: weekEv() };
  if (accOk && myAcc! >= accMed + 10) return { code: 'cls_accuracy_above', vars: { pct: myAcc!, avg: accMed }, ev: accEv() };
  if (weekOk && myWeek <= 0.5 * weekMed) return { code: 'cls_review_below', ev: weekEv() };
  if (accOk && myAcc! <= accMed - 15) return { code: 'cls_accuracy_below', vars: { pct: myAcc!, avg: accMed }, ev: accEv() };
  return null;
}

// ── Closing suggestion: one next step for the biggest issue ─────────────────
// First match wins: unfinished past-due homework, a week without activity,
// stalled review, hard words, a skipped mode, a slow week, a new student,
// something worth praising, nothing left to do.
const PRAISE = ['ctx_week_high', 'ctx_new_all_active', 'str_record', 'str_long', 'trd_up', 'trd_up_strong', 'trd_record',
  'rq_strong', 'rq_improving', 'cls_review_top', 'cls_accuracy_top', 'mst_hw_streak'];

function suggestionPick(picks: Pick[], records: HomeworkTiming[], history: HistoryEntry[], today: string, joinDate: string | null, dueCount: number): Pick | null {
  const has = (...codes: string[]) => picks.some(p => codes.includes(p.code));
  const open = records.filter(r => !r.finishedDate && r.dueDate < today).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  if (open.length) return { code: 'sug_overdue_hw', vars: { hw: open[0].title }, ev: { homework: [hwEvidence(open[0], today)] } };
  const activeWeek = history.some(e => localDate(e.created_at) > addDays(today, -7));
  const newStudent = joinDate !== null && dayDiff(joinDate, today) < 7;
  if (!activeWeek && history.length > 0 && !newStudent) return { code: 'sug_inactive' };
  if (has('rev_stopped', 'rev_never') && dueCount > 0) return { code: 'sug_review_restart', vars: { n: dueCount } };
  if (has('rq_hard', 'rq_dropping', 'cls_accuracy_below')) return { code: 'sug_hard' };
  const skip = picks.find(p => p.code === 'mode_skips');
  if (skip) return { code: 'sug_skipped_mode', vars: { mode: skip.vars!.mode } };
  if (has('ctx_week_low', 'trd_down', 'trd_down_strong', 'cls_review_below')) return { code: 'sug_low_activity' };
  if (newStudent) return { code: 'sug_new_student' };
  if (has(...PRAISE)) return { code: 'sug_praise' };
  const pending = records.some(r => !r.finishedDate && r.dueDate >= today);
  if (dueCount === 0 && !pending && activeWeek) return { code: 'sug_new_unit' };
  return null;
}

// Which sentences stay visible when there are many: the rest go behind
// "Batafsil". Lower = more important.
function importance(code: string): number {
  if (code.startsWith('ctx_') || code === 'not_enough_data') return 1;
  if (code === 'hw_improving' || code === 'hw_slipping') return 14;
  if (code.startsWith('hw_')) return 2;
  if (code === 'rq_hard_words') return 3;
  const order = ['rq_', 'rev_', 'act_', 'trd_', 'cls_', 'mode_', 'str_', 'rem_', 'mst_'];
  const i = order.findIndex(p => code.startsWith(p));
  return i >= 0 ? 4 + i : 13; // habits (tim_/wk_/ses_) = 13
}
const VISIBLE = 6;

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
  answers: ReviewAnswer[]; // class_review_events, newest first is fine
  mastered: number;        // class_srs_states at stage 5
  learned: number;         // class_srs_states rows
  classAnswers: ClassAnswer[];        // whole class, last 30 days
  classNames: Record<string, string>; // approved members: id -> name
}): { main: SummarySentence[]; more: SummarySentence[] } {
  const w = SUMMARY_WORDS[input.lang];
  const hw = homeworkPicks(input.homework, input.today, w);
  const act = activityPicks(input.history, input.homework, hw.named, input.today, input.dueCount, w);
  const activeWeek = input.history.some(e => localDate(e.created_at) > addDays(input.today, -7));
  const onlySkips = (p: Pick | null) => (p?.code === 'mode_skips' ? p : null);
  const pref = preferencePick(input.history, input.homework, input.today, w);
  const streak = streakPick(input.history, input.today, input.joinDate);
  const trend = trendPick(input.history, input.today, input.joinDate);
  const picks = [
    contextPick(input.history, input.today, input.joinDate, w),
    // "Steady" only adds something when no streak sentence is there.
    trend?.code === 'trd_steady' && streak ? null : trend,
    streak,
    ...act.picks,
    act.cleared ? null : reviewPick(input.history, input.today, input.dueCount, input.overdueCount),
    ...reviewQualityPicks(input.answers, input.today, w),
    classPick(input.classAnswers, input.classNames, input.studentId, input.today),
    ...hw.picks,
    // Habits and preferences are noise for someone who has stopped; only a
    // skipped homework mode is still worth saying.
    activeWeek ? pref : onlySkips(pref),
    milestonePick(input.homework, hw.picks.map(p => p.code), input.today, input.mastered, input.learned, input.answers.length),
    activeWeek ? habitPick(input.history, input.today) : null,
    reminderPick(input.notes, input.history, input.now, input.today, input.joinDate),
  ].filter((p): p is Pick => p !== null);
  if (picks.length === 0) picks.push({ code: 'not_enough_data' });
  const suggestion = suggestionPick(picks, input.homework, input.history, input.today, input.joinDate, input.dueCount);
  // Keep the VISIBLE most important in paragraph order; the rest go under
  // "Batafsil". The suggestion always closes the visible paragraph.
  const keep = new Set([...picks].map((p, i) => ({ p, i })).sort((a, b) => importance(a.p.code) - importance(b.p.code) || a.i - b.i)
    .slice(0, VISIBLE).map(x => x.p));
  const ordered = [...picks.filter(p => keep.has(p)), ...(suggestion ? [suggestion] : []), ...picks.filter(p => !keep.has(p))];
  const seed = `${input.studentId}:${input.today}`;
  // The paragraph names the student once; later sentences say "u" (Uzbek
  // has no gendered pronoun) or "they" / "them".
  let named = false;
  const sentences = ordered.map(p => {
    const r = render(p, input.lang, input.name, seed, named);
    named ||= r.usesName;
    return r.sentence;
  });
  const split = keep.size + (suggestion ? 1 : 0);
  return { main: sentences.slice(0, split), more: sentences.slice(split) };
}
