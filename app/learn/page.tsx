'use client';
import { PageLoader, SectionLoader } from '@/components/Loader';
import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { speakAccent, speakText } from '@/lib/speech';
import {
  saveLearnedWord, incrementTodayCount, addXP, recordStudySession,
  markLearningComplete, toggleStarred, isStarred, addHardWord,
  getHardWords, removeHardWord, getSettings, getStreak, getTodayLearnedCount,
  saveLearnProgress, clearLearnProgress, getLearnProgress,
  saveLearnMarks, getLearnMarks, getStarredWords,
} from '@/lib/storage';
import { pushUnitProgressCurrentUser, pushAllCurrentUser } from '@/lib/web-sync';
import { createSRSWord } from '@/lib/srs';
import { addSRSWord as storeSRSWord } from '@/lib/storage';
import type { Accent } from '@/lib/speech';
import { checkAchievements } from '@/lib/gamification';
import type { WordItem, WordCollection } from '@/lib/types';
import { XP_PER_LEARN } from '@/lib/types';
import { getImportedWords, getImportedWordsByCollection } from '@/lib/storage';
import Link from 'next/link';
import UnitPicker from '@/components/UnitPicker';
import TiltCard from '@/components/TiltCard';
import { useTranslation } from '@/lib/useTranslation';

interface StudyWord extends WordItem {
  collectionName: string;
  topic: string;
  dayNumber: number;
}

function buildStudyList(
  collections: WordCollection[],
  collectionName?: string,
  dayNumber?: number,
  hardOnly?: boolean,
  order: 'random' | 'in-order' = 'random',
): StudyWord[] {
  const hardSet = hardOnly ? new Set(getHardWords()) : null;
  const words: StudyWord[] = [];
  for (const col of collections) {
    if (collectionName && col.name !== collectionName) continue;
    for (const day of col.days) {
      if (dayNumber !== undefined && day.dayNumber !== dayNumber) continue;
      for (const word of day.words) {
        if (hardSet && !hardSet.has(word.word)) continue;
        words.push({ ...word, collectionName: col.name, topic: day.topic, dayNumber: day.dayNumber });
      }
    }
  }
  if (order === 'random') {
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [words[i], words[j]] = [words[j], words[i]];
    }
  }
  return words;
}

function LearnInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const sourceMyWords = sp.get('source') === 'my-words';
  const sourceStarred = sp.get('source') === 'starred';
  const starredUnitIndex = parseInt(sp.get('unit') ?? '1') - 1; // 0-based
  const myCollection = sp.get('myCollection') ?? undefined;
  const myFolder     = sp.get('myFolder') ?? undefined;
  const rawCollectionName = sp.get('collection') ?? undefined;
  const dayParam = sp.get('day');
  const dayNumber = dayParam ? parseInt(dayParam) : undefined;
  const hardOnly = sp.get('hard') === 'true';
  const startIndexParam = sp.get('startIndex');
  const startIndex = startIndexParam ? parseInt(startIndexParam) || 0 : 0;
  const { collections, collectionsLoaded, pushAchievement, setPendingLevelUp, focusMode, setFocusMode, showPomodoroSetup } = useAppStore(
    useShallow(s => ({
      collections: s.collections, collectionsLoaded: s.collectionsLoaded,
      pushAchievement: s.pushAchievement, setPendingLevelUp: s.setPendingLevelUp,
      focusMode: s.focusMode, setFocusMode: s.setFocusMode,
      showPomodoroSetup: s.showPomodoroSetup,
    }))
  );

  // Validate the URL param against known collection names so arbitrary strings
  // cannot corrupt localStorage keys or reach Supabase queries. Before collections
  // are loaded we pass the raw value through unchanged so no flash of <UnitPicker>.
  const collectionName = useMemo(() => {
    if (!collectionsLoaded) return rawCollectionName;
    if (!rawCollectionName) return undefined;
    return collections.some(c => c.name === rawCollectionName) ? rawCollectionName : undefined;
  }, [rawCollectionName, collections, collectionsLoaded]);

  const [words, setWords] = useState<StudyWord[]>([]);
  const [index, setIndex] = useState(0);
  const [startIndexApplied, setStartIndexApplied] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<{ savedIndex: number; total: number; tooHard: string[]; skipped: string[] } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showEx1Translation, setShowEx1Translation] = useState(false);
  const [showEx2Translation, setShowEx2Translation] = useState(false);
  const [showEx3Translation, setShowEx3Translation] = useState(false);
  const [showUzDefinition, setShowUzDefinition] = useState(false);
  const [showMoreExamples, setShowMoreExamples] = useState(false);
  const [skipped, setSkipped] = useState<StudyWord[]>([]);
  const [pureSkipped, setPureSkipped] = useState<StudyWord[]>([]);
  const [marks, setMarks] = useState<('learned' | 'skipped' | 'too-hard' | null)[]>([]);
  const [maxReached, setMaxReached] = useState(0);
  const [done, setDone] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [starred, setStarredState] = useState(false);
  const [defaultAccent, setDefaultAccent] = useState<Accent>('us');
  const [autoPlayOnReveal, setAutoPlayOnReveal] = useState(true);
  const [sessionSize, setSessionSize] = useState(20);
  const [studyOrder, setStudyOrder] = useState<'random' | 'in-order'>('random');
  const [showSkipTip, setShowSkipTip] = useState(false);
  const t = useTranslation();

  useEffect(() => {
    const s = getSettings();
    setDefaultAccent(s.defaultAccent);
    setAutoPlayOnReveal(s.autoPlayOnReveal);
    setSessionSize(s.sessionSize);
    setStudyOrder(s.studyOrder);
    if (!localStorage.getItem('lexivo_seen_skip_tip')) {
      setShowSkipTip(true);
    }
  }, []);

  // Show Pomodoro widget whenever Learn is entered (collection picker or unit session)
  // setTimeout defers past the hydration window to avoid React Error #310
  useEffect(() => {
    const t = setTimeout(() => showPomodoroSetup(), 0);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sourceStarred && collectionsLoaded && collections.length > 0) {
      const starredList = getStarredWords();
      const unitWords = starredList.slice(starredUnitIndex * 30, (starredUnitIndex + 1) * 30);
      const unitSet = new Set(unitWords);
      const list: StudyWord[] = [];
      for (const col of collections) {
        for (const day of col.days) {
          for (const word of day.words) {
            if (unitSet.has(word.word)) {
              list.push({ ...word, collectionName: 'starred_words', topic: `Unit ${starredUnitIndex + 1}`, dayNumber: starredUnitIndex + 1 });
            }
          }
        }
      }
      list.sort((a, b) => unitWords.indexOf(a.word) - unitWords.indexOf(b.word));
      setWords(list);
      setMarks(new Array(list.length).fill(null));
      return;
    }
    if (sourceMyWords) {
      const imported = myCollection ? getImportedWordsByCollection(myCollection, myFolder) : getImportedWords();
      const list: StudyWord[] = imported.map(w => ({
        word: w.word,
        partOfSpeech: '',
        pronunciation: '',
        translation: w.translation,
        definition: w.definition,
        example1: w.example1,
        example1Situation: '',
        example1Translation: w.example1Translation ?? '',
        example2: w.example2,
        example2Situation: '',
        example2Translation: w.example2Translation ?? '',
        example3: '',
        example3Translation: '',
        example3Situation: '',
        language: w.language,
        collectionName: 'my-words',
        topic: myCollection ?? 'My Words',
        dayNumber: 0,
      }));
      const shuffled = studyOrder === 'random'
        ? [...list].sort(() => Math.random() - 0.5)
        : list;
      const mySlice = shuffled.slice(0, sessionSize);
      setWords(mySlice);
      setMarks(new Array(mySlice.length).fill(null));
      return;
    }
    if (collectionsLoaded && collections.length > 0) {
      const list = buildStudyList(collections, collectionName, dayNumber, hardOnly, studyOrder);
      const sliced = (dayNumber !== undefined || hardOnly) ? list : list.slice(0, sessionSize);
      setWords(sliced);
      setMarks(new Array(sliced.length).fill(null));
      if (startIndex > 0 && !startIndexApplied) {
        if (sliced.length > 0) {
          setIndex(Math.min(Math.max(0, startIndex), sliced.length - 1));
        }
        setStartIndexApplied(true);
      } else if (collectionName && dayNumber !== undefined && !startIndexApplied) {
        const saved = getLearnProgress(collectionName, dayNumber);
        if (saved && saved > 0 && saved < sliced.length) {
          const savedMarks = getLearnMarks(collectionName, dayNumber);
          setResumePrompt({
            savedIndex: saved,
            total: sliced.length,
            tooHard: savedMarks?.tooHard ?? [],
            skipped: savedMarks?.skipped ?? [],
          });
        }
      }
    }
  }, [collectionsLoaded, collections, collectionName, dayNumber, hardOnly, sourceMyWords, sourceStarred, starredUnitIndex, myCollection, myFolder]);

  const current = words[index];

  useEffect(() => {
    if (current) {
      setStarredState(isStarred(current.word));
      setRevealed(false);
      setShowHint(false);
      setShowEx1Translation(false);
      setShowEx2Translation(false);
      setShowEx3Translation(false);
      setShowUzDefinition(false);
      setShowMoreExamples(false);
    }
  }, [current]);

  useEffect(() => {
    if (revealed && current && autoPlayOnReveal) {
      if (current.language) speakText(current.word, current.language);
      else speakAccent(current.word, defaultAccent);
    }
  }, [revealed]); // intentionally only on revealed change

  const advanceCard = useCallback(async () => {
    if (!current) return;
    if (hardOnly) removeHardWord(current.word);
    const isNew = saveLearnedWord({
      word: current.word,
      translation: current.translation,
      collectionName: current.collectionName,
      topic: current.topic,
      dayNumber: current.dayNumber,
      learnedAt: new Date().toISOString(),
    });
    const srsWord = createSRSWord(current, current.collectionName, current.dayNumber, current.topic);
    storeSRSWord(srsWord);
    if (isNew) incrementTodayCount();
    const { leveledUp, newLevel, newXp } = addXP(XP_PER_LEARN, 'Learn');
    if (leveledUp) setPendingLevelUp({ level: newLevel, xp: newXp });
    recordStudySession();
    setSessionCount(c => c + 1);
    setMarks(m => { const n = [...m]; n[index] = 'learned'; return n; });
    const newAch = checkAchievements();
    newAch.forEach(pushAchievement);
    if (newAch.length > 0) pushAllCurrentUser();
    if (index + 1 >= words.length) {
      if (collectionName && words.length > 0) {
        markLearningComplete(collectionName, words[0].dayNumber);
        clearLearnProgress(collectionName, words[0].dayNumber);
        await pushUnitProgressCurrentUser(collectionName, words[0].dayNumber);
      }
      setDone(true);
    } else {
      setIndex(i => i + 1);
      setMaxReached(m => Math.max(m, index + 1));
    }
  }, [current, index, words, collectionName, pushAchievement, setPendingLevelUp, hardOnly]);

  const markTooHard = useCallback(() => {
    if (!current) return;
    addHardWord(current.word);
    setSkipped(s => [...s, current]);
    setMarks(m => { const n = [...m]; n[index] = 'too-hard'; return n; });
    if (index + 1 >= words.length) setDone(true);
    else { setIndex(i => i + 1); setMaxReached(m => Math.max(m, index + 1)); }
  }, [current, index, words]);

  const dismissSkipTip = useCallback(() => {
    setShowSkipTip(false);
    localStorage.setItem('lexivo_seen_skip_tip', '1');
  }, []);

  const skipWord = useCallback(() => {
    if (!current) return;
    dismissSkipTip();
    setPureSkipped(s => [...s, current]);
    setMarks(m => { const n = [...m]; n[index] = 'skipped'; return n; });
    if (index + 1 >= words.length) setDone(true);
    else { setIndex(i => i + 1); setMaxReached(m => Math.max(m, index + 1)); }
  }, [current, index, words, dismissSkipTip]);

  const handleStar = () => {
    if (!current) return;
    setStarredState(toggleStarred(current.word));
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case 's': case 'S': if (current) { current.language ? speakText(current.word, current.language) : speakAccent(current.word, defaultAccent); } break;
        case 'f': case 'F': setFocusMode(!focusMode); break;
        case 'k': case 'K': if (marks[index] == null) skipWord(); break;
        case 'h': case 'H':
          if (!revealed) setShowHint(true);
          else markTooHard();
          break;
        case 'ArrowRight': case 'Enter': case ' ':
          e.preventDefault();
          if (!done) {
            if (!revealed) { setRevealed(true); dismissSkipTip(); }
            else advanceCard();
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, done, focusMode, revealed, marks, index, advanceCard, markTooHard, skipWord, dismissSkipTip]);

  // No unit selected → show picker
  if (!collectionName && !hardOnly && !sourceMyWords && !sourceStarred) return <UnitPicker mode="learn" />;

  if (!collectionsLoaded) return <LoadingState />;

  if (words.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-5xl mb-4">📭</div>
        <h2 className="font-bold text-xl mb-2">{t.common.noWordsFound}</h2>
        <Link href="/" className="btn-primary inline-block mt-4">{t.common.goHome}</Link>
      </div>
    );
  }

  if (done) {
    const backUrl = hardOnly ? '/hard-words' : sourceMyWords ? (myCollection ? (myFolder ? `/my-words/${encodeURIComponent(myFolder)}/${encodeURIComponent(myCollection)}` : `/my-words/${encodeURIComponent(myCollection)}`) : '/my-words') : collectionName ? `/collections/${encodeURIComponent(collectionName)}` : '/';
    return (
      <SessionDone
        sessionCount={sessionCount}
        skipped={skipped}
        pureSkipped={pureSkipped}
        backUrl={backUrl}
        collectionName={collectionName}
        dayNumber={dayNumber}
        xpEarned={sessionCount * XP_PER_LEARN}
        streak={getStreak()}
        todayCount={getTodayLearnedCount()}
        onRestart={() => { setIndex(0); setMaxReached(0); setDone(false); setSessionCount(0); setSkipped([]); setPureSkipped([]); setMarks(new Array(words.length).fill(null)); }}
      />
    );
  }

  if (!current) return null;

  if (resumePrompt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center gap-5 animate-fade-in">
        <div className="text-5xl">📖</div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[var(--text)]">Resume where you left off?</h2>
          <p className="text-sm text-[var(--text-muted)] max-w-xs leading-relaxed">
            You made it to word <strong>{resumePrompt.savedIndex + 1}</strong> of <strong>{resumePrompt.total}</strong> last time.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            className="btn-primary"
            onClick={() => {
              const tooHardSet = new Set(resumePrompt.tooHard);
              const skippedSet = new Set(resumePrompt.skipped);
              setSkipped(words.filter(w => tooHardSet.has(w.word)));
              setPureSkipped(words.filter(w => skippedSet.has(w.word)));
              const newMarks: ('learned' | 'skipped' | 'too-hard' | null)[] = new Array(words.length).fill(null);
              words.forEach((w, i) => {
                if (i < resumePrompt.savedIndex) {
                  if (tooHardSet.has(w.word)) newMarks[i] = 'too-hard';
                  else if (skippedSet.has(w.word)) newMarks[i] = 'skipped';
                  else newMarks[i] = 'learned';
                }
              });
              setMarks(newMarks);
              setIndex(resumePrompt.savedIndex);
              setMaxReached(resumePrompt.savedIndex);
              setResumePrompt(null);
            }}
          >
            Resume from word {resumePrompt.savedIndex + 1}
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              if (collectionName && dayNumber !== undefined) clearLearnProgress(collectionName, dayNumber);
              setResumePrompt(null);
            }}
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  const mark = marks[index] ?? null;
  const isMarked = mark != null;
  const showBack = revealed || isMarked;
  const cardBg = mark === 'learned' ? '#15803d' : mark === 'too-hard' ? '#b91c1c' : mark === 'skipped' ? '#c2410c' : undefined;
  const cardCssVars = cardBg ? { '--text': '#fff', '--text-muted': 'rgba(255,255,255,0.85)', '--primary': '#fff', '--primary-bg': 'rgba(255,255,255,0.2)', '--surface-2': 'rgba(255,255,255,0.12)', '--surface': 'rgba(255,255,255,0.08)', '--border': 'rgba(255,255,255,0.2)' } as React.CSSProperties : {};

  return (
    <div className={`flex flex-col min-h-screen ${focusMode ? 'focus-container' : ''}`}>
      {/* Header */}
      <div className="no-focus flex items-center justify-between p-4 pb-2">
        <button
          onClick={() => {
            if (index > 0 && !done && collectionName && dayNumber !== undefined) {
              saveLearnProgress(collectionName, dayNumber, index);
              saveLearnMarks(collectionName, dayNumber, skipped.map(w => w.word), pureSkipped.map(w => w.word));
            }
            router.back();
          }}
          className="btn-icon text-lg"
          aria-label="Go back"
        >←</button>
        <div className="flex-1 mx-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-[var(--text-muted)] truncate">
              {collectionName ? collectionName.split(' ').slice(0, 2).join(' ') : 'All Collections'}
            </span>
            <div className="flex items-center shrink-0 ml-2">
              <button
                onClick={() => { setIndex(i => Math.max(0, i - 1)); setRevealed(false); }}
                disabled={index === 0}
                className="w-6 h-6 flex items-center justify-center text-[var(--primary)] disabled:opacity-30 text-lg font-bold"
                aria-label="Previous card"
              >‹</button>
              <span className="text-xs font-bold text-[var(--primary)] px-1">
                {index + 1} <span className="text-[var(--text-muted)] font-normal">/ {words.length}</span>
              </span>
              <button
                onClick={() => { setIndex(i => Math.min(words.length - 1, i + 1)); setRevealed(false); }}
                disabled={index >= words.length - 1}
                className="w-6 h-6 flex items-center justify-center text-[var(--primary)] disabled:opacity-30 text-lg font-bold"
                aria-label="Next card"
              >›</button>
            </div>
          </div>
          <div className="flex gap-0.5">
            {words.map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-full transition-colors duration-200"
                style={{
                  height: 4,
                  backgroundColor: i === index
                    ? 'var(--primary)'
                    : marks[i] === 'learned'
                    ? '#22c55e'
                    : marks[i] === 'too-hard'
                    ? '#ef4444'
                    : marks[i] === 'skipped'
                    ? '#f97316'
                    : 'var(--border)',
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={handleStar} className="btn-icon text-lg" aria-label={starred ? 'Remove from starred' : 'Add to starred'}>
            {starred ? '⭐' : '☆'}
          </button>
          <button onClick={() => setFocusMode(!focusMode)} className="btn-icon text-base" aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}>
            {focusMode ? '⊠' : '⛶'}
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Word card */}
        <TiltCard className="flex-1 animate-slide-up" intensity={5} glare={false}>
        <div
          className={`card h-full transition-all ${!showBack ? 'cursor-pointer hover:border-[var(--primary)]' : ''}`}
          style={{ minHeight: 300, ...(cardBg ? { background: cardBg, borderColor: 'transparent' } : {}), ...cardCssVars }}
          onClick={!showBack ? () => { setRevealed(true); dismissSkipTip(); } : undefined}
        >
          {isMarked && (
            <button
              onClick={e => { e.stopPropagation(); setMarks(m => { const n = [...m]; n[index] = null; return n; }); setRevealed(false); }}
              className="mb-3 px-3 py-1.5 rounded-full text-xs font-bold text-white w-fit hover:opacity-80 active:scale-95 transition-all cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.25)' }}
              title="Click to undo this mark"
            >
              {mark === 'learned' ? '✓ Already marked as Learned' : mark === 'too-hard' ? '😤 Too Hard' : '⏭ Skipped — still counts!'} ✕
            </button>
          )}
          {/* Topic + audio */}
          <div className="flex items-center justify-between mb-3">
            <span className="badge">{current.topic}</span>
            {current.language ? (
              <button
                onClick={e => { e.stopPropagation(); speakText(current.word, current.language!); }}
                className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-base hover:bg-[var(--primary-bg)] transition-colors"
                aria-label="Listen to pronunciation"
              >🔊</button>
            ) : (
              <div className="flex gap-1.5">
                <AccentButton
                  onClick={e => { e.stopPropagation(); speakAccent(current.word, 'us'); }}
                  flag="🇺🇸" label={t.learn.american}
                  active={defaultAccent === 'us'}
                />
                <AccentButton
                  onClick={e => { e.stopPropagation(); speakAccent(current.word, 'uk'); }}
                  flag="🇬🇧" label={t.learn.british}
                  active={defaultAccent === 'uk'}
                />
              </div>
            )}
          </div>

          {/* Word */}
          <h2 className="text-3xl font-bold text-[var(--text)] mb-1">{current.word}</h2>
          <p className="text-[var(--text-muted)] text-sm">
            <span className="italic">{current.partOfSpeech}</span> · {current.pronunciation}
          </p>

          {!showBack ? (
            /* ── Front: tap-to-reveal ── */
            <div className="mt-8 mb-4 flex flex-col items-center gap-3 select-none">
              <div className="text-5xl">🤔</div>
              <p className="text-sm font-medium text-[var(--text-muted)]">{t.learn.doYouKnow}</p>
              <div
                className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold pointer-events-none"
                style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}
              >
                {t.learn.tapToReveal}
              </div>
            </div>
          ) : (
            /* ── Back: definition + translation + examples ── */
            <div className="mt-4 space-y-3 animate-fade-in">
              <p className="text-base font-semibold text-[var(--text)] leading-relaxed">{current.definition}</p>

              <div className="bg-[var(--primary-bg)] rounded-xl p-3">
                <p className="text-xs font-semibold text-[var(--primary)] mb-1">🇺🇿 O'zbek tarjimasi</p>
                <p className="text-sm text-[var(--primary)]">{current.translation}</p>
              </div>

              {current.definitionUz && (
                <div>
                  <button
                    onClick={() => setShowUzDefinition(v => !v)}
                    className="text-xs text-[var(--primary)] font-medium hover:underline"
                  >
                    {showUzDefinition ? "Yopish" : "O'zbekcha tushuntirish"}
                  </button>
                  {showUzDefinition && (
                    <p className="text-sm text-[var(--text-muted)] mt-1 animate-fade-in">{current.definitionUz}</p>
                  )}
                </div>
              )}

              <ExampleCard
                num={1}
                example={current.example1}
                translation={current.example1Translation}
                showTranslation={showEx1Translation}
                onToggle={() => setShowEx1Translation(v => !v)}
                language={current.language}
              />
              {current.example2 && (
                <ExampleCard
                  num={2}
                  example={current.example2}
                  translation={current.example2Translation}
                  showTranslation={showEx2Translation}
                  onToggle={() => setShowEx2Translation(v => !v)}
                  language={current.language}
                />
              )}
              {current.example3 && (
                <ExampleCard
                  num={3}
                  example={current.example3}
                  translation={current.example3Translation}
                  showTranslation={showEx3Translation}
                  onToggle={() => setShowEx3Translation(v => !v)}
                  language={current.language}
                />
              )}

              {current.extraExamples && current.extraExamples.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowMoreExamples(v => !v)}
                    className="text-sm text-[var(--primary)] font-medium hover:underline flex items-center gap-1"
                  >
                    {showMoreExamples ? '− Hide examples' : `+ More examples (${current.extraExamples.length})`}
                  </button>
                  {showMoreExamples && (
                    <div className="mt-2 space-y-2 animate-fade-in">
                      {current.extraExamples.map((ex, i) => (
                        <ExtraExampleCard
                          key={i}
                          index={i}
                          example={ex}
                          translation={current.extraExampleTranslations?.[i]}
                          language={current.language}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        </TiltCard>

        {/* Hint — only before reveal on unvisited cards */}
        {!showBack && !isMarked && (
          <div className="no-focus">
            <div className="text-center">
              {!showHint ? (
                <button
                  onClick={() => setShowHint(true)}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] underline"
                >
                  {t.learn.needHint}
                </button>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 animate-fade-in text-left">
                  <p className="text-xs font-semibold text-amber-600 mb-1">{t.learn.hint}</p>
                  <p className="text-sm text-amber-900">{current.definition.split(' ').slice(0, 8).join(' ')}…</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action buttons — after reveal or on unvisited card before reveal */}
        {!isMarked && (
          <div className="no-focus space-y-2">
            {showBack && (
              <div className="flex gap-3 animate-fade-in">
                <button
                  onClick={markTooHard}
                  className="flex-1 py-3.5 rounded-xl border-2 border-[var(--danger)] text-[var(--danger)] font-semibold text-sm hover:bg-red-50 transition-colors press-3d"
                >
                  {t.learn.tooHard} <kbd className="ml-1 opacity-60 text-xs">H</kbd>
                </button>
                <button
                  onClick={advanceCard}
                  className="flex-[2] btn-primary py-3.5 text-center press-3d"
                >
                  {t.learn.gotIt} <kbd className="ml-1 opacity-60 text-xs">Space</kbd>
                </button>
              </div>
            )}
            <button
              onClick={skipWord}
              className="w-full py-3 rounded-xl border-2 border-[var(--border)] text-[var(--text-muted)] font-semibold text-sm hover:border-orange-300 hover:text-orange-500 transition-colors press-3d"
            >
              {t.common.skip} <kbd className="ml-1 opacity-60 text-xs">K</kbd>
            </button>
            {showSkipTip && (
              <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 animate-fade-in">
                <span className="text-base shrink-0 mt-0.5">⏭️</span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-orange-700">{t.learn.skipTipTitle}</p>
                  <p className="text-xs text-orange-600 mt-0.5">{t.learn.skipTipBody}</p>
                </div>
                <button onClick={dismissSkipTip} className="text-orange-400 hover:text-orange-600 text-sm font-bold shrink-0 mt-0.5" aria-label="Dismiss tip">✕</button>
              </div>
            )}
          </div>
        )}

        <div className="no-focus text-center text-xs text-[var(--text-muted)]">
          {t.learn.remaining(words.length - index - 1)} · <kbd>S</kbd> {t.learn.listenShort} · <kbd>H</kbd> {revealed ? t.learn.tooHardShort : t.learn.hintShort}{!revealed ? <> · <kbd>K</kbd> {t.learn.skipShort}</> : null}
        </div>
      </div>
    </div>
  );
}

export default function LearnPage() {
  return (
    <Suspense>
      <LearnInner />
    </Suspense>
  );
}

function ExampleCard({
  num, example, translation, showTranslation, onToggle, language,
}: {
  num: number; example: string; translation?: string;
  showTranslation: boolean; onToggle: () => void; language?: string;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--border)] cursor-pointer select-none"
      onClick={onToggle}
    >
      <div className="bg-[var(--surface-2)] px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xs font-semibold text-[var(--primary)] bg-[var(--primary-bg)] px-2 py-0.5 rounded-full">
            Example {num} · Medium
          </span>
          <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            {language ? (
              <button
                onClick={() => speakText(example, language)}
                className="w-6 h-6 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-xs hover:bg-[var(--primary-bg)] transition-colors"
                aria-label="Listen to pronunciation"
              >🔊</button>
            ) : (
              <>
                <AccentButton onClick={() => speakAccent(example, 'us')} flag="🇺🇸" label="American" size="sm" />
                <AccentButton onClick={() => speakAccent(example, 'uk')} flag="🇬🇧" label="British" size="sm" />
              </>
            )}
          </div>
        </div>
        <p className="text-sm italic text-[var(--text)]">&ldquo;{example}&rdquo;</p>
      </div>
      {translation && (
        <div className="px-3 py-2 bg-[var(--surface)]">
          {showTranslation
            ? <p className="text-xs text-[var(--primary)] animate-fade-in">{translation}</p>
            : <p className="text-xs text-[var(--text-muted)] text-center">Tap to see translation</p>}
        </div>
      )}
    </div>
  );
}

function ExtraExampleCard({
  index, example, translation, language,
}: {
  index: number; example: string; translation?: string; language?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--border)] cursor-pointer select-none"
      onClick={() => setShow(v => !v)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShow(v => !v); } }}
      role="button"
      tabIndex={0}
      aria-expanded={show}
    >
      <div className="bg-[var(--surface-2)] px-3 pt-2.5 pb-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xs text-[var(--text-muted)]">Extra {index + 1}</span>
          {language && (
            <button
              onClick={e => { e.stopPropagation(); speakText(example, language); }}
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs hover:bg-[var(--primary-bg)] transition-colors shrink-0"
              aria-label="Listen to pronunciation"
            >🔊</button>
          )}
        </div>
        <p className="text-sm italic text-[var(--text)]">&ldquo;{example}&rdquo;</p>
      </div>
      {translation && (
        <div className="px-3 py-2 bg-[var(--surface)]">
          {show
            ? <p className="text-xs text-[var(--primary)] animate-fade-in">{translation}</p>
            : <p className="text-xs text-[var(--text-muted)] text-center">Tap to see translation</p>}
        </div>
      )}
    </div>
  );
}

function AccentButton({
  onClick, flag, label, size = 'md', active = false,
}: {
  onClick: (e: React.MouseEvent) => void;
  flag: string;
  label: string;
  size?: 'sm' | 'md';
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`rounded-full flex items-center justify-center transition-colors ${
        size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-base'
      } ${active ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] hover:bg-[var(--primary-bg)]'}`}
    >
      {flag}
    </button>
  );
}

function LoadingState() {
  const t = useTranslation();
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <SectionLoader />
        <p className="text-[var(--text-muted)]">{t.learn.loading}</p>
      </div>
    </div>
  );
}

