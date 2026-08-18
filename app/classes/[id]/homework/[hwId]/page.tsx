'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { saveClassHWTemp } from '@/lib/storage';
import type { ClassHWWord } from '@/lib/storage';
import { recordClassXP } from '@/lib/class-xp';
import { loadCollections, loadCEFRCollection } from '@/lib/data';
import type { WordCollection } from '@/lib/types';
import { readingPassages, type ReadingPassage } from '@/lib/reading-data';

async function fetchCollectionByName(name: string): Promise<WordCollection | null> {
  if (name === '30 Days of Powerful Words') { const c = await loadCollections(); return c[0] ?? null; }
  if (name === '24 Vocabulary Challenge')   { const c = await loadCollections(); return c[1] ?? null; }
  if (name === 'Word Mastery')              { const c = await loadCollections(); return c[2] ?? null; }
  const lvl = ({ A1: 'a1', A2: 'a2', B1: 'b1' } as Record<string, 'a1'|'a2'|'b1'>)[name];
  return lvl ? loadCEFRCollection(lvl) : null;
}

interface UnitWord {
  word: string;
  translation: string;
  definition: string | null;
  partOfSpeech: string | null;
  pronunciation: string | null;
  definitionUz: string | null;
  examples: { sentence: string; translation: string }[];
}

const MODE_ICON: Record<string, string> = { learn: '📖', flashcard: '🃏', quiz: '❓', match: '🎯' };
const MODE_LABEL: Record<string, string> = { learn: 'Learn', flashcard: 'Cards', quiz: 'Quiz', match: 'Match' };
const MODE_COLOR: Record<string, string> = { learn: '#4f46e5', flashcard: '#ea580c', quiz: '#d97706', match: '#db2777' };

function dueLabel(due: string | null): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (due < today) return { text: `Overdue · ${due}`, overdue: true };
  if (due === today) return { text: 'Due today', overdue: false };
  if (due === tomorrow) return { text: 'Due tomorrow', overdue: false };
  return { text: `Due ${due}`, overdue: false };
}

type HWMeta = { unitName: string; modes: string[]; dueDate: string | null; words: UnitWord[]; passage: ReadingPassage | null };
const _hwCache = new Map<string, HWMeta>();
const PASSAGE_XP = 15;

