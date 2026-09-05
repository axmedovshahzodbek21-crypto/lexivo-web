'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStructuresSRS, addXP, displayXP } from '@/lib/storage';
import { STRUCTURES } from '@/lib/structures-data';
import type { SRSStructure } from '@/lib/types';

const TILE_COLORS = [
  { bg: '#e21b3c', shadow: '#a01328', shape: '▲' },
  { bg: '#1368ce', shadow: '#0d4fa0', shape: '◆' },
  { bg: '#d89e00', shadow: '#a07500', shape: '●' },
  { bg: '#26890c', shadow: '#1c6409', shape: '■' },
] as const;

// Distractors: prefer other patterns already in the learner's deck (real
// competitors they might confuse this one with), fall back to the full
// STRUCTURES bank so even a tiny deck still gets a real 4-option round.
function buildChoices(current: SRSStructure, deck: SRSStructure[]): string[] {
  const correct = current.pattern;
  const pool = new Set<string>();
  for (const s of deck) if (s.id !== current.id) pool.add(s.pattern);
  if (pool.size < 3) for (const s of STRUCTURES) if (s.id !== current.id) pool.add(s.pattern);
  const wrong = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
  return [correct, ...wrong].sort(() => Math.random() - 0.5);
}

export default function StructuresDetectivePage() {
  const router = useRouter();
  const [deck, setDeck] = useState<SRSStructure[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [tapped, setTapped] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  const [sessionXP, setSessionXP] = useState(0);

  useEffect(() => {
    const items = getStructuresSRS().filter(s => s.scenario);
    const shuffled = [...items].sort(() => Math.random() - 0.5).slice(0, 10);
    setDeck(shuffled);
    setLoaded(true);
  }, []);

  const current = deck[index];

  useEffect(() => {
    if (!current) return;
    setChoices(buildChoices(current, deck));
    setTapped(null);
  }, [current, deck]);

  const finish = useCallback((finalCorrect: number) => {
    if (finalCorrect > 0) {
      const xpAmount = finalCorrect * 3;
      addXP(xpAmount, 'Structure', 'Detective');
      setSessionXP(xpAmount);
    }
    setDone(true);
  }, []);

  const handleTap = (choice: string) => {
    if (tapped || !current) return;
    setTapped(choice);
    const wasCorrect = choice === current.pattern;
    const newCorrect = wasCorrect ? correctCount + 1 : correctCount;
    if (wasCorrect) setCorrectCount(newCorrect);
    setTimeout(() => {
      if (index + 1 >= deck.length) {
        finish(newCorrect);
      } else {
        setIndex(i => i + 1);
      }
    }, 1200);
  };

  const progress = deck.length > 0 ? ((index + (tapped ? 1 : 0)) / deck.length) * 100 : 0;

  if (!loaded) return null;

  if (deck.length === 0) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-5xl mb-4">📭</div>
        <h2 className="font-bold text-xl mb-2">No structures in your deck yet</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">Learn some structures first, then come back to test yourself.</p>
        <Link href="/structures" className="btn-primary inline-block">Go to Structures →</Link>
      </div>
    );
  }

  if (done) {
    const score = Math.round((correctCount / deck.length) * 100);
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-6xl mb-4">{score >= 80 ? '🕵️‍♂️' : score >= 50 ? '🔍' : '💪'}</div>
        <h2 className="text-2xl font-bold mb-2">Case closed</h2>
        <p className="text-[var(--text-muted)] mb-6">{correctCount}/{deck.length} correct · {score}%</p>
        {sessionXP > 0 && (
          <div className="w-full card mb-6 flex items-center justify-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-bold" style={{ color: 'var(--warning)' }}>+{displayXP(sessionXP)} XP</span>
          </div>
        )}
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={() => { setIndex(0); setCorrectCount(0); setSessionXP(0); setDone(false); setDeck(d => [...d].sort(() => Math.random() - 0.5)); }}
            className="btn-secondary"
          >
            Again
          </button>
          <Link href="/structures" className="btn-primary text-center">Back to Structures</Link>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between p-4">
        <button onClick={() => router.back()} className="btn-icon" aria-label="Go back">✕</button>
        <div className="text-center">
          <div className="font-semibold text-sm">🕵️ Structure Detective</div>
          <div className="text-xs text-[var(--text-muted)]">{index + 1} / {deck.length}</div>
        </div>
        <span className="text-xs font-medium text-[var(--success)]">✓{correctCount}</span>
      </div>

      <div className="px-4">
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4">
        <div className="card p-5 flex flex-col gap-2" style={{ borderLeft: '3px solid var(--warning)' }}>
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">The situation</p>
          <p className="text-lg font-bold text-[var(--text)] leading-snug">💭 {current.scenario}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Which structure fits best?</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {choices.map((choice, i) => {
            const tile = TILE_COLORS[i % 4];
            const answered = tapped !== null;
            const isCorrect = choice === current.pattern;
            const isTapped = choice === tapped;
            let bgColor = tile.bg;
            let shadowColor = tile.shadow;
            let opacity = 1;
            if (answered) {
              if (isCorrect) { bgColor = '#26890c'; shadowColor = '#1c6409'; }
              else if (isTapped) { bgColor = '#e21b3c'; shadowColor = '#a01328'; }
              else { opacity = 0.35; }
            }
            return (
              <button
                key={choice}
                onClick={() => handleTap(choice)}
                disabled={answered}
                className="relative rounded-2xl p-4 flex items-start gap-3 text-left transition-all duration-200 active:translate-y-1"
                style={{ backgroundColor: bgColor, boxShadow: `0 4px 0 ${shadowColor}`, opacity }}
              >
                <span className="text-lg text-white/70 leading-none flex-shrink-0">{tile.shape}</span>
                <span className="text-white font-semibold text-sm leading-snug" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{choice}</span>
                {answered && isCorrect && <span className="absolute top-3 right-3 text-white text-lg font-black">✓</span>}
                {answered && isTapped && !isCorrect && <span className="absolute top-3 right-3 text-white text-lg font-black">✗</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
