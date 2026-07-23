'use client';
import { SectionLoader } from '@/components/Loader';
import { Suspense } from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { addXP, getHardWords, getStarredWords, getCustomListWords, getImportedWords, getImportedWordsByCollection } from '@/lib/storage';
import { checkAchievements } from '@/lib/gamification';
import type { WordItem, WordCollection } from '@/lib/types';

interface MatchWord extends WordItem {
  collectionName: string;
  topic: string;
  dayNumber: number;
}

type Selection = { side: 'left' | 'right'; id: string } | null;
type Phase = 'playing' | 'round_done' | 'done';

const BATCH_SIZE = 6;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildList(
  collections: WordCollection[],
  collectionName?: string,
  dayNumber?: number,
  starredOnly?: boolean,
  hardOnly?: boolean,
  listId?: string,
): MatchWord[] {
  if (listId) return shuffle(getCustomListWords(listId, collections));
  const filterSet = starredOnly
    ? new Set(getStarredWords())
    : hardOnly
    ? new Set(getHardWords())
    : null;
  const words: MatchWord[] = [];
  for (const col of collections) {
    if (collectionName && col.name !== collectionName) continue;
    for (const day of col.days) {
      if (dayNumber !== undefined && day.dayNumber !== dayNumber) continue;
      for (const word of day.words) {
        if (filterSet && !filterSet.has(word.word)) continue;
        words.push({ ...word, collectionName: col.name, topic: day.topic, dayNumber: day.dayNumber });
      }
    }
  }
  return shuffle(words);
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function roundXpFor(pairCount: number, mistakes: number) {
  return pairCount * 2 + (mistakes === 0 ? 3 : 0);
}

function MatchingInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { collections, collectionsLoaded } = useAppStore();

  const collectionParam  = searchParams.get('collection') ?? undefined;
  const dayParam         = searchParams.get('day') ? parseInt(searchParams.get('day')!) : undefined;
  const starredParam     = searchParams.get('starred') === 'true';
  const hardParam        = searchParams.get('hard') === 'true';
  const listId           = searchParams.get('list') ?? undefined;
  const sourceMyWords    = searchParams.get('source') === 'my-words';
  const myCollection     = searchParams.get('myCollection') ?? undefined;
  const myFolder         = searchParams.get('myFolder') ?? undefined;

  const [words,       setWords]       = useState<MatchWord[]>([]);
  const [roundIndex,  setRoundIndex]  = useState(0);

  // Round state
  const [roundWords,  setRoundWords]  = useState<MatchWord[]>([]);
  const [leftOrder,   setLeftOrder]   = useState<string[]>([]);
  const [rightOrder,  setRightOrder]  = useState<string[]>([]);
  const [matched,     setMatched]     = useState<Set<string>>(new Set());
  const [selected,    setSelected]    = useState<Selection>(null);
  const [wrongPair,   setWrongPair]   = useState<{ left: string; right: string } | null>(null);
  const [mistakes,    setMistakes]    = useState(0);
  const [elapsed,     setElapsed]     = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [phase,       setPhase]       = useState<Phase>('playing');

  // Session totals
  const [totalXp,       setTotalXp]       = useState(0);
  const [totalMistakes, setTotalMistakes] = useState(0);
  const [totalTime,     setTotalTime]     = useState(0);

  const wrongTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (sourceMyWords) {
      const imported = myCollection
        ? getImportedWordsByCollection(myCollection, myFolder)
        : getImportedWords();
      const list: MatchWord[] = imported.map(w => ({
        word: w.word,
        partOfSpeech: '',
        pronunciation: '',
        translation: w.translation,
        definition: w.definition ?? '',
        example1: w.example1 ?? '',
        example1Situation: '',
        example1Translation: w.example1Translation ?? '',
        example2: w.example2 ?? '',
        example2Situation: '',
        example2Translation: w.example2Translation ?? '',
        example3: '',
        example3Translation: '',
        example3Situation: '',
        language: w.language ?? 'en-US',
        collectionName: 'my-words',
        topic: myCollection ?? 'My Words',
        dayNumber: 0,
      }));
      setWords(shuffle(list));
      return;
    }
    if (!collectionsLoaded) return;
    setWords(buildList(collections, collectionParam, dayParam, starredParam, hardParam, listId));
  }, [collectionsLoaded, collections, collectionParam, dayParam, starredParam, hardParam, listId, sourceMyWords, myCollection, myFolder]);

  const initRound = useCallback((idx: number, wordList: MatchWord[]) => {
    const batch = wordList.slice(idx * BATCH_SIZE, (idx + 1) * BATCH_SIZE);
    const ids = batch.map(w => w.word);
    setRoundWords(batch);
    setLeftOrder(shuffle(ids));
    setRightOrder(shuffle(ids));
    setMatched(new Set());
    setSelected(null);
    setWrongPair(null);
    setMistakes(0);
    setElapsed(0);
    setTimerActive(false);
    setPhase('playing');
  }, []);

  useEffect(() => {
    if (words.length > 0) initRound(0, words);
  }, [words, initRound]);

  // Timer
  useEffect(() => {
    if (timerActive) {
      timerInterval.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerInterval.current) clearInterval(timerInterval.current);
    }
    return () => { if (timerInterval.current) clearInterval(timerInterval.current); };
  }, [timerActive]);

  useEffect(() => () => {
    if (wrongTimeout.current) clearTimeout(wrongTimeout.current);
    if (timerInterval.current) clearInterval(timerInterval.current);
  }, []);

  const totalRounds = Math.ceil(words.length / BATCH_SIZE);
  const wordMap = new Map(roundWords.map(w => [w.word, w]));

  const handleTap = useCallback((side: 'left' | 'right', id: string) => {
    if (matched.has(id) || wrongPair) return;
    if (!timerActive) setTimerActive(true);

    if (!selected) {
      setSelected({ side, id });
      return;
    }
    // Same side — switch selection
    if (selected.side === side) {
      setSelected({ side, id });
      return;
    }

    // Attempt match
    const leftId  = side === 'right' ? selected.id : id;
    const rightId = side === 'right' ? id : selected.id;

    if (leftId === rightId) {
      // Correct
      setSelected(null);
      const next = new Set(matched).add(leftId);
      setMatched(next);

      if (next.size === roundWords.length) {
        // Round complete
        setTimerActive(false);
        const xp = roundXpFor(roundWords.length, mistakes);
        addXP(xp, 'Matching');
        checkAchievements();
        setTotalXp(prev => prev + xp);
        setTotalMistakes(prev => prev + mistakes);
        setTotalTime(prev => prev + elapsed);
        const isLast = roundIndex + 1 >= Math.ceil(words.length / BATCH_SIZE);
        setPhase(isLast ? 'done' : 'round_done');
      }
    } else {
      // Wrong
      setMistakes(prev => prev + 1);
      setSelected(null);
      setWrongPair({ left: leftId, right: rightId });
      wrongTimeout.current = setTimeout(() => setWrongPair(null), 650);
    }
  }, [matched, wrongPair, selected, timerActive, roundWords, mistakes, elapsed, roundIndex, words.length]);

  // ── Not supported / loading ──
  if (!collectionsLoaded && !sourceMyWords) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <SectionLoader />
      </div>
    );
  }

  if (words.length < 2) {
    return (
      <div className="p-6 text-center space-y-4 animate-fade-in">
        <div className="text-6xl">📭</div>
        <h2 className="text-xl font-bold text-[var(--text)]">Not enough words</h2>
        <p className="text-sm text-[var(--text-muted)]">You need at least 2 words for a matching game.</p>
        <Link href="/" className="btn-primary inline-block">← Home</Link>
      </div>
    );
  }

  // ── Done ──
  if (phase === 'done') {
    return (
      <div className="flex flex-col min-h-screen animate-fade-in">
        <div className="p-4 border-b border-[var(--border)]">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-3 hover:text-[var(--text)] transition-colors">
            ← Back
          </button>
          <h1 className="text-xl font-bold text-[var(--text)]">🎯 Complete!</h1>
        </div>
        <div className="flex-1 p-4 space-y-4">
          <div className="card text-center space-y-3">
            <div className="text-5xl">
              {totalMistakes === 0 ? '🏆' : totalMistakes <= 3 ? '🌟' : '💪'}
            </div>
            <p className="text-2xl font-bold text-[var(--text)]">{totalXp} XP earned</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-[var(--primary-bg)] p-3">
                <div className="text-xl font-bold text-[var(--primary)]">{words.length}</div>
                <div className="text-xs text-[var(--text-muted)]">Pairs</div>
              </div>
              <div className="rounded-xl bg-red-50 p-3">
                <div className="text-xl font-bold text-[var(--danger)]">{totalMistakes}</div>
                <div className="text-xs text-[var(--text-muted)]">Mistakes</div>
              </div>
              <div className="rounded-xl bg-[var(--surface-2)] p-3">
                <div className="text-xl font-bold text-[var(--text)]">{formatTime(totalTime)}</div>
                <div className="text-xs text-[var(--text-muted)]">Time</div>
              </div>
            </div>
            {totalMistakes === 0 && (
              <p className="text-sm font-semibold text-[var(--success)]">🎉 Perfect — no mistakes!</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                const reshuffled = shuffle([...words]);
                setWords(reshuffled);
                setRoundIndex(0);
                setTotalXp(0);
                setTotalMistakes(0);
                setTotalTime(0);
                initRound(0, reshuffled);
              }}
              className="flex-1 btn-primary"
            >
              Play Again
            </button>
            <button onClick={() => router.back()} className="flex-1 btn-secondary">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Round done ──
  if (phase === 'round_done') {
    const xp = roundXpFor(roundWords.length, mistakes);
    return (
      <div className="flex flex-col min-h-screen animate-fade-in">
        <div className="p-4 border-b border-[var(--border)]">
          <h1 className="text-xl font-bold text-[var(--text)]">🎯 Matching</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <div className="card w-full max-w-sm text-center space-y-3 animate-pop">
            <div className="text-5xl">{mistakes === 0 ? '🌟' : '✅'}</div>
            <h2 className="text-xl font-bold text-[var(--text)]">Round {roundIndex + 1} done!</h2>
            <p className="text-[var(--text-muted)] text-sm">
              {formatTime(elapsed)} · {mistakes} mistake{mistakes !== 1 ? 's' : ''}
            </p>
            <p className="text-xl font-bold text-[var(--primary)]">+{xp} XP</p>
          </div>
          <button
            onClick={() => {
              const next = roundIndex + 1;
              setRoundIndex(next);
              initRound(next, words);
            }}
            className="btn-primary w-full max-w-sm"
          >
            Round {roundIndex + 2} of {totalRounds} →
          </button>
        </div>
      </div>
    );
  }

  // ── Playing ──
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)] flex-shrink-0">
        <button
          onClick={() => { setTimerActive(false); router.back(); }}
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-2 hover:text-[var(--text)] transition-colors"
        >
          ← Back
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-[var(--text)]">🎯 Match the pairs</h1>
          <span className="text-sm text-[var(--text-muted)]">
            {totalRounds > 1 ? `Round ${roundIndex + 1}/${totalRounds}` : `${matched.size}/${roundWords.length}`}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-1.5 text-sm text-[var(--text-muted)]">
          <span>⏱ {formatTime(elapsed)}</span>
          {mistakes > 0 && <span className="text-[var(--danger)]">✗ {mistakes}</span>}
          <span className="ml-auto text-xs opacity-70">{matched.size}/{roundWords.length} matched</span>
        </div>
        <div className="progress-bar mt-2" style={{ height: 4 }}>
          <div
            className="progress-bar-fill"
            style={{ width: roundWords.length ? `${(matched.size / roundWords.length) * 100}%` : '0%', height: 4 }}
          />
        </div>
      </div>

      {/* Game grid */}
      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          {/* Left column */}
          <div className="flex flex-col gap-2">
            {leftOrder.map(id => {
              const w = wordMap.get(id);
              if (!w) return null;
              return (
                <MatchCard
                  key={`left-${id}`}
                  text={w.word}
                  matched={matched.has(id)}
                  selected={selected?.side === 'left' && selected.id === id}
                  wrong={wrongPair?.left === id}
                  onClick={() => handleTap('left', id)}
                />
              );
            })}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-2">
            {rightOrder.map(id => {
              const w = wordMap.get(id);
              if (!w) return null;
              return (
                <MatchCard
                  key={`right-${id}`}
                  text={w.translation}
                  matched={matched.has(id)}
                  selected={selected?.side === 'right' && selected.id === id}
                  wrong={wrongPair?.right === id}
                  onClick={() => handleTap('right', id)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchCard({
  text, matched, selected, wrong, onClick,
}: {
  text: string;
  matched: boolean;
  selected: boolean;
  wrong: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={matched}
      className={`
        w-full min-h-[60px] rounded-2xl border-2 px-3 py-3 text-sm font-semibold text-center
        transition-all duration-150 leading-tight break-words
        ${matched
          ? 'border-transparent bg-[var(--surface-2)] text-[var(--text)] opacity-20 cursor-default'
          : selected
          ? 'border-[var(--primary)] bg-[var(--primary)] text-white scale-[1.04] shadow-lg'
          : wrong
          ? 'border-red-500 bg-red-500/20 text-red-400 animate-shake'
          : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--primary)]/60 hover:bg-[var(--primary-bg)] active:scale-95'
        }
      `}
    >
      {text}
    </button>
  );
}

export default function MatchingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <SectionLoader />
      </div>
    }>
      <MatchingInner />
    </Suspense>
  );
}

