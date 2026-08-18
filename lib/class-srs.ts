import { supabase } from './supabase';

const INTERVALS = [1, 3, 7, 14, 30]; // days, same as personal SRS

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

// Returns all words due for review today (or overdue) for this student in this class.
export async function getClassDueWords(
  userId: string,
  classId: string,
): Promise<ClassSRSEntry[]> {
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
    .select('stage')
    .eq('user_id', userId)
    .eq('class_id', classId)
    .eq('word', word)
    .single();

  if (!data) return;
  const current = (data as { stage: number }).stage;
  const next = knew ? Math.min(current + 1, 5) : Math.max(current - 1, 0);
  const interval = next >= 5 ? 36500 : INTERVALS[next]; // graduated → far future

  await supabase
    .from('class_srs_states')
    .update({
      stage: next,
      next_due: addDays(interval),
      last_reviewed: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('class_id', classId)
    .eq('word', word);
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
