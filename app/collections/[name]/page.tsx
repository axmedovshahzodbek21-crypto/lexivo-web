'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { getUnitProgress, getLearnProgress, getHardWordCount, getFlashcardProgress, getStoryUnlockInfo } from '@/lib/storage';
import type { WordCollection, UnitProgress } from '@/lib/types';
import { useTranslation } from '@/lib/useTranslation';
import { supabase } from '@/lib/supabase';

const COLLECTION_HERO: Record<string, { gradient: string; glow: string }> = {
  '30 Days of Powerful Words': {
    gradient: 'linear-gradient(135deg, #6c63ff 0%, #9b8fff 100%)',
    glow: 'rgba(108,99,255,0.45)',
  },
  '24 Vocabulary Challenge': {
    gradient: 'linear-gradient(135deg, #FF6584 0%, #ff9eb5 100%)',
    glow: 'rgba(255,101,132,0.45)',
  },
  'Word Mastery': {
    gradient: 'linear-gradient(135deg, #1a9a50 0%, #2ECC71 100%)',
    glow: 'rgba(46,204,113,0.45)',
  },
};
const DEFAULT_HERO = {
  gradient: 'linear-gradient(135deg, #6c63ff 0%, #9b8fff 100%)',
  glow: 'rgba(108,99,255,0.45)',
};

interface UnitRow {
  dayNumber: number;
  topic: string;
  wordCount: number;
  progress: UnitProgress;
}

export default function CollectionPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: encodedName } = use(params);
  const collectionName = decodeURIComponent(encodedName);
  const router = useRouter();
  const t = useTranslation();
  const { collections, collectionsLoaded } = useAppStore();

  const [collection, setCollection] = useState<WordCollection | null>(null);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [cols, setCols] = useState(2);

  useEffect(() => {
    const MIN_CARD = 320;
    const GAP = 8;
    const calculate = () => {
      const sidebarOpen = localStorage.getItem('lexivo_sidebar_open') !== 'false';
      const sidebarW = window.innerWidth >= 768 && sidebarOpen ? 208 : 0;
      const available = window.innerWidth - sidebarW - 32;
      setCols(Math.max(1, Math.floor((available + GAP) / (MIN_CARD + GAP))));
    };
    calculate();
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, []);

  useEffect(() => {
    if (!collectionsLoaded) return;
    const found = collections.find(c => c.name === collectionName);
    if (!found) return;
    setCollection(found);
    const rows: UnitRow[] = found.days.map(day => ({
      dayNumber: day.dayNumber,
      topic: day.topic || `Unit ${day.dayNumber}`,
      wordCount: day.words.length,
      progress: getUnitProgress(collectionName, day.dayNumber),
    }));
    setUnits(rows);
  }, [collectionsLoaded, collections, collectionName]);

  if (!collectionsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-4xl animate-bounce">📚</div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="p-6 text-center">
        <p className="text-[var(--text-muted)]">{t.collections.notFound}</p>
        <Link href="/" className="btn-primary inline-block mt-4">{t.collections.back}</Link>
      </div>
    );
  }

  const totalWords = collection.days.reduce((a, d) => a + d.words.length, 0);
  const completedUnits = units.filter(u => u.progress.learnDone && u.progress.flashcardDone && u.progress.quizDone).length;
  const hero = COLLECTION_HERO[collectionName] ?? DEFAULT_HERO;
  const progressPct = units.length > 0 ? (completedUnits / units.length) * 100 : 0;

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">

      {/* ── Hero banner ── */}
      <div
        className="relative px-5 pt-5 pb-8"
        style={{ background: hero.gradient, boxShadow: `0 8px 32px ${hero.glow}` }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-white/80 mb-4 hover:text-white transition-colors"
        >
          {t.collections.back}
        </button>

        <h1
          className="text-2xl font-black text-white leading-tight mb-1"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
        >
          {collection.name}
        </h1>
        {collection.description && (
          <p
            className="text-sm text-white mb-4"
            style={{ textShadow: '0 1px 6px rgba(0,0,0,0.35)' }}
          >{collection.description}</p>
        )}

        {/* Stat pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            t.collections.unitsCount(units.length),
            t.collections.wordsCount(totalWords),
            t.collections.completed(completedUnits, units.length),
          ].map((label) => (
            <span
              key={label}
              className="flex items-center gap-1 text-xs font-semibold bg-black/25 text-white rounded-full px-3 py-1"
            >
              {label}
            </span>
          ))}
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-white/25 overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {progressPct > 0 && (
          <p className="text-xs text-white/70 mt-1 text-right">{Math.round(progressPct)}% complete</p>
        )}
      </div>

      {/* ── Units grid ── */}
      <div
        className="flex-1 p-3 grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {units.map((unit) => (
          <UnitCard
            key={unit.dayNumber}
            unit={unit}
            collectionName={collectionName}
            heroGradient={hero.gradient}
          />
        ))}
      </div>
    </div>
  );
}

