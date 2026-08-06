'use client';
import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { getUnitProgress, getLearnProgress, getHardWordCount, getFlashcardProgress, getStoryUnlockInfo, getSRSWords, getReviewLog, getLearnedWords } from '@/lib/storage';
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
  const sp = useSearchParams();
  const doneOnly = sp.get('doneOnly') === 'true';
  const t = useTranslation();
  const { collections, collectionsLoaded } = useAppStore();

  const [collection, setCollection] = useState<WordCollection | null>(null);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [cols, setCols] = useState(2);

  // Heatmap
  type WordMastery = { word: string; srsScore: number; gateScore: number | null; combined: number };
  type UnitMastery = { dayNumber: number; topic: string; words: WordMastery[]; avgScore: number };
  const [unitMastery, setUnitMastery] = useState<UnitMastery[]>([]);
  const [heatmapLoaded, setHeatmapLoaded] = useState(false);
  const [heatmapUnit, setHeatmapUnit] = useState<number | null>(null);

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
    const allRows: UnitRow[] = found.days.map(day => ({
      dayNumber: day.dayNumber,
      topic: day.topic || `Unit ${day.dayNumber}`,
      wordCount: day.words.length,
      progress: getUnitProgress(collectionName, day.dayNumber),
    }));
    const rows = doneOnly
      ? allRows.filter(r => r.progress.learnDone && r.progress.flashcardDone && r.progress.quizDone)
      : allRows;
    setUnits(rows);
  }, [collectionsLoaded, collections, collectionName]);

  useEffect(() => {
    if (!collection) return;
    const reviewLog = getReviewLog();
    const srsWords = getSRSWords();
    const learnedWords = getLearnedWords();
    const srsSet = new Set(srsWords.filter(w => w.collectionName === collectionName).map(w => w.id));
    const learnedSet = new Set(learnedWords.filter(w => w.collectionName === collectionName).map(w => `${collectionName}::${w.word}`));

    const build = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const gateMap: Record<string, { attempts: number; correct: number }> = {};
      if (user) {
        const { data } = await supabase
          .from('learn_session_analytics')
          .select('per_word_data')
          .eq('student_id', user.id)
          .eq('collection_name', collectionName);
        for (const row of data ?? []) {
          for (const w of (row.per_word_data ?? []) as { word: string; gate_attempts: number; gate_correct_first: boolean }[]) {
            if (!gateMap[w.word]) gateMap[w.word] = { attempts: 0, correct: 0 };
            gateMap[w.word].attempts += 1; // count sessions, not gate openings within a session
            if (w.gate_correct_first) gateMap[w.word].correct += 1;
          }
        }
      }

      const result: UnitMastery[] = collection.days.map(day => {
        const words: WordMastery[] = day.words.map(w => {
          const id = `${collectionName}::${w.word}`;
          // Use 6 as the denominator (learn session = stage 0, then 5 review intervals).
          // Newly learned words with 0 reviews score 1/6 ≈ 0.17 (red) instead of 0 (grey).
          const intervals = reviewLog[id] ?? [];
          const srsScore = !learnedSet.has(id)
            ? 0.0
            : (1 + Math.min(intervals.length, 5)) / 6;
          const gate = gateMap[w.word];
          const gateScore = gate && gate.attempts > 0 ? gate.correct / gate.attempts : null;
          const combined = srsScore === 0 && gateScore === null
            ? 0
            : srsScore * 0.6 + (gateScore ?? 0) * 0.4;
          return { word: w.word, srsScore, gateScore, combined };
        });
        const avgScore = words.length > 0 ? words.reduce((s, w) => s + w.combined, 0) / words.length : 0;
        return { dayNumber: day.dayNumber, topic: day.topic ?? `Unit ${day.dayNumber}`, words, avgScore };
      });

      setUnitMastery(result);
      setHeatmapLoaded(true);
    };

    build();
  }, [collection, collectionName]);

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
      {doneOnly && units.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <div className="text-5xl mb-4">🎯</div>
            <p className="font-bold text-[var(--text)] mb-1">No completed units yet</p>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-xs">
              Complete Learn → Flashcards → Quiz for a unit to unlock it here.
            </p>
          </div>
        </div>
      ) : (
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
      )}

      {/* ── Word Mastery Heatmap ── */}
      {heatmapLoaded && (
        <div className="px-3 pb-6">
          <MasteryHeatmap
            unitMastery={unitMastery}
            collection={collection}
            selectedUnit={heatmapUnit}
            onSelectUnit={setHeatmapUnit}
          />
        </div>
      )}
    </div>
  );
}

// ── Heatmap helpers ───────────────────────────────────────────────────────

