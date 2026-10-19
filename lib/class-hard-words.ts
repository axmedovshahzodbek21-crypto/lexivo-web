// Teacher-side Hard words archive: words the teacher has taught in class
// (class_hard_word_archive) and whether each student still finds them hard,
// read from their review answers since the word was taught.
// Rule (agreed with the founder): 2 correct reviews in a row after it was
// taught = no longer hard; a wrong answer since = hard again, back on the
// to-teach list. Students' own Hard lists are never changed.
import { supabase } from '@/lib/supabase';

export type StudentWordStatus = 'learned' | 'one' | 'none' | 'again';
export type WordState = 'todo' | 'again' | 'watching' | 'learned';

export interface ArchivedWord {
  taughtAt: string;
  state: Exclude<WordState, 'todo'>;
  perStudent: Record<string, StudentWordStatus>;
}

interface ReviewAnswer { user_id: string; word: string; knew: boolean; created_at: string; }

function studentStatus(answers: ReviewAnswer[]): StudentWordStatus {
  if (answers.length === 0) return 'none';
  const last = answers[answers.length - 1];
  if (!last.knew) return 'again';
  return answers.length >= 2 && answers[answers.length - 2].knew ? 'learned' : 'one';
}

// `students` = word → ids of approved students who currently have it on
// their Hard list. Returns only the archived words.
export async function loadArchiveStates(
  classId: string,
  students: Map<string, string[]>,
): Promise<Map<string, ArchivedWord>> {
  const { data: archive } = await supabase
    .from('class_hard_word_archive')
    .select('word, taught_at')
    .eq('class_id', classId);
  const rows = (archive ?? []) as { word: string; taught_at: string }[];
  const out = new Map<string, ArchivedWord>();
  if (rows.length === 0) return out;

  const since = rows.reduce((min, r) => (r.taught_at < min ? r.taught_at : min), rows[0].taught_at);
  const { data: events } = await supabase
    .from('class_review_events')
    .select('user_id, word, knew, created_at')
    .eq('class_id', classId)
    .in('word', rows.map(r => r.word))
    .gte('created_at', since)
    .order('created_at', { ascending: true });
  const answers = (events ?? []) as ReviewAnswer[];

  for (const r of rows) {
    const taught = new Date(r.taught_at).getTime();
    const perStudent: Record<string, StudentWordStatus> = {};
    for (const sid of students.get(r.word) ?? []) {
      perStudent[sid] = studentStatus(answers.filter(a =>
        a.user_id === sid && a.word === r.word && new Date(a.created_at).getTime() > taught));
    }
    const statuses = Object.values(perStudent);
    const state = statuses.includes('again') ? 'again'
      : statuses.every(s => s === 'learned') ? 'learned' : 'watching';
    out.set(r.word, { taughtAt: r.taught_at, state, perStudent });
  }
  return out;
}

// Archiving again (a word that became hard again) restarts the count from now.
export async function archiveHardWord(classId: string, word: string): Promise<boolean> {
  const { error } = await supabase
    .from('class_hard_word_archive')
    .upsert({ class_id: classId, word, taught_at: new Date().toISOString() }, { onConflict: 'class_id,word' });
  if (error) console.error('[archiveHardWord]', error);
  return !error;
}

export async function unarchiveHardWord(classId: string, word: string): Promise<boolean> {
  const { error } = await supabase.from('class_hard_word_archive').delete().eq('class_id', classId).eq('word', word);
  if (error) console.error('[unarchiveHardWord]', error);
  return !error;
}
