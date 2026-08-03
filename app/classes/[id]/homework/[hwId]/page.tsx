'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { saveClassHWTemp } from '@/lib/storage';
import type { ClassHWWord } from '@/lib/storage';

interface UnitWord {
  word: string;
  translation: string;
  definition: string | null;
  examples: { sentence: string; translation: string }[];
}

const MODE_ICON: Record<string, string> = { learn: '📖', flashcard: '🃏', quiz: '🧠', match: '🎯' };
const MODE_LABEL: Record<string, string> = { learn: 'Learn', flashcard: 'Flashcard', quiz: 'Quiz', match: 'Match' };
const MODE_DESC: Record<string, string> = {
  learn: 'Study each word with examples',
  flashcard: 'Flip through cards',
  quiz: 'Test your knowledge',
  match: 'Match words to translations',
};

function dueLabel(due: string | null): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (due < today) return { text: `Overdue · ${due}`, overdue: true };
  if (due === today) return { text: 'Due today', overdue: false };
  if (due === tomorrow) return { text: 'Due tomorrow', overdue: false };
  return { text: `Due ${due}`, overdue: false };
}

export default function UnitStudyHubPage() {
  const { hwId } = useParams<{ id: string; hwId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [unitName, setUnitName] = useState('');
  const [modes, setModes] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [words, setWords] = useState<UnitWord[]>([]);
  const [completedModes, setCompletedModes] = useState<Set<string>>(new Set());
  const [navigating, setNavigating] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, hwId]);

  async function load() {
    setLoading(true);
    const [hwRes, progRes] = await Promise.all([
      supabase
        .from('class_homework')
        .select('unit_id, class_unit_id, modes, due_date, student_ids, teacher_units(name), class_word_units(name)')
        .eq('id', hwId)
        .single(),
      supabase
        .from('class_homework_progress')
        .select('mode')
        .eq('homework_id', hwId)
        .eq('student_id', user!.id),
    ]);

    const hw = hwRes.data;
    if (!hw) { setLoading(false); return; }

    const unitId = hw.unit_id as string | null;
    const classUnitId = hw.class_unit_id as string | null;
    const isClassWords = classUnitId != null;
    const name = isClassWords
      ? ((hw.class_word_units as any)?.name ?? '')
      : ((hw.teacher_units as any)?.name ?? '');
    const hwModes = (hw.modes as string[]) ?? [];
    const due = hw.due_date as string | null;

    const wordsRes = isClassWords
      ? await supabase
          .from('class_words')
          .select('word, translation, definition, examples')
          .eq('unit_id', classUnitId!)
          .order('created_at')
      : await supabase
          .from('teacher_unit_words')
          .select('word, translation, definition, examples')
          .eq('unit_id', unitId!)
          .order('created_at');

    const unitWords: UnitWord[] = ((wordsRes.data as any[]) ?? []).map(w => ({
      word: w.word,
      translation: w.translation,
      definition: w.definition ?? null,
      examples: (w.examples ?? []) as { sentence: string; translation: string }[],
    }));

    const done = new Set((progRes.data ?? []).map((p: any) => p.mode as string));

    setUnitName(name);
    setModes(hwModes);
    setDueDate(due);
    setWords(unitWords);
    setCompletedModes(done);
    setLoading(false);
  }

  async function startMode(mode: string) {
    if (words.length === 0 || navigating) return;
    setNavigating(mode);

    const hwWords: ClassHWWord[] = words.map(w => ({
      word: w.word,
      translation: w.translation,
      definition: w.definition ?? '',
      example1: w.examples[0]?.sentence ?? '',
      example1Translation: w.examples[0]?.translation ?? '',
      example2: w.examples[1]?.sentence ?? '',
      example2Translation: w.examples[1]?.translation ?? '',
      className: unitName,
    }));
    saveClassHWTemp(hwWords);

    // Record progress optimistically
    try {
      await supabase.from('class_homework_progress').upsert({
        homework_id: hwId,
        student_id: user!.id,
        mode,
      }, { onConflict: 'homework_id,student_id,mode', ignoreDuplicates: true });
      setCompletedModes(prev => new Set([...prev, mode]));
    } catch (_) {}

    const encodedName = encodeURIComponent(unitName);
    const paths: Record<string, string> = {
      learn: `/learn?source=class-hw&className=${encodedName}`,
      flashcard: `/flashcards?source=class-hw&className=${encodedName}`,
      quiz: `/quiz?source=class-hw&className=${encodedName}`,
      match: `/matching?source=class-hw&className=${encodedName}`,
    };
    router.push(paths[mode] ?? '/');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const allDone = modes.length > 0 && modes.every(m => completedModes.has(m));
  const due = dueLabel(dueDate);

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className="p-4 space-y-4">

        {/* Header */}
        <div
          className="rounded-2xl p-5 text-white"
          style={{ background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 75%, transparent) 100%)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-xs font-semibold mb-1 uppercase tracking-wider">Unit Homework</p>
              <h1 className="text-xl font-black leading-tight">{unitName}</h1>
              <p className="text-white/80 text-sm mt-1">
                {words.length} word{words.length !== 1 ? 's' : ''} · {completedModes.size}/{modes.length} modes done
              </p>
            </div>
            {allDone && (
              <div className="shrink-0 bg-white/20 rounded-xl px-3 py-1.5 text-sm font-black">
                ✓ Done
              </div>
            )}
          </div>
          {due && (
            <p className={`text-xs font-semibold mt-3 ${due.overdue ? 'text-red-200' : 'text-white/70'}`}>
              {due.overdue ? '⚠️ ' : '📅 '}{due.text}
            </p>
          )}
        </div>

        {/* All done banner */}
        {allDone && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-bold text-green-700 dark:text-green-400 text-sm">All modes complete!</p>
              <p className="text-green-600 dark:text-green-500 text-xs mt-0.5">Great work on this unit.</p>
            </div>
          </div>
        )}

        {/* Mode cards */}
        <div>
          <p className="text-xs font-bold text-[var(--text-muted)] tracking-widest uppercase mb-3">Study Modes</p>
          <div className="space-y-3">
            {modes.map(mode => {
              const done = completedModes.has(mode);
              const busy = navigating === mode;
              return (
                <button
                  key={mode}
                  onClick={() => startMode(mode)}
                  disabled={!!navigating}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all disabled:opacity-60 ${
                    done
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                      : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--primary)]/50 active:scale-[0.98]'
                  }`}
                >
                  <span className="text-3xl">{MODE_ICON[mode] ?? '📖'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${done ? 'text-green-700 dark:text-green-400' : 'text-[var(--text)]'}`}>
                      {MODE_LABEL[mode] ?? mode}
                    </p>
                    <p className={`text-xs mt-0.5 ${done ? 'text-green-600 dark:text-green-500' : 'text-[var(--text-muted)]'}`}>
                      {done ? 'Completed ✓' : MODE_DESC[mode]}
                    </p>
                  </div>
                  {busy ? (
                    <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : done ? (
                    <svg className="w-5 h-5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-[var(--primary)] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Word list preview */}
        {words.length > 0 && (
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)] tracking-widest uppercase mb-3">Words in this unit</p>
            <div className="space-y-2">
              {words.map((w, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-[var(--surface)] rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[var(--text)]">{w.word}</p>
                    <p className="text-xs text-[var(--primary)] font-semibold mt-0.5">{w.translation}</p>
                  </div>
                  {w.examples.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-[var(--primary-bg)] text-[var(--primary)] shrink-0">
                      {w.examples.length}ex
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