function masteryColor(score: number): string {
  if (score === 0) return 'var(--border)';
  if (score < 0.2) return '#ef4444';
  if (score < 0.4) return '#f97316';
  if (score < 0.6) return '#eab308';
  if (score < 0.8) return '#84cc16';
  return '#22c55e';
}

function masteryLabel(score: number): string {
  if (score === 0) return 'Not studied';
  if (score < 0.2) return 'Needs work';
  if (score < 0.4) return 'Struggling';
  if (score < 0.6) return 'Learning';
  if (score < 0.8) return 'Good';
  return 'Mastered';
}

type WordMastery = { word: string; srsScore: number; gateScore: number | null; combined: number };
type UnitMastery = { dayNumber: number; topic: string; words: WordMastery[]; avgScore: number };

function MasteryHeatmap({
  unitMastery, collection, selectedUnit, onSelectUnit,
}: {
  unitMastery: UnitMastery[];
  collection: WordCollection;
  selectedUnit: number | null;
  onSelectUnit: (u: number | null) => void;
}) {
  const drillUnit = selectedUnit !== null ? unitMastery.find(u => u.dayNumber === selectedUnit) : null;
  const collectionDay = drillUnit
    ? collection.days.find(d => d.dayNumber === drillUnit.dayNumber)
    : null;

  const totalStudied = unitMastery.flatMap(u => u.words).filter(w => w.combined > 0).length;
  const totalWords = unitMastery.flatMap(u => u.words).length;
  const avgMastery = totalWords > 0
    ? unitMastery.flatMap(u => u.words).reduce((s, w) => s + w.combined, 0) / totalWords
    : 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm text-[var(--text)]">🗺 Word Mastery Heatmap</h3>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
            {totalStudied}/{totalWords} words studied · avg {Math.round(avgMastery * 100)}% mastery
          </p>
        </div>
        {drillUnit && (
          <button
            onClick={() => onSelectUnit(null)}
            className="text-xs font-semibold text-[var(--primary)] hover:opacity-70 transition-opacity"
          >
            ← All units
          </button>
        )}
      </div>

      {drillUnit ? (
        /* ── Per-word drill-down ── */
        <div className="space-y-2">
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
            Unit {drillUnit.dayNumber} · {drillUnit.topic}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {drillUnit.words.map((w, i) => {
              const col = collectionDay?.words[i];
              return (
                <div
                  key={w.word}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{ background: 'var(--surface-2)', borderLeft: `3px solid ${masteryColor(w.combined)}` }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[var(--text)] truncate">{w.word}</p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate">{col?.translation ?? ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black" style={{ color: masteryColor(w.combined) }}>
                      {Math.round(w.combined * 100)}%
                    </p>
                    <p className="text-[9px] text-[var(--text-muted)]">{masteryLabel(w.combined)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {/* SRS + gate breakdown legend */}
          <div className="flex gap-4 px-1 pt-1">
            <p className="text-[9px] text-[var(--text-muted)]">⬜ SRS 60% + 🎯 Gate 40%</p>
          </div>
        </div>
      ) : (
        /* ── Per-unit overview grid ── */
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-1.5">
            {unitMastery.map(u => (
              <button
                key={u.dayNumber}
                onClick={() => onSelectUnit(u.dayNumber)}
                className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition-transform active:scale-95 hover:opacity-80"
                style={{ background: masteryColor(u.avgScore) + '22', border: `2px solid ${masteryColor(u.avgScore)}` }}
                title={`Unit ${u.dayNumber}: ${masteryLabel(u.avgScore)} (${Math.round(u.avgScore * 100)}%)`}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                  style={{ background: masteryColor(u.avgScore) }}
                >
                  {u.dayNumber}
                </div>
                <p className="text-[8px] font-bold" style={{ color: masteryColor(u.avgScore) }}>
                  {Math.round(u.avgScore * 100)}%
                </p>
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 flex-wrap px-1 pt-1">
            {[
              { color: 'var(--border)', label: 'Not studied' },
              { color: '#ef4444', label: 'Needs work' },
              { color: '#eab308', label: 'Learning' },
              { color: '#84cc16', label: 'Good' },
              { color: '#22c55e', label: 'Mastered' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span className="text-[9px] text-[var(--text-muted)]">{label}</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-[var(--text-muted)] px-1">Tap a unit to see word-by-word breakdown</p>
        </div>
      )}
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
        <ModeButton
          href={matchUrl}
          icon="🎯"
          label="Match"
          done={false}
          color="#db2777"
          wide
          locked={!learnDone}
          lockReason={t.collections.completeLearnFirst}
        />

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
