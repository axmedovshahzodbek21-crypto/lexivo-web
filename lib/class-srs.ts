import { supabase } from './supabase';

const INTERVALS = [1, 3, 7, 14, 30]; // days, same as personal SRS

// Grace period (days overdue) a word gets at each stage before it demotes one
// stage — indexed by stage 0-4. A fresh Stage 0 word is fragile and gets a
// generous buffer; a Stage 4 word already survived a 30-day gap once, so it
// gets proportionally less patience if that happens again. Stage 5
// (graduated) is never scheduled again, so it's exempt entirely.
const UNLEARN_GRACE_DAYS = [3, 5, 7, 10, 15];

// Consecutive "Not Yet" answers allowed at Stage 0 (the floor advanceClassSRSWord's
// Math.max already prevents demoting past) before the word unlearns outright.
// Active, repeated failure is stronger evidence than a skipped day, so this is
// checked independently of — and resolves faster than — the day-based cascade.
const FAIL_STREAK_LIMIT = 3;

export interface ClassSRSEntry {
  id: string;
  user_id: string;
  class_id: string;
  word: string;
  translation: string;
  stage: number; // 0=new … 4=last interval … 5=graduated
  next_due: string; // YYYY-MM-DD
  last_reviewed: string | null;
  created_at: string;
  fail_streak: number;
}

// Local date (not UTC) — matches the personal SRS system's localDateStr()
// in lib/storage.ts and Flutter's DateTime.now()-based date math. Using
// toISOString() here previously computed "today" in UTC while everything
// else in the app (including the shared class_srs_states table written to
// by Flutter) uses local time, causing an off-by-one-day mismatch for
// users ahead of UTC and for anyone using both web and Flutter.
function localDateStr(d: Date): string {
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD in the user's local timezone
}

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