function UnitCard({
  unit, collectionName, heroGradient,
}: {
  unit: UnitRow; collectionName: string; heroGradient: string;
}) {
  const t = useTranslation();
  const { learnDone, flashcardDone, quizDone } = unit.progress;
  const stagesComplete = [learnDone, flashcardDone, quizDone].filter(Boolean).length;
  const isComplete = stagesComplete === 3;

  const [learnProgress, setLearnProgress] = useState<number | null>(null);
  const [hardCount, setHardCount] = useState(0);
  const [flashcardProgress, setFlashcardProgress] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [storyInfo] = useState(() =>
    getStoryUnlockInfo(collectionName, unit.dayNumber, unit.wordCount),
  );
  const [activeStory, setActiveStory] = useState<{ num: number; title: string; content: string } | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [tappedWord, setTappedWord] = useState<string | null>(null);

  useEffect(() => {
    setLearnProgress(getLearnProgress(collectionName, unit.dayNumber));
    setHardCount(getHardWordCount(collectionName, unit.dayNumber));
    const fp = getFlashcardProgress(collectionName, unit.dayNumber);
    setFlashcardProgress(fp ? fp.length : 0);
  }, [collectionName, unit.dayNumber]);

  const openStory = async (storyNumber: number) => {
    setStoryLoading(true);
    setActiveStory({ num: storyNumber, title: '', content: '' });
    const { data } = await supabase
      .from('unit_stories')
      .select('title, content')
      .eq('collection_name', collectionName)
      .eq('unit_number', unit.dayNumber)
      .eq('story_number', storyNumber)
      .maybeSingle();
    setActiveStory({ num: storyNumber, title: data?.title ?? '', content: data?.content ?? '' });
    setStoryLoading(false);
  };

  const storyEmojis = ['📖', '📕', '📗'];
  const storyLabels = ['Story 1 · Stage 4', 'Story 2 · Mastered', 'Story 3 · 30 Days Later'];
  const storyFlags = [storyInfo.story1Unlocked, storyInfo.story2Unlocked, storyInfo.story3Unlocked];

  const enc = encodeURIComponent(collectionName);
  const resumeUrl = learnProgress && learnProgress > 0
    ? `/learn?collection=${enc}&day=${unit.dayNumber}&startIndex=${learnProgress}`
    : null;
  const learnUrl  = `/learn?collection=${enc}&day=${unit.dayNumber}`;
  const flashUrl  = `/flashcards?collection=${enc}&day=${unit.dayNumber}`;
  const quizUrl   = `/quiz?collection=${enc}&day=${unit.dayNumber}`;
  const matchUrl  = `/matching?collection=${enc}&day=${unit.dayNumber}`;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'var(--surface)',
        border: isComplete ? '1.5px solid #22c55e' : '1.5px solid var(--border)',
        boxShadow: isComplete
          ? '0 0 0 3px rgba(34,197,94,0.1), 0 4px 16px rgba(0,0,0,0.08)'
          : '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      {/* Colored top accent strip */}
      <div className="h-1.5" style={{ background: isComplete ? '#22c55e' : heroGradient }} />

      <div className="p-4 flex flex-col gap-3 flex-1">

        {/* Unit header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
                style={{ background: isComplete ? '#22c55e' : 'var(--primary)' }}
              >
                Unit {unit.dayNumber}
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">{unit.wordCount} words</span>
              {isComplete && <span className="text-[10px] font-bold text-green-500">✓ Done</span>}
              {storyInfo.anyUnlocked && (
                <span className="text-[10px] font-bold text-amber-500">📚 {storyInfo.unlockedCount}</span>
              )}
            </div>
            <h3 className="font-bold text-[var(--text)] text-sm leading-tight truncate">{unit.topic}</h3>
          </div>
          <button
            onClick={() => setShowInfo(true)}
            className="text-sm opacity-40 hover:opacity-80 transition-opacity shrink-0 mt-0.5"
            aria-label={t.collections.howMarking}
          >🕯️</button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(stagesComplete / 3) * 100}%`,
              background: isComplete ? '#22c55e' : heroGradient,
            }}
          />
        </div>

        {/* Resume banners */}
        {!learnDone && resumeUrl && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--primary-bg)] border border-[var(--primary)] border-opacity-30">
            <span className="text-xs text-[var(--primary)]">{t.collections.savedAtWord((learnProgress ?? 0) + 1)}</span>
            <div className="flex gap-2">
              <Link href={resumeUrl} className="text-xs font-semibold text-[var(--primary)] hover:underline">{t.collections.continueBtn}</Link>
              <span className="text-[var(--text-muted)]">·</span>
              <Link href={learnUrl} className="text-xs text-[var(--text-muted)] hover:underline">{t.collections.restart}</Link>
            </div>
          </div>
        )}
        {!flashcardDone && flashcardProgress > 0 && (
          <div
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.25)' }}
          >
            <span className="text-xs font-medium" style={{ color: '#ea580c' }}>{t.collections.cardsRemaining(flashcardProgress)}</span>
            <div className="flex gap-2">
              <Link href={flashUrl} className="text-xs font-semibold hover:underline" style={{ color: '#ea580c' }}>{t.collections.continueBtn}</Link>
              <span className="text-[var(--text-muted)]">·</span>
              <Link href={`${flashUrl}&fresh=true`} className="text-xs text-[var(--text-muted)] hover:underline">{t.collections.restart}</Link>
            </div>
          </div>
        )}

        {/* Mode buttons */}
        <div className="grid grid-cols-3 gap-2">
          <ModeButton href={learnUrl} icon="📖" label="Learn" done={learnDone} color="#4f46e5" />
          <ModeButton
            href={flashUrl}
            icon="🃏"
            label={hardCount > 0 ? `Cards (${hardCount})` : 'Cards'}
            done={flashcardDone}
            color="#ea580c"
            locked={!learnDone}
            lockReason={t.collections.completeLearnFirst}
          />
          <ModeButton
            href={quizUrl}
            icon="❓"
            label="Quiz"
            done={quizDone}
            color="#d97706"
            locked={!learnDone}
            lockReason={t.collections.completeLearnFirst}
            softLocked={learnDone && !flashcardDone}
            softLockReason={t.collections.hardWordsRemain}
          />
        </div>

        {/* Match — full width */}
        <ModeButton href={matchUrl} icon="🎯" label="Match" done={false} color="#db2777" wide />

        {/* Stories */}
        {storyInfo.anyUnlocked && (
          <div className="pt-2 border-t border-[var(--border)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">📚 Stories</p>
            <div className="flex flex-col gap-1.5">
              {storyFlags.map((unlocked, i) => (
                <button
                  key={i}
                  disabled={!unlocked}
                  onClick={() => unlocked && openStory(i + 1)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all text-xs font-semibold ${
                    unlocked
                      ? 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'
                      : 'bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] opacity-40 cursor-not-allowed'
                  }`}
                >
                  <span>{storyEmojis[i]}</span>
                  <span className="flex-1">{storyLabels[i]}</span>
                  <span>{unlocked ? '→' : '🔒'}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Story reader modal */}
      {activeStory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setActiveStory(null)}
        >
          <div
            className="card max-w-lg w-full max-h-[85vh] flex flex-col animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="text-sm font-bold text-[var(--text)]">
                {storyEmojis[activeStory.num - 1]} {storyLabels[activeStory.num - 1]}
              </span>
              <button
                onClick={() => setActiveStory(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none"
              >×</button>
            </div>
            {storyLoading ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-2xl animate-bounce">📖</div>
              </div>
            ) : activeStory.content.trim() ? (
              <div className="overflow-y-auto flex flex-col gap-3">
                {activeStory.title && (
                  <h2 className="text-lg font-bold text-[var(--text)]">{activeStory.title}</h2>
                )}
                <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                  {activeStory.content.split(/\[\[([^\]]+)\]\]/).map((part, i) =>
                    i % 2 === 1 ? (
                      <button
                        key={i}
                        onClick={() => setTappedWord(part)}
                        className="inline font-semibold rounded px-0.5 transition-opacity hover:opacity-75"
                        style={{ color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
                      >{part}</button>
                    ) : <span key={i}>{part}</span>
                  )}
                </p>
                {tappedWord && (
                  <div
                    className="shrink-0 rounded-xl p-3 flex items-center gap-3"
                    style={{ background: 'var(--primary-bg)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)' }}
                  >
                    <span className="text-base font-bold flex-1" style={{ color: 'var(--primary)' }}>📖 {tappedWord}</span>
                    <button
                      onClick={() => { setTappedWord(null); setActiveStory(null); }}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg text-white shrink-0"
                      style={{ background: 'var(--primary)' }}
                    >Go to unit</button>
                    <button
                      onClick={() => setTappedWord(null)}
                      className="text-lg leading-none shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                    >×</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                <span className="text-4xl mb-3">{storyEmojis[activeStory.num - 1]}</span>
                <p className="font-semibold text-[var(--text)] mb-1">Story coming soon</p>
                <p className="text-xs text-[var(--text-muted)]">
                  You&apos;ve unlocked this story, but it hasn&apos;t been written yet.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Marking info modal */}
      {showInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="card max-w-sm w-full animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg mb-4 text-center">{t.collections.markingModal}</h3>
            <div className="space-y-3">
              {[
                { icon: '📖', label: 'Learn', desc: t.collections.markingLearn },
                { icon: '🃏', label: 'Flashcards', desc: t.collections.markingFlash },
                { icon: '❓', label: 'Quiz', desc: t.collections.markingQuiz },
                { icon: '🏆', label: 'Unit Complete', desc: t.collections.markingUnit },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="flex gap-3 items-start">
                  <span className="text-xl shrink-0">{icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
                    <p className="text-xs text-[var(--text-muted)]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowInfo(false)} className="btn-primary w-full mt-4">
              {t.common.gotIt}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeButton({
  href, icon, label, done, color, locked, lockReason, softLocked, softLockReason, wide,
}: {
  href: string; icon: string; label: string; done: boolean; color: string;
  locked?: boolean; lockReason?: string;
  softLocked?: boolean; softLockReason?: string;
  wide?: boolean;
}) {
  const base = `flex items-center justify-center ${wide ? 'flex-row gap-2 py-2.5 px-4' : 'flex-col gap-1.5 py-3'} rounded-xl text-xs font-bold transition-all`;

  if (locked) {
    return (
      <div
        title={lockReason}
        className={`${base} cursor-not-allowed select-none`}
        style={{ background: 'var(--surface-2)', border: '1.5px dashed var(--border)', opacity: 0.4 }}
      >
        <span className={wide ? 'text-base' : 'text-xl'}>🔒</span>
        <span className="text-[var(--text-muted)]">{label}</span>
      </div>
    );
  }
  if (softLocked) {
    return (
      <Link
        href={href}
        title={softLockReason}
        className={`${base} active:scale-95`}
        style={{ background: 'rgba(234,179,8,0.1)', border: '1.5px solid rgba(234,179,8,0.45)', color: '#ca8a04' }}
      >
        <span className={wide ? 'text-base' : 'text-xl'}>⚠️</span>
        <span>{label}</span>
      </Link>
    );
  }
  if (done) {
    return (
      <Link
        href={href}
        className={`${base} active:scale-95`}
        style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.35)', color: '#16a34a' }}
      >
        <span className={wide ? 'text-base' : 'text-xl'}>✓</span>
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} text-white active:scale-95 hover:opacity-90`}
      style={{ background: color, boxShadow: `0 3px 12px ${color}66` }}
    >
      <span className={wide ? 'text-base' : 'text-xl'}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
