'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { getUnitProgress } from '@/lib/storage';
import type { UnitProgress, WordCollection } from '@/lib/types';

type Mode = 'learn' | 'flashcards' | 'quiz';

const MODE_CONFIG: Record<Mode, { label: string; icon: string; color: string }> = {
  learn:      { label: 'Learn',      icon: '📖', color: 'var(--primary)' },
  flashcards: { label: 'Flashcards', icon: '🃏', color: '#FF6B35' },
  quiz:       { label: 'Quiz',       icon: '❓', color: 'var(--warning)' },
};

function isLocked(mode: Mode, p: UnitProgress): boolean {
  if (mode === 'flashcards') return !p.learnDone;
  if (mode === 'quiz') return !p.flashcardDone;
  return false;
}

function isDone(mode: Mode, p: UnitProgress): boolean {
  if (mode === 'learn')      return p.learnDone;
  if (mode === 'flashcards') return p.flashcardDone;
  if (mode === 'quiz')       return p.quizDone;
  return false;
}

function lockLabel(mode: Mode): string {
  if (mode === 'flashcards') return 'Complete Learn first';
  if (mode === 'quiz')       return 'Complete Flashcards first';
  return '';
}

function isFullyDone(p: UnitProgress): boolean {
  return p.learnDone && p.flashcardDone && p.quizDone;
}

// ── Unit list (after collection is selected) ─────────────────────────────────

function UnitList({
  mode, col, cfg, onBack,
}: {
  mode: Mode;
  col: WordCollection;
  cfg: typeof MODE_CONFIG[Mode];
  onBack: () => void;
}) {
  return (
    <div className="p-4 space-y-3 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onBack}
          className="btn-icon text-lg"
          aria-label="Go back"
        >←</button>
        <div className="min-w-0">
          <p className="text-xs text-[var(--text-muted)] truncate">{col.name}</p>
          <h1 className="text-lg font-bold text-[var(--text)] leading-tight">
            {cfg.icon} Pick a unit to {cfg.label.toLowerCase()}
          </h1>
        </div>
      </div>

      <div className="space-y-2">
        {col.days.map(day => {
          const progress = getUnitProgress(col.name, day.dayNumber);
          const locked    = isLocked(mode, progress);
          const done      = isDone(mode, progress);
          const fullyDone = isFullyDone(progress);
          const href      = `/${mode}?collection=${encodeURIComponent(col.name)}&day=${day.dayNumber}`;

          if (locked) {
            return (
              <div
                key={day.dayNumber}
                title={lockLabel(mode)}
                className="card flex items-center gap-3 opacity-40 cursor-not-allowed select-none"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] flex items-center justify-center text-lg shrink-0">
                  🔒
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] truncate">
                    Unit {day.dayNumber} · {day.topic}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">{lockLabel(mode)}</p>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={day.dayNumber}
              href={href}
              className={`card flex items-center gap-3 transition-colors cursor-pointer hover:border-[var(--primary)] ${
                fullyDone
                  ? 'border-[var(--success)] bg-green-50/30'
                  : done
                  ? 'border-[var(--success)]'
                  : ''
              }`}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{
                  background: fullyDone
                    ? 'rgba(16,185,129,0.15)'
                    : done
                    ? 'rgba(16,185,129,0.12)'
                    : `${cfg.color}18`,
                }}
              >
                {fullyDone ? '🏆' : done ? '✅' : cfg.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text)] truncate">
                  Unit {day.dayNumber} · {day.topic}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {day.words.length} words
                  {fullyDone ? ' · All complete 🎉' : done ? ' · Done' : ''}
                </p>
              </div>
              <span
                className="text-sm font-semibold shrink-0"
                style={{ color: fullyDone || done ? 'var(--success)' : cfg.color }}
              >
                {fullyDone ? '✓' : done ? '✓' : '→'}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Collection list (top level) ───────────────────────────────────────────────

export default function UnitPicker({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { collections, collectionsLoaded } = useAppStore();
  const cfg = MODE_CONFIG[mode];
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);

  if (!collectionsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-4xl animate-bounce">{cfg.icon}</div>
      </div>
    );
  }

  if (selectedCollection !== null) {
    const col = collections.find(c => c.name === selectedCollection);
    if (col) {
      return (
        <UnitList
          mode={mode}
          col={col}
          cfg={cfg}
          onBack={() => setSelectedCollection(null)}
        />
      );
    }
  }

  return (
    <div className="p-4 space-y-3 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => router.back()}
          className="btn-icon"
          aria-label="Go back"
        >←</button>
        <h1 className="text-xl font-bold text-[var(--text)]">
          {cfg.icon} Choose a collection
        </h1>
      </div>

      {collections.map(col => {
        const totalUnits = col.days.length;
        const totalWords = col.days.reduce((acc, d) => acc + d.words.length, 0);
        const fullyDoneCount = col.days.filter(d => {
          const p = getUnitProgress(col.name, d.dayNumber);
          return p.learnDone && p.flashcardDone && p.quizDone;
        }).length;
        const modeDoneCount = col.days.filter(d => {
          const p = getUnitProgress(col.name, d.dayNumber);
          return isDone(mode, p);
        }).length;

        const allComplete = fullyDoneCount === totalUnits;

        return (
          <button
            key={col.name}
            onClick={() => setSelectedCollection(col.name)}
            className={`card w-full flex items-center gap-4 text-left transition-colors hover:border-[var(--primary)] ${
              allComplete ? 'border-[var(--success)] bg-green-50/30' : ''
            }`}
          >
            {/* Icon */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
              style={{
                background: allComplete ? 'rgba(16,185,129,0.15)' : `${cfg.color}18`,
              }}
            >
              {allComplete ? '🏆' : cfg.icon}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[var(--text)] truncate">{col.name}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {totalUnits} units · {totalWords} words
              </p>
              {/* Progress line */}
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${totalUnits ? (modeDoneCount / totalUnits) * 100 : 0}%`,
                      background: modeDoneCount === totalUnits ? 'var(--success)' : cfg.color,
                    }}
                  />
                </div>
                <span className="text-xs font-semibold shrink-0" style={{ color: cfg.color }}>
                  {modeDoneCount}/{totalUnits}
                </span>
              </div>
              {fullyDoneCount > 0 && (
                <p className="text-xs text-[var(--success)] font-medium mt-0.5">
                  {fullyDoneCount === totalUnits ? 'All units complete! 🎉' : `${fullyDoneCount} fully complete`}
                </p>
              )}
            </div>

            <span className="text-[var(--text-muted)] shrink-0">›</span>
          </button>
        );
      })}
    </div>
  );
}