function todayStr(): string {
  return localDateStr(new Date());
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const a = new Date(fromDateStr + 'T00:00:00');
  const b = new Date(toDateStr + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// Called when a student marks a class word as learned.
// Uses ignoreDuplicates so re-learning doesn't reset an existing SRS stage.
export async function initClassSRSWord(
  userId: string,
  classId: string,
  word: string,
  translation: string,
): Promise<void> {
  await supabase.from('class_srs_states').upsert(
    {
      user_id: userId,
      class_id: classId,
      word,
      translation,
      stage: 0,
      next_due: addDays(INTERVALS[0]),
    },
    { onConflict: 'user_id,class_id,word', ignoreDuplicates: true },
  );
}

// Cascades every overdue, non-graduated word for this student down through
// UNLEARN_GRACE_DAYS one stage at a time, resolving a long absence in a single
// pass rather than needing a check every day the gap grows. A word that falls
// through Stage 0's own grace window is unlearned (deleted) outright — same
// hard-reset behavior as the fail-streak path in advanceClassSRSWord, and as
// personal SRS's existing checkAndUnlearn.
export async function checkAndDemoteClassSRS(
  userId: string,
  classId: string,
): Promise<void> {
  const { data } = await supabase
    .from('class_srs_states')
    .select('id, stage, next_due')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .lt('stage', 5);
  const rows = (data ?? []) as { id: string; stage: number; next_due: string }[];
  if (rows.length === 0) return;

  const today = todayStr();
  const toDelete: string[] = [];
  const toUpdate: { id: string; stage: number; next_due: string }[] = [];

  for (const row of rows) {
    let stage = row.stage;
    let nextDue = row.next_due;
    let changed = false;

    while (stage > 0 && daysBetween(nextDue, today) >= UNLEARN_GRACE_DAYS[stage]) {
      nextDue = addDaysToDateStr(nextDue, UNLEARN_GRACE_DAYS[stage]);
      stage -= 1;
      changed = true;
    }
    if (stage === 0 && daysBetween(nextDue, today) >= UNLEARN_GRACE_DAYS[0]) {
      toDelete.push(row.id);
      continue;
    }
    if (changed) toUpdate.push({ id: row.id, stage, next_due: nextDue });
  }

  await Promise.all([
    ...toUpdate.map(u => supabase.from('class_srs_states').update({ stage: u.stage, next_due: u.next_due, fail_streak: 0 }).eq('id', u.id)),
    toDelete.length > 0 ? supabase.from('class_srs_states').delete().in('id', toDelete) : Promise.resolve(),
  ]);
}

// Returns all words due for review today (or overdue) for this student in this class.
export async function getClassDueWords(
  userId: string,
  classId: string,
): Promise<ClassSRSEntry[]> {
  await checkAndDemoteClassSRS(userId, classId);
  const { data } = await supabase
    .from('class_srs_states')
    .select('*')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .lte('next_due', todayStr())
    .lt('stage', 5);
  return (data ?? []) as ClassSRSEntry[];
}

// Returns every SRS entry for the student in this class (all stages).
export async function getClassSRSAll(
  userId: string,
  classId: string,
): Promise<ClassSRSEntry[]> {
  const { data } = await supabase
    .from('class_srs_states')
    .select('*')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .order('created_at', { ascending: true });
  return (data ?? []) as ClassSRSEntry[];
}

// Called after the student answers a review card.
// knew=true → advance stage; knew=false → drop stage (min 0).
export async function advanceClassSRSWord(
  userId: string,
  classId: string,
  word: string,
  knew: boolean,
): Promise<void> {
  const { data } = await supabase
    .from('class_srs_states')
    .select('id, stage, fail_streak')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .eq('word', word)
    .single();

  if (!data) return;
  const { id, stage: current, fail_streak: currentStreak } = data as { id: string; stage: number; fail_streak: number };

  // Repeated failure at the Stage 0 floor is stronger evidence the word isn't
  // known than a skipped day is — resolve it immediately rather than looping
  // the same 1-day reset forever.
  if (!knew && current === 0 && currentStreak + 1 >= FAIL_STREAK_LIMIT) {
    await supabase.from('class_srs_states').delete().eq('id', id);
    return;
  }

  const next = knew ? Math.min(current + 1, 5) : Math.max(current - 1, 0);
  const interval = next >= 5 ? 36500 : INTERVALS[next]; // graduated → far future
  const nextStreak = knew ? 0 : (next === 0 ? currentStreak + 1 : 0);

  await supabase
    .from('class_srs_states')
    .update({
      stage: next,
      next_due: addDays(interval),
      last_reviewed: new Date().toISOString(),
      fail_streak: nextStreak,
    })
    .eq('id', id);
}

// Teacher view: all students' SRS states for a class.
export async function getClassSRSForTeacher(
  classId: string,
): Promise<ClassSRSEntry[]> {
  const { data } = await supabase
    .from('class_srs_states')
    .select('*')
    .eq('class_id', classId);
  return (data ?? []) as ClassSRSEntry[];
}

// ── Starred words ─────────────────────────────────────────────────────────────

export async function getClassStarredWordIds(userId: string, classId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('class_starred_words')
    .select('word')
    .eq('user_id', userId)
    .eq('class_id', classId);
  return new Set((data ?? []).map((r: { word: string }) => r.word));
}

export async function addClassStarredWord(userId: string, classId: string, word: string): Promise<void> {
  await supabase.from('class_starred_words').upsert(
    { user_id: userId, class_id: classId, word },
    { onConflict: 'user_id,class_id,word', ignoreDuplicates: true },
  );
}

export async function removeClassStarredWord(userId: string, classId: string, word: string): Promise<void> {
  await supabase.from('class_starred_words').delete()
    .eq('user_id', userId).eq('class_id', classId).eq('word', word);
}

// ── Hard words ────────────────────────────────────────────────────────────────

export async function getClassHardWordIds(userId: string, classId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('class_hard_words')
    .select('word')
    .eq('user_id', userId)
    .eq('class_id', classId);
  return new Set((data ?? []).map((r: { word: string }) => r.word));
}

export async function addClassHardWord(userId: string, classId: string, word: string): Promise<void> {
  await supabase.from('class_hard_words').upsert(
    { user_id: userId, class_id: classId, word },
    { onConflict: 'user_id,class_id,word', ignoreDuplicates: true },
  );
}

// ── Raw class word shape returned from Supabase (used by study-mode pages) ───
export interface ClassWordRaw {
  id: string;
  word: string;
  translation: string;
  definition: string | null;
  example1: string | null;
  example1_translation: string | null;
  example2: string | null;
  example2_translation: string | null;
  examples: Array<{ sentence: string; translation: string }> | null;
}

export async function getClassWordsFull(classId: string): Promise<ClassWordRaw[]> {
  const { data } = await supabase
    .from('class_words')
    .select('id, word, translation, definition, example1, example1_translation, example2, example2_translation, examples')
    .eq('class_id', classId)
    .order('created_at', { ascending: true });
  return (data ?? []) as ClassWordRaw[];
}

export function stageLabel(stage: number): string {
  return ['New', '+1 done', '+3 done', '+7 done', '+14 done', 'Graduated'][Math.min(stage, 5)];
}

export function stageColor(stage: number): string {
  return ['#9CA3AF', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981'][Math.min(stage, 5)];
}
