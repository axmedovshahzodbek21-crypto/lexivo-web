'use client';
import { PageLoader, SectionLoader } from '@/components/Loader';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { speak, speakText } from '@/lib/speech';
import { addXP, recordStudySession, markFlashcardComplete, getStarredWords, getHardWords, getCustomListWords, getUnitProgress, saveFlashcardProgress, getFlashcardProgress, clearFlashcardProgress, getImportedWords, getImportedWordsByCollection, getClassHWTemp } from '@/lib/storage';
import { checkAchievements } from '@/lib/gamification';
import { pushUnitProgressCurrentUser, pushAllCurrentUser } from '@/lib/web-sync';
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

export default function FlashcardsPage() {
  const router = useRouter();
  const [sp, setSp] = useState<URLSearchParams>(() => new URLSearchParams());
  useEffect(() => { setSp(new URLSearchParams(window.location.search)); }, []);
  const collectionName = sp.get('collection') ?? undefined;
  const dayParam = sp.get('day');
  const dayNumber = dayParam ? parseInt(dayParam) : undefined;
  const starredOnly = sp.get('starred') === 'true';
  const hardOnly    = sp.get('hard') === 'true';
  const listId      = sp.get('list') ?? undefined;
  const fresh       = sp.get('fresh') === 'true';
  const sourceMyWords = sp.get('source') === 'my-words';
  const sourceClassHW = sp.get('source') === 'class-hw';
  const myCollection = sp.get('myCollection') ?? undefined;
  const myFolder     = sp.get('myFolder') ?? undefined;
  const { collections, collectionsLoaded, pushAchievement, setPendingLevelUp, focusMode, setFocusMode } = useAppStore(
    useShallow(s => ({
      collections: s.collections, collectionsLoaded: s.collectionsLoaded,
      pushAchievement: s.pushAchievement, setPendingLevelUp: s.setPendingLevelUp,
      focusMode: s.focusMode, setFocusMode: s.setFocusMode,
    }))
  );

  const t = useTranslation();
  const [deck, setDeck] = useState<StudyWord[]>([]);
  const [index, setIndex] = useState(0);
  const [side, setSide] = useState<CardSide>('front');
  const [known, setKnown] = useState(0);
  const [unknown, setUnknown] = useState(0);
  const [done, setDone] = useState(false);
  const [unknownWords, setUnknownWords] = useState<StudyWord[]>([]);
  const cardsSinceLastPush = useRef(0);
  const advancing = useRef(false);

  // Gate: must complete Learn before Flashcards (for unit sessions)
  const [gateUrl, setGateUrl] = useState<string | null>(null);
  useEffect(() => {
    if (collectionName && dayNumber !== undefined) {
      if (!getUnitProgress(collectionName, dayNumber).learnDone) {
        setGateUrl(`/learn?collection=${encodeURIComponent(collectionName)}&day=${dayNumber}`);
      }
    }
  }, [collectionName, dayNumber]);

  useEffect(() => {
    if (sourceClassHW) {
      const hw = getClassHWTemp();
      const list: StudyWord[] = hw.map(w => ({
        word: w.word, partOfSpeech: '', pronunciation: '',
        translation: w.translation, definition: w.definition,
        example1: w.example1, example1Situation: '', example1Translation: w.example1Translation,
        example2: w.example2, example2Situation: '', example2Translation: w.example2Translation,
        example3: '', example3Translation: '', example3Situation: '',
        collectionName: 'class-hw', topic: w.className, dayNumber: 0,
      }));
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      setDeck(list);
      return;
    }
    if (sourceMyWords) {
      const imported = myCollection ? getImportedWordsByCollection(myCollection, myFolder) : getImportedWords();
      const list: StudyWord[] = imported.map(w => ({
        word: w.word, partOfSpeech: '', pronunciation: '',
        translation: w.translation, definition: w.definition,
        example1: w.example1, example1Situation: '', example1Translation: w.example1Translation ?? '',
        example2: w.example2, example2Situation: '', example2Translation: w.example2Translation ?? '',
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
          const savedIndex = getFlashcardProgress(collectionName, dayNumber);
          setDeck(fullDeck);
          if (savedIndex !== null && savedIndex > 0 && savedIndex < fullDeck.length) {
            setIndex(savedIndex);
          }
        }
      } else {
        setDeck(fullDeck);
      }
    }
  }, [collectionsLoaded, collections, collectionName, dayNumber, starredOnly, hardOnly, listId, fresh, sourceMyWords, sourceClassHW, myCollection, myFolder]);

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
    if (advancing.current) return;
    advancing.current = true;
    setTimeout(() => { advancing.current = false; }, 100);
    const card = deck[index];
    if (wasKnown) setKnown(k => k + 1);
    else { setUnknown(u => u + 1); if (card) setUnknownWords(prev => [...prev, card]); }
    if (!sourceClassHW) {
      const { leveledUp, newLevel, newXp } = addXP(wasKnown ? 3 : 1, 'Flashcard');
      if (leveledUp) setPendingLevelUp({ level: newLevel, xp: newXp });
      cardsSinceLastPush.current++;
      if (cardsSinceLastPush.current >= 5) { cardsSinceLastPush.current = 0; pushAllCurrentUser(); }
    }
    recordStudySession();
    const newAchievements = checkAchievements();
    newAchievements.forEach(pushAchievement);
    if (index + 1 >= deck.length) {
      if (collectionName) {
        const qDay = dayNumber ?? deck[0]?.dayNumber ?? 1;
        markFlashcardComplete(collectionName, qDay);
        clearFlashcardProgress(collectionName, qDay);
        pushUnitProgressCurrentUser(collectionName, qDay);
      }
      setDone(true);
    } else {
      if (collectionName && dayNumber !== undefined && cardsSinceLastPush.current === 0) {
        saveFlashcardProgress(collectionName, dayNumber, index + 1);
      }
      setIndex(i => i + 1);
      setSide('front');
    }
  }, [index, deck, collectionName, dayNumber, sourceClassHW, pushAchievement, setPendingLevelUp]);

  const markKnown = () => advance(true);
  const markUnknown = () => advance(false);

  if (!collectionName && !starredOnly && !hardOnly && !listId && !sourceMyWords && !sourceClassHW) return <UnitPicker mode="flashcards" />;

  if (gateUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center gap-5 animate-fade-in">
        <div className="text-5xl">🔒</div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[var(--text)]">Complete Learn first</h2>
          <p className="text-sm text-[var(--text-muted)] max-w-xs leading-relaxed">
            You need to finish the <strong>Learn</strong> session for this unit before you can do Flashcards. It only takes a few minutes!
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href={gateUrl} className="btn-primary text-center">Go to Learn →</Link>
          <button onClick={() => router.back()} className="btn-secondary">Go back</button>
        </div>
      </div>
    );
  }

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
              style={{ background: 'linear-gradient(135deg, var(--warning), #FBBF24)' }}
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
            <Link href={starredOnly ? '/starred' : hardOnly ? '/hard-words' : sourceClassHW ? '/classes' : sourceMyWords ? (myCollection ? (myFolder ? `/my-words/${encodeURIComponent(myFolder)}/${encodeURIComponent(myCollection)}` : `/my-words/${encodeURIComponent(myCollection)}`) : '/my-words') : collectionName ? `/collections/${encodeURIComponent(collectionName)}` : '/'} className="btn-primary flex-1 text-center">{t.common.back}</Link>
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
        <button onClick={() => router.back()} className="btn-icon" aria-label="Go back">←</button>
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
                aria-label="Listen to pronunciation"
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
        <SectionLoader />
        <p className="text-[var(--text-muted)]">{t.flashcards.loading}</p>
      </div>
    </div>
  );
}

