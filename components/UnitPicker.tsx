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

const UNIT_COLORS = [
  { color: '#6366F1', light: '#818CF8', dark: '#4338CA' },
  { color: '#F97316', light: '#FB923C', dark: '#C2410C' },
  { color: '#10B981', light: '#34D399', dark: '#059669' },
  { color: '#EC4899', light: '#F472B6', dark: '#BE185D' },
  { color: '#8B5CF6', light: '#A78BFA', dark: '#6D28D9' },
  { color: '#06B6D4', light: '#22D3EE', dark: '#0891B2' },
  { color: '#EAB308', light: '#FDE047', dark: '#A16207' },
  { color: '#EF4444', light: '#F87171', dark: '#B91C1C' },
  { color: '#14B8A6', light: '#2DD4BF', dark: '#0F766E' },
  { color: '#F59E0B', light: '#FCD34D', dark: '#B45309' },
  { color: '#3B82F6', light: '#60A5FA', dark: '#1D4ED8' },
  { color: '#84CC16', light: '#A3E635', dark: '#4D7C0F' },
];

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
    <div className="p-4 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2 mb-5">
        <button onClick={onBack} className="btn-icon text-lg" aria-label="Go back">←</button>
        <div className="min-w-0">
          <p className="text-xs text-[var(--text-muted)] truncate">{col.name}</p>
          <h1 className="text-lg font-bold text-[var(--text)] leading-tight">
            {cfg.icon} Pick a unit to {cfg.label.toLowerCase()}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {col.days.map((day, i) => {
          const progress  = getUnitProgress(col.name, day.dayNumber);
          const locked    = isLocked(mode, progress);
          const done      = isDone(mode, progress);
          const fullyDone = isFullyDone(progress);
          const href      = `/${mode}?collection=${encodeURIComponent(col.name)}&day=${day.dayNumber}`;
          const { color, light, dark } = UNIT_COLORS[i % UNIT_COLORS.length];
          const numStr    = String(day.dayNumber).padStart(2, '0');

          if (locked) {
            return (
              <div
                key={day.dayNumber}
                title={lockLabel(mode)}
                style={{
                  borderRadius: 20,
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  opacity: 0.38,
                  padding: '16px 14px',
                  position: 'relative',
                  overflow: 'hidden',
                  minHeight: 130,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'not-allowed',
                  userSelect: 'none',
                }}
              >
                <div style={{
                  position: 'absolute', right: 6, top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 68, fontWeight: 900,
                  color: 'var(--border)', lineHeight: 1,
                  userSelect: 'none', pointerEvents: 'none',
                }}>{numStr}</div>
                <span style={{ fontSize: 20 }}>🔒</span>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', lineHeight: 1.2 }}>
                    Unit {day.dayNumber}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                    {lockLabel(mode)}
                  </p>
                </div>
              </div>
            );
          }

          const gradBg = fullyDone
            ? 'linear-gradient(135deg, #34D399, #10B981, #059669)'
            : `linear-gradient(135deg, ${light}, ${color}, ${dark})`;
          const shadow = fullyDone
            ? '0 4px 0 #059669, 0 8px 20px #10B98155'
            : `0 4px 0 ${dark}, 0 8px 20px ${color}55`;

          return (
            <Link
              key={day.dayNumber}
              href={href}
              style={{
                display: 'block',
                position: 'relative',
                borderRadius: 20,
                overflow: 'hidden',
                background: gradBg,
                boxShadow: shadow,
                padding: '16px 14px',
                minHeight: 130,
                textDecoration: 'none',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              {/* Watermark unit number */}
              <div style={{
                position: 'absolute', right: 6, top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 68, fontWeight: 900,
                color: 'rgba(255,255,255,0.07)',
                lineHeight: 1,
                userSelect: 'none', pointerEvents: 'none',
              }}>{numStr}</div>

              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                {/* Status icon */}
                <span style={{ fontSize: 20, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                  {fullyDone ? '🏆' : done ? '✅' : cfg.icon}
                </span>

                {/* Name + badge */}
                <div style={{ marginTop: 10 }}>
                  <p style={{
                    fontSize: 10, fontWeight: 700,
                    color: 'rgba(255,255,255,0.65)',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    marginBottom: 3,
                  }}>Unit {day.dayNumber}</p>
                  <p style={{
                    fontSize: 12, fontWeight: 900, color: '#fff',
                    lineHeight: 1.25, marginBottom: 8,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }}>
                    {day.topic}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: 'rgba(255,255,255,0.85)',
                      background: 'rgba(0,0,0,0.22)',
                      borderRadius: 6, padding: '2px 8px',
                    }}>
                      {day.words.length} words
                    </span>
                    {(done || fullyDone) && (
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.95)', fontWeight: 900 }}>✓</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const COLLECTION_META: Record<string, { icon: string; gradient: string; edge: string; glow: string }> = {
  '30 Days of Powerful Words': { icon: '🏆', gradient: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 100%)', edge: '#312e81', glow: 'rgba(55,48,163,0.45)'  },
  '24 Vocabulary Challenge':   { icon: '💡', gradient: 'linear-gradient(135deg, #9f1239 0%, #be185d 100%)', edge: '#881337', glow: 'rgba(159,18,57,0.45)'  },
  'Word Mastery':              { icon: '🎯', gradient: 'linear-gradient(135deg, #14532d 0%, #166534 100%)', edge: '#052e16', glow: 'rgba(20,83,45,0.45)'   },
  'A1':                        { icon: '🌱', gradient: 'linear-gradient(135deg, #075985 0%, #0369a1 100%)', edge: '#0c4a6e', glow: 'rgba(7,89,133,0.45)'   },
  'A2':                        { icon: '🌿', gradient: 'linear-gradient(135deg, #5b21b6 0%, #6d28d9 100%)', edge: '#4c1d95', glow: 'rgba(91,33,182,0.45)'  },
  'B1':                        { icon: '📘', gradient: 'linear-gradient(135deg, #78350f 0%, #92400e 100%)', edge: '#431407', glow: 'rgba(120,53,15,0.45)'  },
  'Advanced':                  { icon: '🎓', gradient: 'linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)', edge: '#7f1d1d', glow: 'rgba(153,27,27,0.45)'  },
};

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
    <div className="p-4 pb-24 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2 mb-5">
        <button onClick={() => router.back()} className="btn-icon" aria-label="Go back">←</button>
        <h1 className="text-xl font-bold text-[var(--text)]">
          {cfg.icon} Choose a collection
        </h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {collections.map(col => {
          const totalUnits    = col.days.length;
          const totalWords    = col.days.reduce((acc, d) => acc + d.words.length, 0);
          const modeDoneCount = col.days.filter(d => isDone(mode, getUnitProgress(col.name, d.dayNumber))).length;
          const allDone       = modeDoneCount === totalUnits;
          const pct           = totalUnits ? (modeDoneCount / totalUnits) * 100 : 0;
          const meta          = COLLECTION_META[col.name] ?? {
            icon: '📖',
            gradient: 'linear-gradient(135deg, #6c63ff, #8b5cf6)',
            edge: '#3f38cc',
            glow: 'rgba(108,99,255,0.4)',
          };

          return (
            <button
              key={col.name}
              onClick={() => setSelectedCollection(col.name)}
              className="block group text-left w-full"
            >
              <div
                className="rounded-3xl p-4 flex flex-col gap-3 transition-all duration-200 group-hover:-translate-y-1 h-full"
                style={{
                  background: meta.gradient,
                  boxShadow: `0 8px 0 ${meta.edge}, 0 14px 32px ${meta.glow}`,
                }}
              >
                <div className="text-4xl" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }}>
                  {allDone ? '🏆' : meta.icon}
                </div>
                <div style={{ textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                  <p className="font-black text-white text-sm leading-snug">{col.name}</p>
                  <p className="text-white/80 text-xs mt-0.5">{totalUnits} units · {totalWords} words</p>
                </div>
                <div className="mt-auto">
                  <div className="h-1.5 rounded-full bg-white/30 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-white transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-white/80 text-[11px] font-semibold mt-1">
                    {allDone ? 'Complete ✓' : `${modeDoneCount} / ${totalUnits}`}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