export default function UnitStudyHubPage() {
  const { id: classId, hwId } = useParams<{ id: string; hwId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState('');
  const [unitName, setUnitName] = useState('');
  const [modes, setModes] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [words, setWords] = useState<UnitWord[]>([]);
  const [passage, setPassage] = useState<ReadingPassage | null>(null);
  const [markingRead, setMarkingRead] = useState(false);
  const [completedModes, setCompletedModes] = useState<Set<string>>(new Set());
  const [navigating, setNavigating] = useState<string | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, hwId]);

  // Support ?mode=learn deep-links (e.g. from the collection unit grid) that
  // jump straight into a mode instead of landing on this page first.
  useEffect(() => {
    if (loading || autoStartedRef.current || words.length === 0) return;
    const autoMode = searchParams.get('mode');
    if (autoMode && modes.includes(autoMode)) {
      autoStartedRef.current = true;
      router.replace(`/classes/${classId}/homework/${hwId}`);
      startMode(autoMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, words, modes]);

  // Handle ?completed=mode (and ?alsoCompleted=mode) set by study pages when a session finishes.
  // This is how we record progress without marking it prematurely in startMode().
  useEffect(() => {
    const completed = searchParams.get('completed');
    if (!completed || !user) return;
    const alsoCompleted = searchParams.get('alsoCompleted');
    const modesToRecord = [completed, ...(alsoCompleted ? [alsoCompleted] : [])];
    const MODE_XP: Record<string, number> = { learn: 10, flashcard: 3, quiz: 5, match: 4 };
    const MODE_REASON: Record<string, string> = { learn: 'Learn', flashcard: 'Cards', quiz: 'Quiz', match: 'Match' };
    router.replace(`/classes/${classId}/homework/${hwId}`);
    void (async () => {
      const wordCount = _hwCache.get(hwId)?.words.length ?? words.length;
      for (const mode of modesToRecord) {
        const { data: existing } = await supabase.from('class_homework_progress').select('mode')
          .eq('homework_id', hwId).eq('student_id', user.id).eq('mode', mode).maybeSingle();
        if (!existing) {
          const { error } = await supabase.from('class_homework_progress').insert({
            homework_id: hwId, student_id: user.id, mode,
          });
          if (!error) void recordClassXP(user.id, classId, wordCount * (MODE_XP[mode] ?? 3), MODE_REASON[mode] ?? mode);
        }
      }
      setCompletedModes(prev => new Set([...prev, ...modesToRecord]));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user]);

  async function load() {
    const cached = _hwCache.get(hwId);
    if (cached) {
      setUnitName(cached.unitName);
      setModes(cached.modes);
      setDueDate(cached.dueDate);
      setWords(cached.words);
      setPassage(cached.passage);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // Always fetch progress fresh; fetch metadata only if not cached
    const [hwRes, progRes, clsRes] = await Promise.all([
      cached
        ? Promise.resolve({ data: null })
        : supabase
            .from('class_homework')
            .select('unit_id, class_unit_id, collection_name, day_number, passage_id, modes, due_date, student_ids, teacher_units(name), class_word_units(name)')
            .eq('id', hwId)
            .single(),
      supabase
        .from('class_homework_progress')
        .select('mode')
        .eq('homework_id', hwId)
        .eq('student_id', user!.id),
      supabase.from('classes').select('name').eq('id', classId).maybeSingle(),
    ]);
    setClassName((clsRes.data as any)?.name ?? '');

    const done = new Set((progRes.data ?? []).map((p: any) => p.mode as string));
    setCompletedModes(done);

    if (cached) { setLoading(false); return; }

    const hw = hwRes.data;
    if (!hw) { setLoading(false); return; }

    const passageId = hw.passage_id as number | null;
    if (passageId != null) {
      const found = readingPassages.find(p => p.id === passageId) ?? null;
      _hwCache.set(hwId, { unitName: found?.title ?? 'Reading Passage', modes: (hw.modes as string[]) ?? ['read'], dueDate: hw.due_date as string | null, words: [], passage: found });
      setUnitName(found?.title ?? 'Reading Passage');
      setModes((hw.modes as string[]) ?? ['read']);
      setDueDate(hw.due_date as string | null);
      setWords([]);
      setPassage(found);
      setLoading(false);
      return;
    }

    const unitId = hw.unit_id as string | null;
    const classUnitId = hw.class_unit_id as string | null;
    const collectionName = hw.collection_name as string | null;
    const dayNumber = hw.day_number as number | null;
    const isClassWords = classUnitId != null;
    const isCollection = collectionName != null;
    const hwModes = (hw.modes as string[]) ?? [];
    const due = hw.due_date as string | null;

    let name = '';
    let unitWords: UnitWord[] = [];

    if (isCollection) {
      name = `${collectionName} · Day ${dayNumber}`;
      const col = await fetchCollectionByName(collectionName!);
      const day = col?.days.find(d => d.dayNumber === dayNumber);
      unitWords = (day?.words ?? []).map(w => ({
        word: w.word,
        translation: w.translation,
        definition: w.definition ?? null,
        partOfSpeech: w.partOfSpeech ?? null,
        pronunciation: w.pronunciation ?? null,
        definitionUz: w.definitionUz ?? null,
        examples: [
          { sentence: w.example1, translation: w.example1Translation ?? '' },
          { sentence: w.example2, translation: w.example2Translation ?? '' },
          ...(w.example3 ? [{ sentence: w.example3, translation: w.example3Translation ?? '' }] : []),
          ...(w.extraExamples ?? []).map((ex: string, i: number) => ({ sentence: ex, translation: (w.extraExampleTranslations ?? [])[i] ?? '' })),
        ].filter(e => e.sentence) as { sentence: string; translation: string }[],
      }));
    } else {
      name = isClassWords
        ? ((hw.class_word_units as any)?.name ?? '')
        : ((hw.teacher_units as any)?.name ?? '');
      const wordsRes = isClassWords
        ? await supabase
            .from('class_words')
            .select('word, translation, definition, examples')
            .eq('unit_id', classUnitId!)
            .order('created_at')
        : await supabase
            .from('teacher_unit_words')
            .select('word, translation, definition, part_of_speech, pronunciation, definition_uz, examples')
            .eq('unit_id', unitId!)
            .order('created_at');
      unitWords = ((wordsRes.data as any[]) ?? []).map(w => ({
        word: w.word,
        translation: w.translation,
        definition: w.definition ?? null,
        partOfSpeech: w.part_of_speech ?? null,
        pronunciation: w.pronunciation ?? null,
        definitionUz: w.definition_uz ?? null,
        examples: (w.examples ?? []) as { sentence: string; translation: string }[],
      }));
    }

    _hwCache.set(hwId, { unitName: name, modes: hwModes, dueDate: due, words: unitWords, passage: null });
    setUnitName(name);
    setModes(hwModes);
    setDueDate(due);
    setWords(unitWords);
    setPassage(null);
    setLoading(false);
  }

  async function startMode(mode: string) {
    if (words.length === 0 || navigating) return;
    setNavigating(mode);

    const hwWords: ClassHWWord[] = words.map(w => ({
      word: w.word,
      translation: w.translation,
      definition: w.definition ?? '',
      partOfSpeech: w.partOfSpeech ?? '',
      pronunciation: w.pronunciation ?? '',
      definitionUz: w.definitionUz ?? '',
      example1: w.examples[0]?.sentence ?? '',
      example1Translation: w.examples[0]?.translation ?? '',
      example2: w.examples[1]?.sentence ?? '',
      example2Translation: w.examples[1]?.translation ?? '',
      example3: w.examples[2]?.sentence ?? '',
      example3Translation: w.examples[2]?.translation ?? '',
      extraExamples: w.examples.slice(3).map(e => e.sentence),
      extraExampleTranslations: w.examples.slice(3).map(e => e.translation),
      className: unitName,
    }));
    saveClassHWTemp(hwWords);

    const encodedName = encodeURIComponent(unitName);
    const hwBack = `/classes/${classId}/homework/${hwId}`;
    const paths: Record<string, string> = {
      learn: `/learn?source=class-hw&className=${encodedName}&classId=${classId}&hwId=${hwId}`,
      flashcard: `/flashcards?source=class-hw&className=${encodedName}&classId=${classId}&hwId=${hwId}`,
      quiz: `/quiz?source=class-hw&className=${encodedName}&classId=${classId}&hwId=${hwId}`,
      match: `/matching?source=class-hw&className=${encodedName}&classId=${classId}&hwId=${hwId}`,
    };
    router.push(paths[mode] ?? hwBack);
  }

  async function markPassageRead() {
    if (!user || markingRead || completedModes.has('read')) return;
    setMarkingRead(true);
    try {
      const { data: existing } = await supabase.from('class_homework_progress').select('mode')
        .eq('homework_id', hwId).eq('student_id', user.id).eq('mode', 'read').maybeSingle();
      if (!existing) {
        const { error } = await supabase.from('class_homework_progress').insert({
          homework_id: hwId, student_id: user.id, mode: 'read',
        });
        if (error) { setProgressError(error.message); setMarkingRead(false); return; }
        void recordClassXP(user.id, classId, PASSAGE_XP, 'Reading');
      }
      setCompletedModes(prev => new Set([...prev, 'read']));
    } finally {
      setMarkingRead(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (passage) {
    const passageDone = completedModes.has('read');
    const passageDue = dueLabel(dueDate);
    return (
      <div className="flex flex-col min-h-screen animate-fade-in pb-24">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <button onClick={() => router.push(`/classes/${classId}/homework`)} className="btn-icon">←</button>
          <div className="min-w-0">
            {className && <p className="text-xs text-[var(--text-muted)] font-medium truncate">{className}</p>}
            <p className="font-bold text-[var(--text)] text-sm truncate">{passage.title}</p>
          </div>
        </div>
        <div className="p-3 space-y-3">
          {progressError && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-start gap-2.5">
              <span className="text-lg shrink-0">⚠️</span>
              <div>
                <p className="font-bold text-red-700 dark:text-red-400 text-xs">Couldn&apos;t save progress</p>
                <p className="text-red-600 dark:text-red-500 text-[11px] mt-0.5 break-all">{progressError}</p>
              </div>
            </div>
          )}

          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: 'var(--surface)',
              border: passageDone ? '1.5px solid #22c55e' : '1.5px solid var(--border)',
            }}
          >
            <div className="h-1" style={{ background: passageDone ? '#22c55e' : 'linear-gradient(135deg, #F59E0B, #ea580c)' }} />
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full text-white" style={{ background: passageDone ? '#22c55e' : '#F59E0B' }}>
                  📚 Reading
                </span>
                <span className="text-[9px] text-[var(--text-muted)]">{passage.topic}</span>
                {passageDone && <span className="text-[9px] font-bold text-green-500">✓ Done</span>}
                {passageDue && (
                  <span className={`text-[9px] font-semibold ${passageDue.overdue ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>
                    {passageDue.overdue ? '⚠️ ' : '📅 '}{passageDue.text}
                  </span>
                )}
              </div>
              <div className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-line" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                {passage.content}
              </div>
              <button
                onClick={markPassageRead}
                disabled={markingRead || passageDone}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:active:scale-100"
                style={passageDone
                  ? { background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.35)', color: '#16a34a' }
                  : { background: 'linear-gradient(135deg, #F59E0B, #ea580c)', color: 'white' }}
              >
                {passageDone ? '✓ Marked as read' : markingRead ? 'Saving…' : 'Mark as Read ✓'}
              </button>
            </div>
          </div>

          {passageDone && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-2.5 flex items-center gap-2">
              <span className="text-lg">🎉</span>
              <div>
                <p className="font-bold text-green-700 dark:text-green-400 text-xs">Nice work!</p>
                <p className="text-green-600 dark:text-green-500 text-[10px] mt-0.5">You&apos;ve completed this reading assignment.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const allDone = modes.length > 0 && modes.every(m => completedModes.has(m));
  const due = dueLabel(dueDate);
  const nonMatchModes = modes.filter(m => m !== 'match');
  const hasMatch = modes.includes('match');
  const progressPct = modes.length > 0 ? (completedModes.size / modes.length) * 100 : 0;
  const learnAssigned = modes.includes('learn');
  const learnDone = completedModes.has('learn');
  const gatedByLearn = (mode: string) => mode !== 'learn' && learnAssigned && !learnDone;
  const nextMode = modes.find(m => !completedModes.has(m)) ?? null;
  const skipMode = nextMode ? (modes.find(m => !completedModes.has(m) && m !== nextMode) ?? null) : null;

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button onClick={() => router.push(`/classes/${classId}/homework`)} className="btn-icon">←</button>
        <div className="min-w-0">
          {className && <p className="text-xs text-[var(--text-muted)] font-medium truncate">{className}</p>}
          <p className="font-bold text-[var(--text)] text-sm truncate">{unitName || 'Homework'}</p>
        </div>
      </div>
      <div className="p-3 space-y-3">

        {progressError && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-start gap-2.5">
            <span className="text-lg shrink-0">⚠️</span>
            <div>
              <p className="font-bold text-red-700 dark:text-red-400 text-xs">Couldn&apos;t save progress</p>
              <p className="text-red-600 dark:text-red-500 text-[11px] mt-0.5 break-all">{progressError}</p>
            </div>
          </div>
        )}

        {/* Unit card */}
        <div
          className="rounded-xl overflow-hidden flex flex-col"
          style={{
            background: 'var(--surface)',
            border: allDone ? '1.5px solid #22c55e' : '1.5px solid var(--border)',
            boxShadow: allDone
              ? '0 0 0 2px rgba(34,197,94,0.1), 0 2px 10px rgba(0,0,0,0.06)'
              : '0 2px 10px rgba(0,0,0,0.06)',
          }}
        >
          <div
            className="h-1"
            style={{ background: allDone ? '#22c55e' : 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 75%, transparent) 100%)' }}
          />

          <div className="p-3 flex flex-col gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span
                  className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full text-white"
                  style={{ background: allDone ? '#22c55e' : 'var(--primary)' }}
                >
                  Unit Homework
                </span>
                <span className="text-[9px] text-[var(--text-muted)]">{words.length} word{words.length !== 1 ? 's' : ''}</span>
                {allDone && <span className="text-[9px] font-bold text-green-500">✓ Done</span>}
                {due && (
                  <span className={`text-[9px] font-semibold ${due.overdue ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>
                    {due.overdue ? '⚠️ ' : '📅 '}{due.text}
                  </span>
                )}
              </div>
              <h1 className="font-bold text-[var(--text)] text-sm leading-tight">{unitName}</h1>
            </div>

            {/* Progress bar */}
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  background: allDone ? '#22c55e' : 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 75%, transparent) 100%)',
                }}
              />
            </div>
            <p className="text-[9px] text-[var(--text-muted)] -mt-1.5">{completedModes.size}/{modes.length} modes done</p>

            {/* Mode buttons */}
            {nonMatchModes.length > 0 && (
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${nonMatchModes.length}, minmax(0, 1fr))` }}>
                {nonMatchModes.map(mode => (
                  <HWModeButton
                    key={mode}
                    mode={mode}
                    done={completedModes.has(mode)}
                    busy={navigating === mode}
                    disabled={!!navigating}
                    locked={gatedByLearn(mode)}
                    onClick={() => startMode(mode)}
                  />
                ))}
              </div>
            )}
            {hasMatch && (
              <HWModeButton
                mode="match"
                done={completedModes.has('match')}
                busy={navigating === 'match'}
                disabled={!!navigating}
                locked={gatedByLearn('match')}
                onClick={() => startMode('match')}
                wide
              />
            )}
          </div>
        </div>

        {/* All done banner */}
        {allDone && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-2.5 flex items-center gap-2">
            <span className="text-lg">🎉</span>
            <div>
              <p className="font-bold text-green-700 dark:text-green-400 text-xs">All modes complete!</p>
              <p className="text-green-600 dark:text-green-500 text-[10px] mt-0.5">Great work on this unit.</p>
            </div>
          </div>
        )}

        {/* Recommended next step */}
        {!allDone && nextMode && completedModes.size > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase">Recommended next step</p>
            <button
              onClick={() => startMode(nextMode)}
              disabled={!!navigating || gatedByLearn(nextMode)}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[0.98] disabled:opacity-60"
              style={{
                background: 'var(--surface)',
                border: `2px solid ${MODE_COLOR[nextMode] ?? 'var(--primary)'}`,
                boxShadow: `0 0 0 3px ${(MODE_COLOR[nextMode] ?? 'var(--primary)') + '22'}`,
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base"
                style={{ background: MODE_COLOR[nextMode] ?? 'var(--primary)' }}
              >
                {navigating === nextMode
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <span>{MODE_ICON[nextMode] ?? '📖'}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[var(--text)] text-xs">{MODE_LABEL[nextMode] ?? nextMode}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{words.length} words · tap to start</p>
              </div>
              <span className="text-[var(--text-muted)] text-sm">→</span>
            </button>
            {skipMode && (
              <button
                onClick={() => startMode(skipMode)}
                disabled={!!navigating || gatedByLearn(skipMode)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'var(--surface)', border: '1.5px dashed var(--border)' }}
              >
                <span className="text-sm">{MODE_ICON[skipMode] ?? '📖'}</span>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                    Skip to {MODE_LABEL[skipMode] ?? skipMode}
                  </p>
                  <p className="text-[9px] text-[var(--text-muted)] opacity-70">You&apos;ll skip {MODE_LABEL[nextMode] ?? nextMode}</p>
                </div>
                <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Skip</span>
              </button>
            )}
          </div>
        )}

        {/* Word list preview */}
        {words.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase mb-2">Words in this unit</p>
            <div className="space-y-1.5">
              {words.map((w, i) => (
                <div key={i} className="flex items-center gap-2.5 p-2.5 bg-[var(--surface)] rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-[var(--text)]">{w.word}</p>
                    <p className="text-[11px] text-[var(--primary)] font-semibold mt-0.5">{w.translation}</p>
                  </div>
                  {w.examples.length > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[var(--primary-bg)] text-[var(--primary)] shrink-0">
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

function HWModeButton({
  mode, done, busy, disabled, onClick, wide, locked,
}: {
  mode: string; done: boolean; busy: boolean; disabled: boolean; onClick: () => void; wide?: boolean; locked?: boolean;
}) {
  const color = MODE_COLOR[mode] ?? 'var(--primary)';
  const icon = MODE_ICON[mode] ?? '📖';
  const label = MODE_LABEL[mode] ?? mode;
  const base = `flex items-center justify-center ${wide ? 'flex-row gap-1.5 py-2 px-3' : 'flex-col gap-1 py-2'} rounded-lg text-[11px] font-bold transition-all disabled:opacity-60`;

  if (locked) {
    return (
      <div
        title="Complete Learn first"
        className={`${base} cursor-not-allowed select-none`}
        style={{ background: 'var(--surface-2)', border: '1.5px dashed var(--border)', opacity: 0.4 }}
      >
        <span className={wide ? 'text-sm' : 'text-base'}>🔒</span>
        <span className="text-[var(--text-muted)]">{label}</span>
      </div>
    );
  }
  if (done) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`${base} active:scale-95`}
        style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.35)', color: '#16a34a' }}
      >
        {busy ? (
          <div className="w-3.5 h-3.5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className={wide ? 'text-sm' : 'text-base'}>✓</span>
        )}
        <span>{label}</span>
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} text-white active:scale-95 hover:opacity-90`}
      style={{ background: color, boxShadow: `0 3px 12px ${color}66` }}
    >
      {busy ? (
        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <span className={wide ? 'text-sm' : 'text-base'}>{icon}</span>
      )}
      <span>{label}</span>
    </button>
  );
}
