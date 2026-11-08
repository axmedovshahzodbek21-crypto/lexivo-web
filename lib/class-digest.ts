// The rule-based weekly class digest: picks true statements about the class
// from its data, then words them from lib/class-digest-sentences.ts (the rule
// for each case is written there). No AI, no student data leaves Supabase.
import { DIGEST_SENTENCES, DIGEST_WORDS } from './class-digest-sentences';
import { SUMMARY_WORDS } from './student-summary-sentences';
import { addDays, dayDiff, fill, joinList, localDate, variantIndex } from './student-summary';
import type { Evidence, FactEvidence, HwEvidence, Lang, NoteEvidence, SummarySentence, WordEvidence } from './student-summary';
import type { HomeworkRecord } from './homework-deadlines';

export interface DigestInput {
  classId: string;
  lang: Lang;
  today: string;
  now: number;
  students: { id: string; name: string; joinDate: string | null }[];
  xp: { user_id: string; day: string; hour: number; xp: number; entries: number }[];
  homework: HomeworkRecord[];
  srs: { user_id: string; stage: number; next_due: string; last_reviewed: string | null }[];
  answers: { user_id: string; word: string; knew: boolean; created_at: string }[]; // last 8 weeks
  notes: { student_id: string; created_at: string; read_at: string | null }[];
  untaughtHardWords: number;
  archive: { word: string; state: 'again' | 'watching' | 'learned' }[];
  autoHomework: boolean;
  learnedByDay: { study_date: string; words_learned: number }[];
  reviewsBeforeWeek: number; // all review answers before this week started
  reviewsToYesterday: number;
  fmt: { activeDays: (n: number) => string; xp: (n: number) => string; words: (n: number) => string; correct: (r: number, t: number) => string; thisWeek: string };
}

export interface ClassDigest { main: SummarySentence[]; more: SummarySentence[]; codes: string[]; }

interface Pick { code: string; vars?: Record<string, string | number>; ev?: Record<string, Evidence>; }

const VISIBLE = 8; // sentences before "Batafsil"; the next step comes on top
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const uniq = <T,>(xs: T[]) => Array.from(new Set(xs));
const short = (ymd: string) => `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}`;
const facts = (items: FactEvidence[]): Evidence => ({ kind: 'facts', items });
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const weekday = (ymd: string) => new Date(`${ymd}T00:00:00`).getDay();
const dayPart = (h: number) => (h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 23 ? 'evening' : 'night');
const THRESHOLDS = { mastered: [100, 250, 500, 1000, 2500, 5000], reviews: [1000, 5000, 10000, 25000], age: [4, 12, 26, 52] };

// Which sentences stay visible. Lower = more important.
function importance(code: string): number {
  if (code.startsWith('hl_')) return 0;
  if (/^pl_(all|most|half|few|one)_active$/.test(code)) return 1;
  if (/^hw_(all_on_time|mostly|mixed|low|very_low)$/.test(code)) return 2;
  if (/^(pl_(stopped|never_started|joined_quiet|long_absent)|hw_(unit_missed|units_missed|students_none|soon_behind)|wd_hard_|wd_taught_again)/.test(code)) return 3;
  if (/^(rv_(none_week|all_clear|most_clear|many_waiting|backlog_big|acc_(strong|good|mixed|low))|pp_support_)/.test(code)) return 4;
  if (/^(pl_(up|down|steady|xp_)|hw_rate_|pp_(top|most|best|streak|quiet|all_fine)|tc_|ms_)/.test(code)) return 5;
  return 7;
}

