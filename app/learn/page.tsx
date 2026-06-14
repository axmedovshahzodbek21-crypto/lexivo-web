'use client';
import { Suspense } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { speakAccent } from '@/lib/speech';
import {
  saveLearnedWord, incrementTodayCount, addXP, recordStudySession,
  markLearningComplete, toggleStarred, isStarred, addHardWord,
  getHardWords, removeHardWord, getSettings, getStreak, getTodayLearnedCount,
  saveLearnProgress, clearLearnProgress, getLearnProgress,
} from '@/lib/storage';
import { createSRSWord } from '@/lib/srs';
import { addSRSWord as storeSRSWord } from '@/lib/storage';
import type { Accent } from '@/lib/speech';
import { checkAchievements } from '@/lib/gamification';
import type { WordItem, WordCollection } from '@/lib/types';
import { XP_PER_LEARN } from '@/lib/types';
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

export default function LearnPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-4xl animate-bounce">📚</div></div>}>
      <LearnPage />
    </Suspense>
  );
}

function LearnPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const collectionName = searchParams.get('collection') ?? undefined;
  const dayParam = searchParams.get('day');
  const dayNumber = dayParam ? parseInt(dayParam) : undefined;
  const hardOnly = searchParams.get('hard') === 'true';
  const startIndexParam = searchParams.get('startIndex');
  const startIndex = startIndexParam ? parseInt(startIndexParam) || 0 : 0;
  const { collections, collectionsLoaded, pushAchievement, setPendingLevelUp, focusMode, setFocusMode,
    showPomodoroSetup } = useAppStore();

  const [words, setWords] = useState<StudyWord[]>([]);
  const [index, setIndex] = useState(0);
  const [startIndexApplied, setStartIndexApplied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [skipped, setSkipped] = useState<StudyWord[]>([]);
  const [pureSkipped, setPureSkipped] = useState<StudyWord[]>([]);
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
  useEffect(() => {
    showPomodoroSetup();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (collectionsLoaded && collections.length > 0) {
      const list = buildStudyList(collections, collectionName, dayNumber, hardOnly, studyOrder);
      const sliced = (dayNumber !== undefined || hardOnly) ? list : list.slice(0, sessionSize);
      setWords(sliced);
      if (startIndex > 0 && !startIndexApplied) {
        setIndex(Math.min(startIndex, sliced.length - 1));
        setStartIndexApplied(true);
      }
    }
  }, [collectionsLoaded, collections, collectionName, dayNumber, hardOnly]);

  const current = words[index];

  useEffect(() => {
    if (current) {
      setStarredState(isStarred(current.word));
      setRevealed(false);
      setShowExamples(false);
      setShowHint(false);
    }
  }, [current]);

  useEffect(() => {
    if (revealed && current && autoPlayOnReveal) {
      speakAccent(current.word, defaultAccent);
    }
  }, [revealed]); // intentionally only on revealed change

  const advanceCard = useCallback(() => {
    if (!current) return;
    if (hardOnly) removeHardWord(current.word);
    saveLearnedWord({
      word: current.word,
      translation: current.translation,
      collectionName: current.collectionName,
      topic: current.topic,
      dayNumber: current.dayNumber,
      learnedAt: new Date().toISOString(),
    });
    const srsWord = createSRSWord(current, current.collectionName, current.dayNumber, current.topic);
    storeSRSWord(srsWord);
    incrementTodayCount();
    const { leveledUp, newLevel, newXp } = addXP(XP_PER_LEARN);
    if (leveledUp) setPendingLevelUp({ level: newLevel, xp: newXp });
    recordStudySession();
    setSessionCount(c => c + 1);
    checkAchievements().forEach(pushAchievement);
    if (index + 1 >= words.length) {
      if (collectionName && words.length > 0) {
        markLearningComplete(collectionName, words[0].dayNumber);
        clearLearnProgress(collectionName, words[0].dayNumber);
      }
      setDone(true);
    } else {
      setIndex(i => i + 1);
    }
  }, [current, index, words, collectionName, pushAchievement, setPendingLevelUp, hardOnly]);

  const markTooHard = useCallback(() => {
    if (!current) return;
    addHardWord(current.word);
    setSkipped(s => [...s, current]);
    if (index + 1 >= words.length) setDone(true);
    else setIndex(i => i + 1);
  }, [current, index, words]);

  const dismissSkipTip = useCallback(() => {
    setShowSkipTip(false);
    localStorage.setItem('lexivo_seen_skip_tip', '1');
  }, []);

  const skipWord = useCallback(() => {
    if (!current) return;
    dismissSkipTip();
    setPureSkipped(s => [...s, current]);
    if (index + 1 >= words.length) setDone(true);
    else setIndex(i => i + 1);
  }, [current, index, words, dismissSkipTip]);

  const handleStar = () => {
    if (!current) return;
    setStarredState(toggleStarred(current.word));
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case 's': case 'S': if (current) speakAccent(current.word, defaultAccent); break;
        case 'f': case 'F': setFocusMode(!focusMode); break;
        case 'k': case 'K': if (!revealed) skipWord(); break;
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
  }, [current, done, focusMode, revealed, advanceCard, markTooHard, skipWord, dismissSkipTip]);

  // No unit selected → show picker
  if (!collectionName && !hardOnly) return <UnitPicker mode="learn" />;

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
    const backUrl = hardOnly ? '/hard-words' : collectionName ? `/collections/${encodeURIComponent(collectionName)}` : '/';
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
        onRestart={() => { setIndex(0); setDone(false); setSessionCount(0); setSkipped([]); setPureSkipped([]); }}
      />
    );
  }

  if (!current) return null;

  return (
    <div className={`flex flex-col min-h-screen ${focusMode ? 'focus-container' : ''}`}>
      {/* Header */}
      <div className="no-focus flex items-center justify-between p-4 pb-2">
        <button
          onClick={() => {
            if (index > 0 && !done && collectionName && dayNumber !== undefined) {
              saveLearnProgress(collectionName, dayNumber, index);
            }
            router.back();
          }}
          className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg shrink-0"
        >←</button>
        <div className="flex-1 mx-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-[var(--text-muted)] truncate">
              {collectionName ? collectionName.split(' ').slice(0, 2).join(' ') : 'All Collections'}
            </span>
            <span className="text-xs font-bold text-[var(--primary)] shrink-0 ml-2">
              {index + 1} <span className="text-[var(--text-muted)] font-normal">/ {words.length}</span>
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${((index + 1) / words.length) * 100}%` }} />
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={handleStar} className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg">
            {starred ? '⭐' : '☆'}
          </button>
          <button onClick={() => setFocusMode(!focusMode)} className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-base">
            {focusMode ? '⊠' : '⛶'}
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Word card */}
        <TiltCard className="flex-1 animate-slide-up" intensity={5}>
        <div
          className={`card h-full transition-all ${!revealed ? 'cursor-pointer hover:border-[var(--primary)]' : ''}`}
          style={{ minHeight: 300 }}
          onClick={!revealed ? () => { setRevealed(true); dismissSkipTip(); } : undefined}
        >
          {/* Topic + audio */}
          <div className="flex items-center justify-between mb-3">
            <span className="badge">{current.topic}</span>
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
          </div>

          {/* Word */}
          <h2 className="text-3xl font-bold text-[var(--text)] mb-1">{current.word}</h2>
          <p className="text-[var(--text-muted)] text-sm">
            <span className="italic">{current.partOfSpeech}</span> · {current.pronunciation}
          </p>

          {!revealed ? (
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
            /* ── Back: translation + definition + examples ── */
            <div className="mt-4 space-y-3 animate-fade-in">
              <div className="bg-[var(--primary-bg)] rounded-xl p-3">
                <p className="text-xs font-semibold text-[var(--primary)] mb-1">🇺🇿 O'zbek tarjimasi</p>
                <p className="text-xl font-bold text-[var(--primary)]">{current.translation}</p>
              </div>

              <p className="text-sm text-[var(--text)] leading-relaxed">{current.definition}</p>

              <ExampleWithSituation
                num={1}
                example={current.example1}
                situation={current.example1Situation}
              />

              {!showExamples ? (
                <button
                  onClick={() => setShowExamples(true)}
                  className="text-sm text-[var(--primary)] font-medium hover:underline"
                >
                  {t.learn.moreExamples}
                </button>
              ) : (
                <div className="space-y-3 animate-fade-in">
                  <ExampleWithSituation
                    num={2}
                    example={current.example2}
                    situation={current.example2Situation}
                  />
                  <ExampleWithSituation
                    num={3}
                    example={current.example3}
                    situation={current.example3Situation}
                    translation={current.example3Translation}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        </TiltCard>

        {/* Hint + Skip — only before reveal */}
        {!revealed && (
          <div className="no-focus space-y-2">
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
                <button onClick={dismissSkipTip} className="text-orange-400 hover:text-orange-600 text-sm font-bold shrink-0 mt-0.5">✕</button>
              </div>
            )}
          </div>
        )}

        {/* Action buttons — only after reveal */}
        {revealed && (
          <div className="flex gap-3 animate-fade-in no-focus">
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

        <div className="no-focus text-center text-xs text-[var(--text-muted)]">
          {t.learn.remaining(words.length - index - 1)} · <kbd>S</kbd> listen · <kbd>H</kbd> {revealed ? 'too hard' : 'hint'}{!revealed ? <> · <kbd>K</kbd> skip</> : null}
        </div>
      </div>
    </div>
  );
}

function ExampleWithSituation({
  num, example, situation, translation,
}: {
  num: number; example: string; situation: string; translation?: string;
}) {
  const t = useTranslation();
  return (
    <div className="rounded-xl overflow-hidden border border-[var(--border)]">
      <div className="bg-[var(--surface-2)] px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-xs text-[var(--text-muted)]">💬 {t.learn.example(num)}</p>
          <div className="flex gap-1 shrink-0">
            <AccentButton
              onClick={() => speakAccent(example, 'us')}
              flag="🇺🇸" label="American"
              size="sm"
            />
            <AccentButton
              onClick={() => speakAccent(example, 'uk')}
              flag="🇬🇧" label="British"
              size="sm"
            />
          </div>
        </div>
        <p className="text-sm italic text-[var(--text)]">&ldquo;{example}&rdquo;</p>
        {translation && <p className="text-xs text-[var(--primary)] mt-1">{translation}</p>}
      </div>
      <div className="bg-amber-50 px-3 pt-2 pb-3">
        <p className="text-xs text-amber-600 mb-1">🗺️ Holat {num}</p>
        <p className="text-sm text-amber-900">{situation}</p>
      </div>
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
      title={label}
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
        <div className="text-4xl mb-3 animate-bounce">📚</div>
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
        <StatTile icon="📚" value={sessionCount} label={t.learn.wordsLearned} color="#6C63FF" />
        <StatTile icon="⚡" value={`+${xpEarned}`} label={t.learn.xpEarned} color="#F59E0B" />
        <StatTile icon="🔥" value={streak} label={t.learn.dayStreak} color="#FF6B35" />
        <StatTile icon="😓" value={skipped.length} label={t.learn.hardWords} color={skipped.length > 0 ? '#EF4444' : '#10B981'} />
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
