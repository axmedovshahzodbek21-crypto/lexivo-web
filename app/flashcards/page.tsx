'use client';
import { Suspense } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { speak, speakText } from '@/lib/speech';
import { addXP, recordStudySession, markFlashcardComplete, getStarredWords, getHardWords, getCustomListWords, getUnitProgress, saveFlashcardProgress, getFlashcardProgress, clearFlashcardProgress, getImportedWords, getImportedWordsByCollection } from '@/lib/storage';
import { checkAchievements } from '@/lib/gamification';
import type { WordItem, WordCollection } from '@/lib/types';
import Link from 'next/link';
import UnitPicker from '@/components/UnitPicker';
import { useTranslation } from '@/lib/useTranslation';

interface StudyWord extends WordItem {
  collectionName: string;
  topic: string;
  dayNumber: number;
}

function buildDeck(
  collections: WordCollection[],
  collectionName?: string,
  dayNumber?: number,
  starredOnly?: boolean,
  hardOnly?: boolean,
  listId?: string,
): StudyWord[] {
  if (listId) {
    const ws = getCustomListWords(listId, collections);
    for (let i = ws.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ws[i], ws[j]] = [ws[j], ws[i]]; }
    return ws;
  }
  const filterSet = starredOnly
    ? new Set(getStarredWords())
    : hardOnly
    ? new Set(getHardWords())
    : null;
  const words: StudyWord[] = [];
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
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  return (dayNumber !== undefined || starredOnly || hardOnly) ? words : words.slice(0, 20);
}

type CardSide = 'front' | 'back';

export default function FlashcardsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-4xl animate-bounce">🃏</div></div>}>
      <FlashcardsPage />
    </Suspense>
  );
}

function FlashcardsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const collectionName = searchParams.get('collection') ?? undefined;
  const dayParam = searchParams.get('day');
  const dayNumber = dayParam ? parseInt(dayParam) : undefined;
  const starredOnly = searchParams.get('starred') === 'true';
  const hardOnly    = searchParams.get('hard') === 'true';
  const listId      = searchParams.get('list') ?? undefined;
  const fresh       = searchParams.get('fresh') === 'true';
  const sourceMyWords = searchParams.get('source') === 'my-words';
  const myCollection = searchParams.get('myCollection') ?? undefined;
  const { collections, collectionsLoaded, pushAchievement, setPendingLevelUp, focusMode, setFocusMode } = useAppStore();

  const t = useTranslation();
  const [deck, setDeck] = useState<StudyWord[]>([]);
  const [index, setIndex] = useState(0);
  const [side, setSide] = useState<CardSide>('front');
  const [known, setKnown] = useState(0);
  const [unknown, setUnknown] = useState(0);
  const [done, setDone] = useState(false);
  const [unknownWords, setUnknownWords] = useState<StudyWord[]>([]);

  // Gate: must complete Learn before Flashcards (for unit sessions)
  useEffect(() => {
    if (collectionName && dayNumber !== undefined) {
      if (!getUnitProgress(collectionName, dayNumber).learnDone) {
        router.replace(`/learn?collection=${encodeURIComponent(collectionName)}&day=${dayNumber}`);
      }
    }
  }, [collectionName, dayNumber, router]);

  useEffect(() => {
    if (sourceMyWords) {
      const imported = myCollection ? getImportedWordsByCollection(myCollection) : getImportedWords();
      const list: StudyWord[] = imported.map(w => ({
        word: w.word, partOfSpeech: '', pronunciation: '',
        translation: w.translation, definition: w.definition,
        example1: w.example1, example1Situation: '',
        example2: w.example2, example2Situation: '',
        example3: '', example3Translation: '', example3Situation: '',
        language: w.language,
        collectionName: 'my-words', topic: myCollection ?? 'My Words', dayNumber: 0,
      }));
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      setDeck(list);
      return;
    }
    if (collectionsLoaded && collections.length > 0) {
      const fullDeck = buildDeck(collections, collectionName, dayNumber, starredOnly, hardOnly, listId);
      if (collectionName && dayNumber !== undefined) {
        if (fresh) {
          clearFlashcardProgress(collectionName, dayNumber);
          setDeck(fullDeck);
        } else {
          const saved = getFlashcardProgress(collectionName, dayNumber);
          if (saved && saved.length > 0) {
            const resumeDeck = saved
              .map(id => fullDeck.find(w => w.word === id))
              .filter((w): w is StudyWord => w !== undefined);
            setDeck(resumeDeck.length > 0 ? resumeDeck : fullDeck);
          } else {
            setDeck(fullDeck);
          }
        }
      } else {
        setDeck(fullDeck);
      }
    }
  }, [collectionsLoaded, collections, collectionName, dayNumber, starredOnly, hardOnly, listId, fresh, sourceMyWords, myCollection]);

  const current = deck[index];

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case ' ': case 'Enter': e.preventDefault(); setSide(s => s === 'front' ? 'back' : 'front'); break;
        case 'ArrowRight': case 'k': case 'K': if (side === 'back') markKnown(); break;
        case 'ArrowLeft': case 'j': case 'J': if (side === 'back') markUnknown(); break;
        case 's': case 'S': if (current) { current.language ? speakText(current.word, current.language) : speak(current.word); } break;
        case 'f': case 'F': setFocusMode(!focusMode); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, side, focusMode]);

  const advance = useCallback((wasKnown: boolean) => {
    const card = deck[index];
    if (wasKnown) setKnown(k => k + 1);
    else { setUnknown(u => u + 1); if (card) setUnknownWords(prev => [...prev, card]); }
    const { leveledUp, newLevel, newXp } = addXP(wasKnown ? 3 : 1);
    if (leveledUp) setPendingLevelUp({ level: newLevel, xp: newXp });
    recordStudySession();
    const newAchievements = checkAchievements();
    newAchievements.forEach(pushAchievement);
    if (index + 1 >= deck.length) {
      if (collectionName) {
        const qDay = dayNumber ?? deck[0]?.dayNumber ?? 1;
        markFlashcardComplete(collectionName, qDay);
        clearFlashcardProgress(collectionName, qDay);
      }
      setDone(true);
    } else {
      if (collectionName && dayNumber !== undefined) {
        saveFlashcardProgress(collectionName, dayNumber, deck.slice(index + 1).map(w => w.word));
      }
      setIndex(i => i + 1);
      setSide('front');
    }
  }, [index, deck, collectionName, dayNumber, pushAchievement, setPendingLevelUp]);

  const markKnown = () => advance(true);
  const markUnknown = () => advance(false);

  if (!collectionName && !starredOnly && !hardOnly && !listId && !sourceMyWords) return <UnitPicker mode="flashcards" />;

  if (!collectionsLoaded) return <Loading />;
  if (deck.length === 0) return (
    <div className="p-6 text-center">
      <div className="text-5xl mb-4">📭</div>
      <h2 className="font-bold text-xl mb-2">{t.common.noWordsFound}</h2>
      <Link href="/" className="btn-primary inline-block mt-4">{t.common.goHome}</Link>
    </div>
  );

  if (done) {
    const score = Math.round((known / deck.length) * 100);
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-6xl mb-4">{score >= 80 ? '🎉' : score >= 50 ? '👍' : '💪'}</div>
        <h2 className="text-2xl font-bold mb-2">{t.flashcards.done}</h2>
        <p className="text-[var(--text-muted)] mb-6">{known} {t.flashcards.known} · {unknown} {t.flashcards.review} · {score}% {t.flashcards.score}</p>
        <div className="grid grid-cols-3 gap-3 w-full mb-6">
          <div className="card text-center"><div className="text-2xl font-bold text-[var(--success)]">{known}</div><div className="text-xs text-[var(--text-muted)]">{t.flashcards.known}</div></div>
          <div className="card text-center"><div className="text-2xl font-bold text-[var(--danger)]">{unknown}</div><div className="text-xs text-[var(--text-muted)]">{t.flashcards.review}</div></div>
          <div className="card text-center"><div className="text-2xl font-bold text-[var(--primary)]">{score}%</div><div className="text-xs text-[var(--text-muted)]">{t.flashcards.score}</div></div>
        </div>
        <div className="flex flex-col gap-3 w-full">
          {collectionName && dayNumber !== undefined && (
            <Link
              href={`/quiz?collection=${encodeURIComponent(collectionName)}&day=${dayNumber}`}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
            >
              <div>
                <div className="font-bold text-sm">{t.flashcards.takeQuiz}</div>
                <div className="text-xs opacity-80 mt-0.5">{t.flashcards.testMemory}</div>
              </div>
              <span className="text-lg">→</span>
            </Link>
          )}
          {unknownWords.length > 0 && (
            <button
              onClick={() => { setDeck(unknownWords); setIndex(0); setSide('front'); setKnown(0); setUnknown(0); setUnknownWords([]); setDone(false); }}
              className="w-full py-3 rounded-xl border-2 border-[var(--danger)] text-[var(--danger)] font-bold text-sm hover:bg-red-50 transition-colors"
            >
              {t.flashcards.studyWrong(unknownWords.length)}
            </button>
          )}
          <div className="flex gap-3">
            <button onClick={() => { setIndex(0); setSide('front'); setKnown(0); setUnknown(0); setUnknownWords([]); setDone(false); }} className="btn-secondary flex-1">{t.common.again}</button>
            <Link href={starredOnly ? '/starred' : hardOnly ? '/hard-words' : sourceMyWords ? (myCollection ? `/my-words/${encodeURIComponent(myCollection)}` : '/my-words') : collectionName ? `/collections/${encodeURIComponent(collectionName)}` : '/'} className="btn-primary flex-1 text-center">{t.common.back}</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center">←</button>
        <div className="text-center">
          <div className="font-semibold text-sm">{t.flashcards.title}</div>
          <div className="text-xs text-[var(--text-muted)]">{index + 1} / {deck.length}</div>
        </div>
        <div className="flex gap-2">
          <span className="text-xs font-medium text-[var(--success)]">✓{known}</span>
          <span className="text-xs font-medium text-[var(--danger)]">✗{unknown}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4">
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${((index + 1) / deck.length) * 100}%` }} />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 p-4 flex flex-col gap-4">
        <div
          className="flip-card cursor-pointer flex-1"
          style={{ minHeight: 320 }}
          onClick={() => setSide(s => s === 'front' ? 'back' : 'front')}
        >
          <div className={`flip-card-inner w-full h-full ${side === 'back' ? 'flipped' : ''}`} style={{ minHeight: 320 }}>
            {/* Front */}
            <div className="flip-card-front card flex flex-col items-center justify-center text-center p-6" style={{ minHeight: 320 }}>
              <span className="badge mb-4">{current.topic}</span>
              <h2 className="text-3xl font-bold text-[var(--text)] mb-2">{current.word}</h2>
              <p className="text-sm text-[var(--text-muted)]">{current.partOfSpeech} · {current.pronunciation}</p>
              <button
                onClick={e => { e.stopPropagation(); current.language ? speakText(current.word, current.language) : speak(current.word); }}
                className="mt-4 w-10 h-10 rounded-full bg-[var(--primary-bg)] flex items-center justify-center"
              >
                🔊
              </button>
              <p className="text-xs text-[var(--text-muted)] mt-4">{t.flashcards.tapToReveal}</p>
            </div>

            {/* Back */}
            <div className="flip-card-back card flex flex-col items-center justify-center text-center p-6" style={{ minHeight: 320, background: 'var(--primary-bg)' }}>
              <p className="text-xs font-semibold text-[var(--primary)] mb-2">🇺🇿 O'zbek tarjimasi</p>
              <h2 className="text-2xl font-bold text-[var(--primary)] mb-2">{current.translation}</h2>
              <p className="text-sm text-[var(--text)] mb-3">{current.definition}</p>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 w-full">
                <p className="text-xs italic text-[var(--text)]">"{current.example1}"</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons (only when back is shown) */}
        {side === 'back' ? (
          <div className="flex gap-3">
            <button
              onClick={markUnknown}
              className="flex-1 py-4 rounded-xl border-2 border-[var(--danger)] text-[var(--danger)] font-bold text-lg hover:bg-red-50 transition-colors press-3d"
            >
              {t.flashcards.again}
            </button>
            <button
              onClick={markKnown}
              className="flex-1 py-4 rounded-xl border-2 border-[var(--success)] text-[var(--success)] font-bold text-lg hover:bg-green-50 transition-colors press-3d"
            >
              {t.flashcards.knowIt}
            </button>
          </div>
        ) : (
          <div className="text-center text-sm text-[var(--text-muted)]">
            {t.flashcards.tapToReveal}
          </div>
        )}
      </div>
    </div>
  );
}

function Loading() {
  const t = useTranslation();
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-bounce">🃏</div>
        <p className="text-[var(--text-muted)]">{t.flashcards.loading}</p>
      </div>
    </div>
  );
}
