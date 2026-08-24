import { supabase } from './supabase';
import { localDateStr } from './storage';
import { pickByStage } from './srs';

const INTERVALS = [1, 3, 7, 14, 30]; // days, same as personal SRS

// Grace period (days overdue) a word gets at each stage before it demotes one
// stage — indexed by stage 0-4. A fresh Stage 0 word is fragile and gets a
// generous buffer; a Stage 4 word already survived a 30-day gap once, so it
// gets proportionally less patience if that happens again. Stage 5
// (graduated) is never scheduled again, so it's exempt entirely.
const UNLEARN_GRACE_DAYS = [3, 5, 7, 10, 15];

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

// Called when a student marks a class word as learned. Inserts the SRS row
// and awards XP atomically server-side via the record_class_word_learned
// RPC (see supabase/migrations), so a tampered client can't split "insert
// the SRS row" and "award XP" into two requests and replay just the XP one
// against an already-learned word. Returns true if the word was newly
// learned (not already in class_srs_states) — same semantics as the old
// ignoreDuplicates upsert's "did this insert happen" check, but decided by
// Postgres instead of asserted by the client. Mirrors Flutter's
// recordClassWordLearned in class_srs_service.dart — keep both in sync.
export async function recordClassWordLearned(
  userId: string,
  classId: string,
  word: string,
  translation: string,
  xp: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('record_class_word_learned', {
    p_student_id: userId,
    p_class_id: classId,
    p_word: word,
    p_translation: translation,
    p_next_due: addDays(INTERVALS[0]),
    p_xp: xp,
    p_reason: 'Learn',
  });
  if (error) throw error;
  return data as boolean;
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
  const { data, error } = await supabase
    .from('class_srs_states')
    .select('id, stage, next_due')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .lt('stage', 5);
  if (error) console.error('[checkAndDemoteClassSRS]', error);
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
  const { data, error } = await supabase
    .from('class_srs_states')
    .select('*')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .lte('next_due', todayStr())
    .lt('stage', 5);
  if (error) console.error('[getClassDueWords]', error);
  return (data ?? []) as ClassSRSEntry[];
}

// Returns every SRS entry for the student in this class (all stages).
export async function getClassSRSAll(
  userId: string,
  classId: string,
): Promise<ClassSRSEntry[]> {
  const { data, error } = await supabase
    .from('class_srs_states')
    .select('*')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .order('created_at', { ascending: true });
  if (error) console.error('[getClassSRSAll]', error);
  return (data ?? []) as ClassSRSEntry[];
}

// Called after the student answers a review card.
// knew=true → advance stage; knew=false → drop stage (min 0).
//
// Atomic server-side read-modify-write (advance_class_srs_word RPC) — a
// client-side select-then-update let two near-simultaneous calls (a
// double-tap) both read the same starting stage and silently lose one
// advance. See supabase/migrations/20260820_advance_class_srs_word.sql.
export async function advanceClassSRSWord(
  userId: string,
  classId: string,
  word: string,
  knew: boolean,
): Promise<void> {
  await supabase.rpc('advance_class_srs_word', {
    p_user_id: userId,
    p_class_id: classId,
    p_word: word,
    p_knew: knew,
  });
}

// Teacher view: all students' SRS states for a class.
export async function getClassSRSForTeacher(
  classId: string,
): Promise<ClassSRSEntry[]> {
  const { data, error } = await supabase
    .from('class_srs_states')
    .select('*')
    .eq('class_id', classId);
  if (error) console.error('[getClassSRSForTeacher]', error);
  return (data ?? []) as ClassSRSEntry[];
}

// ── Starred words ─────────────────────────────────────────────────────────────

export async function getClassStarredWordIds(userId: string, classId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('class_starred_words')
    .select('word')
    .eq('user_id', userId)
    .eq('class_id', classId);
  if (error) console.error('[getClassStarredWordIds]', error);
  return new Set((data ?? []).map((r: { word: string }) => r.word));
}

export async function addClassStarredWord(userId: string, classId: string, word: string): Promise<void> {
  const { error } = await supabase.from('class_starred_words').upsert(
    { user_id: userId, class_id: classId, word },
    { onConflict: 'user_id,class_id,word', ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function removeClassStarredWord(userId: string, classId: string, word: string): Promise<void> {
  const { error } = await supabase.from('class_starred_words').delete()
    .eq('user_id', userId).eq('class_id', classId).eq('word', word);
  if (error) throw error;
}

// ── Hard words ────────────────────────────────────────────────────────────────

export async function getClassHardWordIds(userId: string, classId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('class_hard_words')
    .select('word')
    .eq('user_id', userId)
    .eq('class_id', classId);
  if (error) console.error('[getClassHardWordIds]', error);
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
  const { data, error } = await supabase
    .from('class_words')
    .select('id, word, translation, definition, example1, example1_translation, example2, example2_translation, examples')
    .eq('class_id', classId)
    .order('created_at', { ascending: true });
  if (error) console.error('[getClassWordsFull]', error);
  return (data ?? []) as ClassWordRaw[];
}

// Re-exported from lib/srs.ts rather than duplicated — both surfaces use
// identical wording for these labels.
export { stageLabel } from './srs';

// Deliberately a different palette from lib/srs.ts's personal-SRS
// stageColor (which uses the app's shared ACCENT colors) — class review
// keeps its own fixed palette. Only the duplicated clamp-and-index logic
// (pickByStage) is shared; the color choices themselves are not.
export function stageColor(stage: number): string {
  return pickByStage(stage, ['#9CA3AF', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981']);
}