export function buildClassDigest(input: DigestInput): ClassDigest {
  const { today, students, fmt, lang } = input;
  const W = DIGEST_WORDS[lang];
  const SW = SUMMARY_WORDS[lang];
  const counted = (n: number, k: 'student' | 'task' | 'word' | 'day') => fill(W[n === 1 ? `${k}1` : `${k}N`], { n });
  const agree = (n: number) => ({ were: n === 1 ? 'was' : 'were', have: n === 1 ? 'has' : 'have' });
  const nameOf = new Map(students.map(s => [s.id, s.name]));
  const names = (ids: string[]) => joinList(ids.map(i => nameOf.get(i) ?? ''), SW);
  const group = (ids: string[]) => ({ names: names(ids), students: counted(ids.length, 'student'), ...agree(ids.length) });

  const week = (i: number) => ({ from: addDays(today, -7 * (i + 1)), to: addDays(today, -7 * i - 1) });
  const THIS = week(0);
  const PREV = week(1);
  const inW = (d: string, w: { from: string; to: string }) => d >= w.from && d <= w.to;
  const rosterOf = (w: { to: string }) => students.filter(s => !s.joinDate || s.joinDate <= w.to).map(s => s.id);
  const roster = rosterOf(THIS);
  const total = roster.length;

  // XP by student by day
  const daily = new Map<string, Map<string, number>>();
  for (const r of input.xp) {
    if (!nameOf.has(r.user_id)) continue;
    const m = daily.get(r.user_id) ?? new Map<string, number>();
    m.set(r.day, (m.get(r.day) ?? 0) + r.xp);
    daily.set(r.user_id, m);
  }
  const daysOf = (id: string) => Array.from(daily.get(id)?.keys() ?? []).sort();
  const activeDays = (id: string, w: { from: string; to: string }) => daysOf(id).filter(d => inW(d, w));
  const xpIn = (id: string, w: { from: string; to: string }) => sum(activeDays(id, w).map(d => daily.get(id)!.get(d)!));
  const isActive = (id: string, w: { from: string; to: string }) => activeDays(id, w).length > 0;
  const activeIds = (w: { from: string; to: string }, ids = rosterOf(w)) => ids.filter(id => isActive(id, w));
  const classXp = (w: { from: string; to: string }) => sum(students.map(s => xpIn(s.id, w)));
  const finish = (picks: Pick[], next: Pick | null): ClassDigest => {
    const keep = new Set(picks.map((p, i) => ({ p, i })).sort((a, b) => importance(a.p.code) - importance(b.p.code) || a.i - b.i).slice(0, VISIBLE).map(x => x.p));
    const shown = [...picks.filter(p => keep.has(p)), ...(next ? [next] : [])];
    const rest = picks.filter(p => !keep.has(p));
    const sentence = (p: Pick) => renderCase(p, lang, `${input.classId}:${today}:${p.code}`);
    return { main: shown.map(sentence), more: rest.map(sentence), codes: [...shown, ...rest].map(p => p.code) };
  };

  // ── Data gates ─────────────────────────────────────────────────────────────
  if (students.length === 0) return finish([{ code: 'nd_no_students' }], null);
  if (students.length <= 2) return finish([{ code: 'nd_small_class', vars: { total: students.length, students: counted(students.length, 'student') } }], null);
  const ever = students.filter(s => daysOf(s.id).length > 0).map(s => s.id);
  const everBefore = ever.filter(id => daysOf(id)[0] < today);
  if (ever.length === 0) return finish([{ code: 'nd_no_activity', vars: { total: students.length } }], null);
  const joins = students.map(s => s.joinDate).filter((d): d is string => !!d).sort();
  if (everBefore.length === 0 || (joins[0] && dayDiff(joins[0], today) < 7)) {
    const ids = students.map(s => s.id).filter(id => daysOf(id).length > 0);
    return finish([{ code: 'nd_first_week', vars: { active: ids.length, total: students.length, ...agree(ids.length) }, ev: { students: studentFacts(ids, { from: '0000', to: today }) } }], null);
  }

  function studentFacts(ids: string[], w = THIS): Evidence {
    return facts([...ids].sort((a, b) => xpIn(b, w) - xpIn(a, w)).map(id => {
      const d = activeDays(id, w).length;
      return { title: nameOf.get(id) ?? '', detail: d ? `${fmt.activeDays(d)} · ${fmt.xp(xpIn(id, w))}` : undefined };
    }));
  }
  const rangeLabel = (i: number) => (i === 0 ? fmt.thisWeek : `${short(week(i).from)} – ${short(week(i).to)}`);
  const compare = (now: string | number, before: string | number) => facts([
    { title: rangeLabel(0), detail: String(now) },
    { title: rangeLabel(1), detail: String(before) },
  ]);
  const xpWeeks = (): Evidence => ({
    kind: 'weeks',
    items: [0, 1, 2, 3].map(i => {
      const w = week(i);
      const days = uniq(students.flatMap(s => activeDays(s.id, w)));
      return { from: w.from, to: w.to, xp: classXp(w), activeDays: days.length };
    }),
  });

  const picks: Pick[] = [];
  const act = activeIds(THIS);
  const active = act.length;
  const share = active / Math.max(1, total);
  const prevAct = activeIds(PREV);
  const prev = prevAct.length;
  const xpNow = classXp(THIS);
  const xpPrev = classXp(PREV);
  const usualWeeks = [week(1), week(2), week(3)];
  const lastDay = (id: string, before = today) => daysOf(id).filter(d => d < before).pop() ?? null;

  // ── Homework figures (used by the headline too) ────────────────────────────
  const hw = input.homework.filter(r => roster.includes(r.studentId));
  const dueIn = (w: { from: string; to: string }) => hw.filter(r => inW(r.dueDate, w));
  const onTime = (r: HomeworkRecord) => !!r.finishedDate && r.finishedDate <= r.dueDate;
  const due = dueIn(THIS);
  const rate = due.length ? pct(due.filter(onTime).length, due.length) : null;
  const dueBefore = dueIn(PREV);
  const ratePrev = dueBefore.length ? pct(dueBefore.filter(onTime).length, dueBefore.length) : null;
  type Hw = { id: string; title: string; modes: string[]; due: string; rows: HomeworkRecord[] };
  const groupHw = (rows: HomeworkRecord[]): Hw[] => {
    const m = new Map<string, Hw>();
    for (const r of rows) {
      const g = m.get(r.homeworkId) ?? { id: r.homeworkId, title: r.title, modes: r.modes, due: r.dueDate, rows: [] };
      g.rows.push(r);
      m.set(r.homeworkId, g);
    }
    return Array.from(m.values()).sort((a, b) => b.due.localeCompare(a.due));
  };
  const hwEv = (gs: Hw[]): Evidence => ({
    kind: 'homework',
    items: gs.map((g): HwEvidence => ({ homeworkId: g.id, title: g.title, modes: g.modes, dueDate: g.due, finishedDate: null, missingModes: [], status: null, days: 0 })),
  });
  const dueGroups = groupHw(due);

  // ── Headline ───────────────────────────────────────────────────────────────
  const earliest = uniq(students.flatMap(s => daysOf(s.id))).sort()[0];
  const earlierWeeks: number[] = [];
  for (let i = 1; week(i).from >= earliest; i++) earlierWeeks.push(classXp(week(i)));
  const prevRoster = rosterOf(PREV).length;
  const lastAny = students.map(s => lastDay(s.id)).filter((d): d is string => !!d).sort().pop();
  if (active === 0) {
    picks.push({ code: 'hl_silent', vars: { dayCount: counted(Math.max(1, lastAny ? dayDiff(lastAny, today) : 1), 'day') }, ev: { weeks: xpWeeks() } });
  } else {
    const code = earlierWeeks.length >= 4 && xpNow > Math.max(...earlierWeeks) && share >= 0.5 ? 'hl_record'
      : prevRoster > 0 && prev / prevRoster < 0.4 && share >= 0.6 ? 'hl_recovering'
      : share >= 0.75 && (rate === null || rate >= 80) ? 'hl_strong'
      : share >= 0.6 ? 'hl_good'
      : share >= 0.4 ? 'hl_mixed' : 'hl_quiet';
    picks.push({ code, ev: { weeks: xpWeeks() } });
  }

  // ── Pulse ──────────────────────────────────────────────────────────────────
  const stu = { students: studentFacts(act) };
  if (active > 0) {
    if (active === total) picks.push({ code: 'pl_all_active', vars: { total }, ev: stu });
    else if (share >= 0.75) picks.push({ code: 'pl_most_active', vars: { active, total }, ev: stu });
    else if (share >= 0.4) picks.push({ code: 'pl_half_active', vars: { active, total }, ev: stu });
    else if (active === 1) picks.push({ code: 'pl_one_active', vars: { name: names(act), total }, ev: stu });
    else picks.push({ code: 'pl_few_active', vars: { active, total }, ev: stu });
  }
  if (prev > 0 && active > 0) {
    const d = active - prev;
    const ev = { weeks: compare(counted(active, 'student'), counted(prev, 'student')) };
    const xpChange = xpPrev > 0 ? pct(xpNow - xpPrev, xpPrev) : 0;
    const xpEv = { weeks: compare(fmt.xp(xpNow), fmt.xp(xpPrev)) };
    if (d >= 3 || (d >= 1 && active >= prev * 1.5)) picks.push({ code: 'pl_up_strong', vars: { active, prev }, ev });
    else if ((d <= -3 || active <= prev / 2) && active >= 2) picks.push({ code: 'pl_down_strong', vars: { active, prev }, ev });
    else if (Math.abs(d) <= 1 && xpChange >= 25) picks.push({ code: 'pl_xp_up', vars: { pct: xpChange }, ev: xpEv });
    else if (Math.abs(d) <= 1 && xpChange <= -25) picks.push({ code: 'pl_xp_down', vars: { pct: -xpChange }, ev: xpEv });
    else if (d > 0) picks.push({ code: 'pl_up', vars: { active, prev }, ev });
    else if (d < 0 && active >= 2) picks.push({ code: 'pl_down', vars: { active, prev }, ev });
    else if (d === 0 && active >= 2) picks.push({ code: 'pl_steady', vars: { active }, ev });
  }
  if (active > 0) {
    const weekRows = input.xp.filter(r => nameOf.has(r.user_id) && inW(r.day, THIS));
    const byDay = new Map<string, number>();
    const byPart = new Map<string, number>();
    for (const r of weekRows) {
      byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.xp);
      byPart.set(dayPart(r.hour), (byPart.get(dayPart(r.hour)) ?? 0) + r.entries);
    }
    const days = { days: { kind: 'days', items: Array.from(byDay.keys()).sort().reverse().map(date => ({ date, xp: byDay.get(date)!, reasons: [] })) } as Evidence };
    const topDay = Array.from(byDay.entries()).sort((a, b) => b[1] - a[1])[0];
    const weekend = sum(Array.from(byDay.entries()).filter(([d]) => [0, 6].includes(weekday(d))).map(([, x]) => x));
    const entries = sum(Array.from(byPart.values()));
    const topPart = Array.from(byPart.entries()).sort((a, b) => b[1] - a[1])[0];
    if (byDay.size === 7) picks.push({ code: 'pl_every_day', ev: days });
    else if (active >= 2 && topDay && topDay[1] / xpNow >= 0.4) picks.push({ code: 'pl_peak_day', vars: { day: W[DAY_KEYS[weekday(topDay[0])]] }, ev: days });
    else if (xpNow > 0 && weekend / xpNow >= 0.35) picks.push({ code: 'pl_weekend', ev: days });
    else if (topPart && entries > 0 && topPart[1] / entries >= 0.5) picks.push({ code: 'pl_peak_time', vars: { part: W[topPart[0]] }, ev: days });
  }
  const joinedThisWeek = students.filter(s => s.joinDate && inW(s.joinDate, THIS)).map(s => s.id);
  const firstThisWeek = (id: string) => activeDays(id, THIS)[0];
  const stopped = prevAct.filter(id => !act.includes(id));
  const neverStarted = students.filter(s => (!s.joinDate || dayDiff(s.joinDate, today) >= 7) && daysOf(s.id).length === 0).map(s => s.id);
  const joinedQuiet = joinedThisWeek.filter(id => daysOf(id).length === 0);
  const longAbsent = roster.filter(id => { const l = lastDay(id, addDays(today, 1)); return !!l && dayDiff(l, today) >= 14 && !stopped.includes(id); });
  const returned = act.filter(id => { const l = lastDay(id, THIS.from); return !!l && dayDiff(l, firstThisWeek(id)) >= 14; });
  const joinedActive = joinedThisWeek.filter(id => act.includes(id));
  const membership: [string, string[]][] = [
    ['pl_stopped', stopped], ['pl_never_started', neverStarted], ['pl_joined_quiet', joinedQuiet],
    ['pl_long_absent', longAbsent], ['pl_returned', returned], ['pl_joined_active', joinedActive],
  ];
  for (const [code, ids] of membership.filter(([, ids]) => ids.length > 0).slice(0, 2)) {
    picks.push({ code, vars: group(ids), ev: { students: studentFacts(ids, code === 'pl_stopped' ? PREV : THIS) } });
  }

  // ── Homework ───────────────────────────────────────────────────────────────
  const hwDetails: Pick[] = [];
  const distinctDue = dueGroups.length;
  if (rate === null) picks.push({ code: 'hw_none_due' });
  else {
    const ev = { homework: hwEv(dueGroups) };
    if (rate === 100 && distinctDue >= 2) picks.push({ code: 'hw_all_on_time', vars: { tasks: counted(distinctDue, 'task') }, ev });
    else if (rate >= 80 && !(rate === 100 && dueGroups[0].rows.length >= 3)) picks.push({ code: 'hw_mostly', vars: { pct: rate }, ev });
    else if (rate >= 50 && rate < 80) picks.push({ code: 'hw_mixed', vars: { pct: rate }, ev });
    else if (rate >= 25 && rate < 50) picks.push({ code: 'hw_low', vars: { pct: rate }, ev });
    else if (rate < 25) picks.push({ code: 'hw_very_low', vars: { pct: rate }, ev });
    if (ratePrev !== null && rate - ratePrev >= 15) picks.push({ code: 'hw_rate_up', vars: { from: ratePrev, to: rate }, ev: { weeks: compare(`${rate}%`, `${ratePrev}%`) } });
    else if (ratePrev !== null && ratePrev - rate >= 15) picks.push({ code: 'hw_rate_down', vars: { from: ratePrev, to: rate }, ev: { weeks: compare(`${rate}%`, `${ratePrev}%`) } });
  }
  const missedGroups = dueGroups.filter(g => g.rows.length >= 3 && g.rows.filter(r => !r.finishedDate).length / g.rows.length >= 0.5);
  const unitMissed = missedGroups.length === 1 ? missedGroups[0] : null;
  if (unitMissed) hwDetails.push({ code: 'hw_unit_missed', vars: { hw: unitMissed.title, missed: unitMissed.rows.filter(r => !r.finishedDate).length, total: unitMissed.rows.length }, ev: { homework: hwEv([unitMissed]) } });
  if (missedGroups.length >= 2) hwDetails.push({ code: 'hw_units_missed', vars: { tasks: counted(missedGroups.length, 'task') }, ev: { homework: hwEv(missedGroups) } });
  const perStudentDue = roster.map(id => ({ id, rows: due.filter(r => r.studentId === id) }));
  const noneDone = perStudentDue.filter(s => s.rows.length >= 2 && s.rows.every(r => !r.finishedDate)).map(s => s.id);
  const allOnTime = perStudentDue.filter(s => s.rows.length >= 3 && s.rows.every(onTime)).map(s => s.id);
  if (noneDone.length) hwDetails.push({ code: 'hw_students_none', vars: { names: names(noneDone) }, ev: { homework: hwEv(dueGroups) } });
  const upcoming = groupHw(hw.filter(r => r.dueDate >= today)).reverse();
  const soon = upcoming.find(g => dayDiff(today, g.due) <= 3);
  const whenText = (d: string) => { const n = dayDiff(today, d); return n === 0 ? W.today : n === 1 ? W.tomorrow : fill(W.inDays, { n }); };
  if (soon) {
    const done = soon.rows.filter(r => r.finishedDate).length;
    const left = soon.rows.length - done;
    if (done / soon.rows.length < 0.5 && left >= 2) hwDetails.push({ code: 'hw_soon_behind', vars: { hw: soon.title, when: whenText(soon.due), left, total: soon.rows.length }, ev: { homework: hwEv([soon]) } });
  }
  const partial = due.filter(r => r.missingModes.length > 0 && r.missingModes.length < r.modes.length).flatMap(r => r.missingModes);
  const modeCounts = new Map<string, number>();
  for (const m of partial) modeCounts.set(m, (modeCounts.get(m) ?? 0) + 1);
  const topMode = Array.from(modeCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  const modeLeft = topMode && topMode[1] >= 3 && topMode[1] / partial.length >= 0.5 ? topMode : null;
  if (modeLeft) hwDetails.push({ code: 'hw_mode_left', vars: { mode: SW[modeLeft[0]] ?? modeLeft[0], n: modeLeft[1] }, ev: { homework: hwEv(dueGroups) } });
  const finished = due.filter(r => r.finishedDate);
  const onLast = finished.filter(r => r.finishedDate === r.dueDate).length;
  const early = finished.filter(r => r.finishedDate! < r.dueDate).length;
  const late = finished.filter(r => r.finishedDate! > r.dueDate);
  const lastDayRush = finished.length >= 3 && onLast / finished.length >= 0.5;
  if (lastDayRush) hwDetails.push({ code: 'hw_last_day', vars: { pct: pct(onLast, finished.length) }, ev: { homework: hwEv(dueGroups) } });
  else if (finished.length >= 3 && early / finished.length >= 0.5) hwDetails.push({ code: 'hw_early', vars: { pct: pct(early, finished.length) }, ev: { homework: hwEv(dueGroups) } });
  if (finished.length >= 3 && late.length / finished.length >= 0.3) hwDetails.push({ code: 'hw_late_many', vars: { students: counted(uniq(late.map(r => r.studentId)).length, 'student') }, ev: { homework: hwEv(dueGroups) } });
  const newest = dueGroups[0];
  if (newest && newest.rows.length >= 3 && newest.rows.every(onTime)) hwDetails.push({ code: 'hw_unit_complete', vars: { hw: newest.title }, ev: { homework: hwEv([newest]) } });
  if (soon) {
    const done = soon.rows.filter(r => r.finishedDate).length;
    if (done / soon.rows.length >= 0.5 && done >= 2) hwDetails.push({ code: 'hw_soon_fine', vars: { hw: soon.title, when: whenText(soon.due), done, total: soon.rows.length }, ev: { homework: hwEv([soon]) } });
  }
  if (allOnTime.length) hwDetails.push({ code: 'hw_students_all', vars: { names: names(allOnTime) }, ev: { homework: hwEv(dueGroups) } });
  const noneUpcoming = upcoming.length === 0 && !input.autoHomework;
  if (noneUpcoming) hwDetails.push({ code: 'hw_none_upcoming' });
  picks.push(...hwDetails.slice(0, 3));

  // ── Review ─────────────────────────────────────────────────────────────────
  const srs = input.srs.filter(r => roster.includes(r.user_id));
  const answers = input.answers.filter(a => roster.includes(a.user_id)).map(a => ({ ...a, day: localDate(a.created_at) }));
  const ansIn = (w: { from: string; to: string }) => answers.filter(a => inW(a.day, w));
  const ansNow = ansIn(THIS);
  const ansPrev = ansIn(PREV);
  const withWords = uniq(srs.map(r => r.user_id));
  const waitingOf = (id: string) => srs.filter(r => r.user_id === id && r.stage < 5 && r.next_due <= today).length;
  const waitingIds = withWords.filter(id => waitingOf(id) > 0);
  const waiting = sum(withWords.map(waitingOf));
  const overdue = srs.filter(r => r.stage < 5 && r.next_due < today).length;
  const reviewFacts = (ids: string[]): Evidence => facts([...ids].sort((a, b) => waitingOf(b) - waitingOf(a)).map(id => ({ title: nameOf.get(id) ?? '', detail: fmt.words(waitingOf(id)) })));
  const noReviewWeek = ansNow.length === 0 && waiting >= 2;
  const backlogBig = withWords.length > 0 && overdue >= 10 * withWords.length && overdue >= 2;
  if (withWords.length === 0) picks.push({ code: 'rv_no_srs' });
  else {
    const clear = withWords.length - waitingIds.length;
    const ev = { review: reviewFacts(waitingIds.length ? waitingIds : withWords) };
    if (noReviewWeek) picks.push({ code: 'rv_none_week', vars: { wordCount: counted(waiting, 'word') }, ev });
    else if (waitingIds.length === 0) picks.push({ code: 'rv_all_clear', vars: { total: withWords.length }, ev });
    else if (clear / withWords.length >= 0.7) picks.push({ code: 'rv_most_clear', vars: { n: clear, total: withWords.length }, ev });
    else if (waiting >= 2) picks.push({ code: 'rv_many_waiting', vars: { students: counted(waitingIds.length, 'student'), wordCount: counted(waiting, 'word'), ...agree(waitingIds.length) }, ev });
    if (backlogBig && !noReviewWeek) picks.push({ code: 'rv_backlog_big', vars: { wordCount: counted(overdue, 'word') }, ev });
  }
  const accOf = (xs: { knew: boolean }[]) => pct(xs.filter(a => a.knew).length, xs.length);
  const accEv = (i = 0): Evidence => ({ kind: 'accuracy', items: [i, i + 1].map(k => { const xs = ansIn(week(k)); return { from: week(k).from, to: week(k).to, right: xs.filter(a => a.knew).length, total: xs.length }; }).filter(x => x.total > 0) });
  if (ansPrev.length >= 20 && ansNow.length > 0) {
    const change = pct(ansNow.length - ansPrev.length, ansPrev.length);
    const ev = { weeks: compare(ansNow.length, ansPrev.length) };
    if (change >= 25) picks.push({ code: 'rv_up', vars: { pct: change }, ev });
    else if (change <= -25) picks.push({ code: 'rv_down', vars: { pct: -change }, ev });
  }
  const answersBy = (id: string, xs = ansNow) => xs.filter(a => a.user_id === id);
  const regular = roster.filter(id => uniq(answersBy(id).map(a => a.day)).length >= 5);
  if (regular.length >= 2) picks.push({ code: 'rv_regular', vars: { students: counted(regular.length, 'student') }, ev: { review: reviewFacts(regular) } });
  const accFacts = (ids: string[]): Evidence => facts(ids.map(id => { const xs = answersBy(id); return { title: nameOf.get(id) ?? '', detail: `${fmt.correct(xs.filter(a => a.knew).length, xs.length)} (${accOf(xs)}%)` }; }));
  if (ansNow.length >= 30) {
    const a = accOf(ansNow);
    picks.push({ code: a >= 90 ? 'rv_acc_strong' : a >= 75 ? 'rv_acc_good' : a >= 60 ? 'rv_acc_mixed' : 'rv_acc_low', vars: { pct: a }, ev: { accuracy: accEv() } });
    if (ansPrev.length >= 30) {
      const p = accOf(ansPrev);
      if (a - p >= 5) picks.push({ code: 'rv_acc_up', vars: { from: p, to: a }, ev: { accuracy: accEv() } });
      else if (p - a >= 5) picks.push({ code: 'rv_acc_down', vars: { from: p, to: a }, ev: { accuracy: accEv() } });
    }
  }
  const measured = roster.filter(id => answersBy(id).length >= 20);
  if (measured.length >= 2) {
    const sorted = [...measured].sort((x, y) => accOf(answersBy(y)) - accOf(answersBy(x)));
    const high = accOf(answersBy(sorted[0]));
    const low = accOf(answersBy(sorted[sorted.length - 1]));
    if (high - low >= 30) picks.push({ code: 'rv_acc_spread', vars: { high, low }, ev: { accuracy: accEv() } });
  }

  // ── Words ──────────────────────────────────────────────────────────────────
  type WordStat = WordEvidence & { wrongBy: number };
  const hardWords = (xs: typeof answers): WordStat[] => {
    const m = new Map<string, { users: Set<string>; bad: Set<string>; right: number; wrong: number }>();
    for (const a of xs) {
      const s = m.get(a.word) ?? { users: new Set<string>(), bad: new Set<string>(), right: 0, wrong: 0 };
      s.users.add(a.user_id);
      if (a.knew) s.right++; else { s.wrong++; s.bad.add(a.user_id); }
      m.set(a.word, s);
    }
    return Array.from(m.entries()).filter(([, s]) => s.bad.size >= 3 && s.bad.size / s.users.size >= 0.4)
      .map(([word, s]) => ({ word, right: s.right, wrong: s.wrong, wrongBy: s.bad.size }))
      .sort((a, b) => b.wrongBy - a.wrongBy || b.wrong - a.wrong);
  };
  const hard = hardWords(ansNow);
  const wordEv = (xs: WordEvidence[]): Evidence => ({ kind: 'words', items: xs.slice(0, 5).map(({ word, right, wrong }) => ({ word, right, wrong })) });
  const statsOf = (words: string[]): WordEvidence[] => words.map(word => { const xs = ansNow.filter(a => a.word === word); return { word, right: xs.filter(a => a.knew).length, wrong: xs.filter(a => !a.knew).length }; });
  const list = (words: string[]) => joinList(words.slice(0, 3), SW);
  if (hard.length >= 2) picks.push({ code: 'wd_hard_many', vars: { words: list(hard.map(h => h.word)), n: hard.length }, ev: { words: wordEv(hard) } });
  else if (hard.length === 1) picks.push({ code: 'wd_hard_one', vars: { word: hard[0].word, students: counted(hard[0].wrongBy, 'student') }, ev: { words: wordEv(hard) } });
  else if (ansNow.length >= 50) picks.push({ code: 'wd_no_hard', ev: { words: wordEv(statsOf(uniq(ansNow.filter(a => !a.knew).map(a => a.word))).sort((a, b) => b.wrong - a.wrong)) } });
  const nowHard = new Set(hard.map(h => h.word));
  const recovered = hardWords(ansPrev).map(h => h.word).filter(w => { const s = statsOf([w])[0]; return !nowHard.has(w) && s.right + s.wrong >= 3 && s.right / (s.right + s.wrong) >= 0.8; });
  if (recovered.length) picks.push({ code: 'wd_recovered', vars: { words: list(recovered) }, ev: { words: wordEv(statsOf(recovered)) } });
  const taughtAgain = input.archive.filter(a => a.state === 'again').map(a => a.word);
  const taughtHolding = input.archive.filter(a => a.state === 'learned' && ansNow.some(x => x.word === a.word && x.knew)).map(a => a.word);
  if (taughtAgain.length) picks.push({ code: 'wd_taught_again', vars: { words: list(taughtAgain) }, ev: { words: wordEv(statsOf(taughtAgain)) } });
  if (taughtHolding.length) picks.push({ code: 'wd_taught_holding', vars: { words: list(taughtHolding) }, ev: { words: wordEv(statsOf(taughtHolding)) } });
  if (input.untaughtHardWords >= 5) picks.push({ code: 'wd_to_teach', vars: { wordCount: counted(input.untaughtHardWords, 'word') }, ev: { words: { kind: 'facts', items: [{ title: counted(input.untaughtHardWords, 'word') }] } } });
  const learnedIn = (w: { from: string; to: string }) => sum(input.learnedByDay.filter(d => inW(d.study_date, w)).map(d => d.words_learned));
  const learned = learnedIn(THIS);
  const learnedPrev = learnedIn(PREV);
  const learnedEv = { weeks: compare(counted(learned, 'word'), counted(learnedPrev, 'word')) };
  if (learned >= 2) picks.push({ code: 'wd_learned', vars: { wordCount: counted(learned, 'word') }, ev: learnedEv });
  if (learned > 0 && learnedPrev > 0) {
    const c = pct(learned - learnedPrev, learnedPrev);
    if (c >= 25) picks.push({ code: 'wd_learned_up', vars: { pct: c }, ev: learnedEv });
    else if (c <= -25) picks.push({ code: 'wd_learned_down', vars: { pct: -c }, ev: learnedEv });
  }
  if (learned === 0 && ansNow.length > 0) picks.push({ code: 'wd_learned_none', ev: learnedEv });
  const mastered = srs.filter(r => r.stage >= 5).length;

  // ── People ─────────────────────────────────────────────────────────────────
  const topBy = (ids: string[], score: (id: string) => number) => { const best = Math.max(...ids.map(score)); return ids.filter(id => score(id) === best); };
  const praise: Pick[] = [];
  const praised = new Set<string>();
  const addPraise = (code: string, ids: string[], vars: Record<string, string | number>, ev: Record<string, Evidence>) => { praise.push({ code, vars: { names: names(ids), ...agree(ids.length), ...vars }, ev }); ids.forEach(i => praised.add(i)); };
  const usualXp = (id: string) => sum(usualWeeks.map(w => xpIn(id, w))) / 3;
  const improved = act.filter(id => usualWeeks.filter(w => isActive(id, w)).length >= 2 && xpIn(id, THIS) >= usualXp(id) * 1.5);
  if (improved.length) { const ids = topBy(improved, id => xpIn(id, THIS) / usualXp(id)); addPraise('pp_most_improved', ids, {}, { students: facts(ids.map(id => ({ title: nameOf.get(id) ?? '', detail: `${fmt.xp(xpIn(id, THIS))} (${fmt.xp(Math.round(usualXp(id)))})` }))) }); }
  const reviewers = roster.filter(id => answersBy(id).length >= 20);
  if (reviewers.length) { const ids = topBy(reviewers, id => answersBy(id).length); addPraise('pp_top_review', ids, { n: answersBy(ids[0]).length }, { students: reviewFacts(ids) }); }
  if (measured.length) { const ids = topBy(measured, id => accOf(answersBy(id))); addPraise('pp_best_accuracy', ids, { pct: accOf(answersBy(ids[0])) }, { accuracy: accFacts(ids) }); }
  const streakOf = (id: string) => { const set = new Set(daysOf(id)); let d = set.has(today) ? today : addDays(today, -1); let n = 0; while (set.has(d)) { n++; d = addDays(d, -1); } return n; };
  const streakers = roster.filter(id => streakOf(id) >= 7);
  if (streakers.length) { const ids = topBy(streakers, streakOf); addPraise('pp_streak', ids, { dayCount: counted(streakOf(ids[0]), 'day') }, { days: facts(ids.map(id => ({ title: nameOf.get(id) ?? '', detail: counted(streakOf(id), 'day') }))) }); }
  const steady = roster.filter(id => !praised.has(id) && [THIS, week(1), week(2)].every(w => activeDays(id, w).length >= 4));
  if (steady.length) addPraise('pp_quiet_steady', steady, {}, { students: studentFacts(steady) });
  picks.push(...praise.slice(0, 2));

  const supported = new Set<string>();
  const support = (ids: string[]) => { const fresh = ids.filter(id => !supported.has(id)); fresh.forEach(id => supported.add(id)); return fresh; };
  const supportLines: Pick[] = [];
  const dropIds = support(act.filter(id => sum(usualWeeks.map(w => activeDays(id, w).length)) / 3 >= 3 && activeDays(id, THIS).length === 1));
  if (dropIds.length) supportLines.push({ code: 'pp_support_drop', vars: { names: names(dropIds) }, ev: { students: studentFacts(dropIds) } });
  const hwIds = support(act.filter(id => { const r = due.filter(x => x.studentId === id); return r.length >= 2 && r.filter(x => !x.finishedDate).length / r.length >= 0.5; }));
  if (hwIds.length) supportLines.push({ code: 'pp_support_homework', vars: { names: names(hwIds), ...agree(hwIds.length) }, ev: { homework: hwEv(dueGroups) } });
  const accIds = support(measured.filter(id => accOf(answersBy(id)) < 60));
  if (accIds.length) supportLines.push({ code: 'pp_support_accuracy', vars: { names: names(accIds), ...agree(accIds.length) }, ev: { accuracy: accFacts(accIds) } });
  const backlogIds = support(act.filter(id => waitingOf(id) >= 30));
  if (backlogIds.length) supportLines.push({ code: 'pp_support_backlog', vars: { names: names(backlogIds), ...agree(backlogIds.length) }, ev: { review: reviewFacts(backlogIds) } });
  picks.push(...supportLines.slice(0, 2));
  if (supportLines.length === 0 && noneDone.length === 0 && share >= 0.75) picks.push({ code: 'pp_all_fine', ev: stu });
  if (xpNow > 0) {
    const ranked = [...act].sort((a, b) => xpIn(b, THIS) - xpIn(a, THIS));
    const topN = Math.max(1, Math.ceil(total * 0.2));
    const topShare = pct(sum(ranked.slice(0, topN).map(id => xpIn(id, THIS))), xpNow);
    const avg = xpNow / Math.max(1, active);
    if (total >= 5 && topShare >= 60 && active > topN) picks.push({ code: 'pp_concentrated', vars: { students: counted(topN, 'student'), pct: topShare }, ev: { students: studentFacts(ranked.slice(0, topN)) } });
    else if (share >= 0.6 && ranked.every(id => xpIn(id, THIS) <= avg * 1.5)) picks.push({ code: 'pp_balanced', ev: stu });
  }

  // ── Teacher messages ───────────────────────────────────────────────────────
  const noteTime = (n: { created_at: string }) => Date.parse(n.created_at);
  const bucketTimes = (id: string) => input.xp.filter(r => r.user_id === id).map(r => Date.parse(`${r.day}T${String(r.hour).padStart(2, '0')}:00:00+05:00`));
  const practisedAfter = (n: { student_id: string; created_at: string }) => bucketTimes(n.student_id)
    .filter(t => t + 3600_000 > noteTime(n) && t <= noteTime(n) + 72 * 3600_000).sort((a, b) => a - b)[0] ?? null;
  const notesThisWeek = input.notes.filter(n => inW(localDate(n.created_at), THIS) && roster.includes(n.student_id))
    .map(n => ({ n, at: practisedAfter(n), old: input.now - noteTime(n) >= 72 * 3600_000 }));
  const judged = notesThisWeek.filter(x => x.at !== null || x.old);
  const noteEv = (xs: typeof notesThisWeek): Evidence => ({ kind: 'reminders', items: xs.map((x): NoteEvidence => ({ sentAt: x.n.created_at, readAt: x.n.read_at, practisedAt: x.at === null ? null : new Date(Math.max(x.at, noteTime(x.n))).toISOString() })) });
  const worked = judged.filter(x => x.at !== null);
  const readNoAction = judged.filter(x => x.at === null && x.n.read_at);
  const unread = judged.filter(x => x.at === null && !x.n.read_at);
  const quiet7 = roster.filter(id => { const l = lastDay(id, addDays(today, 1)); return l ? dayDiff(l, today) >= 7 : !!students.find(s => s.id === id && (!s.joinDate || dayDiff(s.joinDate, today) >= 7)); });
  const noRecentNote = quiet7.filter(id => !input.notes.some(n => n.student_id === id && input.now - noteTime(n) <= 14 * 86400_000));
  if (worked.length >= 1 && judged.length >= 2) picks.push({ code: 'tc_worked', vars: { n: worked.length, m: judged.length }, ev: { notes: noteEv(judged) } });
  else if (readNoAction.length >= 2) picks.push({ code: 'tc_read_no_action', vars: { n: readNoAction.length }, ev: { notes: noteEv(readNoAction) } });
  else if (unread.length >= 2) picks.push({ code: 'tc_unread', vars: { n: unread.length }, ev: { notes: noteEv(unread) } });
  else if (noRecentNote.length) picks.push({ code: 'tc_none_sent', vars: { students: counted(noRecentNote.length, 'student'), ...agree(noRecentNote.length) }, ev: { students: studentFacts(noRecentNote) } });

  // ── Milestones: at most one ────────────────────────────────────────────────
  const newlyMastered = srs.filter(r => r.stage >= 5 && r.last_reviewed && localDate(r.last_reviewed) >= THIS.from).length;
  const crossed = (list: number[], before: number, now: number) => list.filter(t => before < t && now >= t).pop();
  const masteredMark = crossed(THRESHOLDS.mastered, mastered - newlyMastered, mastered);
  const reviewMark = crossed(THRESHOLDS.reviews, input.reviewsBeforeWeek, input.reviewsToYesterday);
  const pastGroups = groupHw(hw.filter(r => r.dueDate < today));
  let hwRun = 0;
  for (const g of pastGroups) { if (pct(g.rows.filter(onTime).length, g.rows.length) >= 80) hwRun++; else break; }
  let allRun = 0;
  for (let i = 0; i < 52; i++) { const w = week(i); const ids = rosterOf(w); if (ids.length > 0 && ids.every(id => isActive(id, w))) allRun++; else break; }
  const weekAcc = [1, 2, 3, 4, 5, 6, 7].map(i => ansIn(week(i))).filter(x => x.length >= 30).map(accOf);
  const nowAcc = ansNow.length >= 30 ? accOf(ansNow) : null;
  const weeksOld = joins[0] ? Math.floor(dayDiff(joins[0], today) / 7) : 0;
  if (masteredMark) picks.push({ code: 'ms_mastered', vars: { n: masteredMark }, ev: { review: reviewFacts(withWords) } });
  else if (reviewMark) picks.push({ code: 'ms_reviews', vars: { n: reviewMark }, ev: { review: reviewFacts(withWords) } });
  else if (hwRun >= 3) picks.push({ code: 'ms_hw_run', vars: { n: hwRun }, ev: { homework: hwEv(pastGroups.slice(0, hwRun)) } });
  else if (allRun >= 2) picks.push({ code: 'ms_all_active_run', vars: { weeks: allRun }, ev: { weeks: xpWeeks() } });
  else if (nowAcc !== null && nowAcc >= 75 && weekAcc.length >= 2 && nowAcc > Math.max(...weekAcc)) picks.push({ code: 'ms_best_accuracy', vars: { pct: nowAcc }, ev: { accuracy: accEv() } });
  else if (THRESHOLDS.age.includes(weeksOld)) picks.push({ code: 'ms_class_age', vars: { weeks: weeksOld } });
  if (mastered >= 10 && !masteredMark) picks.push({ code: 'wd_mastered', vars: { wordCount: counted(mastered, 'word') }, ev: { review: reviewFacts(withWords) } });

  // ── Next step: first match wins ────────────────────────────────────────────
  const hardList = hard.length ? hard.map(h => h.word) : taughtAgain;
  const next = ((): Pick => {
    if (active === 0) return { code: 'nx_silent' };
    if (stopped.length) return { code: 'nx_stopped', vars: { names: names(stopped) } };
    if (neverStarted.length) return { code: 'nx_never_started', vars: { names: names(neverStarted) } };
    if (joinedQuiet.length) return { code: 'nx_new_students', vars: { names: names(joinedQuiet) } };
    if (unitMissed) return { code: 'nx_overdue_unit', vars: { hw: unitMissed.title }, ev: { homework: hwEv([unitMissed]) } };
    if (hardList.length) return { code: 'nx_teach_hard', vars: { words: list(hardList) }, ev: { words: wordEv(statsOf(hardList)) } };
    if (noReviewWeek || backlogBig) return { code: 'nx_review_restart', vars: { wordCount: counted(noReviewWeek ? waiting : overdue, 'word') } };
    if (rate !== null && rate < 50) return { code: 'nx_homework_load' };
    if (modeLeft) return { code: 'nx_mode_left', vars: { mode: SW[modeLeft[0]] ?? modeLeft[0] } };
    if (lastDayRush) return { code: 'nx_deadline_rush' };
    if (noneUpcoming) return { code: 'nx_assign' };
    const helpIds = [...dropIds, ...hwIds, ...accIds, ...backlogIds];
    if (helpIds.length) return { code: 'nx_support', vars: { names: names(helpIds) } };
    if (praised.size) return { code: 'nx_praise', vars: { names: names(Array.from(praised)) } };
    return { code: 'nx_keep_going' };
  })();

  return finish(picks, next);
}

// Splits [[label|key]] before filling, so a homework title containing "|"
// can't break the parse. A link with no evidence behind it stays plain text.
function renderCase(p: Pick, lang: Lang, seed: string): SummarySentence {
  const versions = DIGEST_SENTENCES[p.code][lang];
  const text = versions[variantIndex(seed, versions.length)];
  const vars = p.vars ?? {};
  const out: SummarySentence = [];
  const re = /\[\[(.+?)\|(\w+)\]\]/g;
  let at = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > at) out.push({ text: fill(text.slice(at, m.index), vars) });
    const ev = p.ev?.[m[2]];
    const hasItems = ev && ev.items.length > 0;
    out.push(hasItems ? { text: fill(m[1], vars), evidence: ev } : { text: fill(m[1], vars) });
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push({ text: fill(text.slice(at), vars) });
  if (out[0]) out[0] = { ...out[0], text: out[0].text.charAt(0).toUpperCase() + out[0].text.slice(1) };
  return out;
}