function SessionDone({
  sessionCount, skipped, pureSkipped, backUrl, collectionName, dayNumber, xpEarned, streak, todayCount, onRestart,
}: {
  sessionCount: number;
  skipped: StudyWord[];
  pureSkipped: StudyWord[];
  backUrl: string;
  collectionName?: string;
  dayNumber?: number;
  xpEarned: number;
  streak: number;
  todayCount: number;
  onRestart: () => void;
}) {
  const t = useTranslation();
  const hardStudyUrl = collectionName
    ? `/learn?collection=${encodeURIComponent(collectionName)}&hard=true`
    : '/learn?hard=true';

  return (
    <div className="p-6 animate-fade-in flex flex-col items-center min-h-screen">
      {/* Hero */}
      <div className="flex flex-col items-center text-center pt-10 pb-6">
        <div className="text-6xl mb-3 animate-pop">🎉</div>
        <h2 className="text-2xl font-bold text-[var(--text)]">{t.learn.sessionComplete}</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {collectionName ?? 'All Collections'}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 w-full mb-4">
        <StatTile icon="📚" value={sessionCount} label={t.learn.wordsLearned} color="var(--primary)" />
        <StatTile icon="⚡" value={`+${xpEarned}`} label={t.learn.xpEarned} color="var(--warning)" />
        <StatTile icon="🔥" value={streak} label={t.learn.dayStreak} color="#FF6B35" />
        <StatTile icon="😓" value={skipped.length} label={t.learn.hardWords} color={skipped.length > 0 ? 'var(--danger)' : 'var(--success)'} />
        {pureSkipped.length > 0 && (
          <div className="col-span-2">
            <StatTile icon="⏭️" value={pureSkipped.length} label={t.learn.skipped} color="#F97316" />
          </div>
        )}
      </div>

      {/* Today's progress nudge */}
      <div className="w-full card mb-4 flex items-center gap-3">
        <span className="text-2xl">📅</span>
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">{t.learn.wordsToday(todayCount)}</p>
          <p className="text-xs text-[var(--text-muted)]">{t.learn.keepGoing}</p>
        </div>
      </div>

      {/* Next step: Flashcards */}
      {collectionName && dayNumber !== undefined && (
        <Link
          href={`/flashcards?collection=${encodeURIComponent(collectionName)}&day=${dayNumber}`}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white mb-1"
          style={{ background: 'linear-gradient(135deg, #FF6B35, #FF8C42)' }}
        >
          <div>
            <div className="font-bold text-sm">{t.learn.practiceFlashcards}</div>
            <div className="text-xs opacity-80 mt-0.5">{t.learn.reinforceSub}</div>
          </div>
          <span className="text-lg">→</span>
        </Link>
      )}

      {/* Hard words list + shortcut */}
      {skipped.length > 0 && (
        <div className="w-full card mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm text-[var(--danger)]">{t.learn.markedTooHard}</p>
            <Link
              href={hardStudyUrl}
              className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--danger)] text-white"
            >
              {t.learn.studyNow}
            </Link>
          </div>
          <div className="space-y-1">
            {skipped.map(w => (
              <div key={w.word} className="text-sm py-1.5 border-b border-[var(--border)] last:border-0 flex justify-between gap-4">
                <span className="font-medium text-[var(--text)]">{w.word}</span>
                <span className="text-[var(--text-muted)] truncate">{w.translation}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 w-full mt-auto pt-4">
        <button onClick={onRestart} className="btn-secondary flex-1">{t.common.again}</button>
        <Link href={backUrl} className="btn-primary flex-1 text-center">{t.common.back}</Link>
      </div>
    </div>
  );
}

function StatTile({ icon, value, label, color }: { icon: string; value: number | string; label: string; color: string }) {
  return (
    <div className="card flex flex-col items-center py-4 gap-1">
      <span className="text-2xl">{icon}</span>
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
    </div>
  );
}

