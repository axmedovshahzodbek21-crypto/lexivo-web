'use client';
import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UNIT_SLUGS } from '@/lib/structures-data';
import { getStructuresSRS, addXP, displayXP } from '@/lib/storage';
import type { SRSStructure } from '@/lib/types';

type CardSide = 'front' | 'back';

export default function UnitFlashcardsPage({ params }: { params: Promise<{ unit: string }> }) {
  const { unit: slug } = use(params);
  const router = useRouter();
  const unit = UNIT_SLUGS[slug];

  const [deck, setDeck] = useState<SRSStructure[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [side, setSide] = useState<CardSide>('front');
  const [known, setKnown] = useState(0);
  const [unknown, setUnknown] = useState(0);
  const [done, setDone] = useState(false);
  const [sessionXP, setSessionXP] = useState(0);

  useEffect(() => {
    if (!unit) { setLoaded(true); return; }
    const items = getStructuresSRS().filter(s => s.unit === unit);
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setDeck(shuffled);
    setLoaded(true);
  }, [unit]);

  const current = deck[index];

  const advance = useCallback((wasKnown: boolean) => {
    if (wasKnown) setKnown(k => k + 1); else setUnknown(u => u + 1);
    if (index + 1 >= deck.length) {
      const finalKnown = wasKnown ? known + 1 : known;
      if (finalKnown === deck.length) {
        const xpAmount = Math.round(deck.length * 3);
        addXP(xpAmount, 'Structure', 'Flashcards');
        setSessionXP(xpAmount);
      }
      setDone(true);
    } else {
      setIndex(i => i + 1);
      setSide('front');
    }
  }, [index, deck, known]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case ' ': case 'Enter': e.preventDefault(); setSide(s => s === 'front' ? 'back' : 'front'); break;
        case 'ArrowRight': case 'k': case 'K': if (side === 'back') advance(true); break;
        case 'ArrowLeft': case 'j': case 'J': if (side === 'back') advance(false); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [side, advance]);

  if (!unit) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen">
        <p className="text-[var(--text-muted)] mb-4">Unknown unit.</p>
        <Link href="/structures" className="btn-primary inline-block">Back to Structures</Link>
      </div>
    );
  }

  if (!loaded) return null;

  if (deck.length === 0) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-5xl mb-4">📭</div>
        <h2 className="font-bold text-xl mb-2">No {unit} structures in your deck yet</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">Learn some structures from this unit first, then come back to practice.</p>
        <Link href={`/structures/${slug}/learn`} className="btn-primary inline-block">Learn {unit} →</Link>
      </div>
    );
  }

  if (done) {
    const score = Math.round((known / deck.length) * 100);
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-6xl mb-4">{score >= 80 ? '🎉' : score >= 50 ? '👍' : '💪'}</div>
        <h2 className="text-2xl font-bold mb-2">Deck complete</h2>
        <p className="text-[var(--text-muted)] mb-6">{known} known · {unknown} to review · {score}%</p>
        <div className="grid grid-cols-3 gap-3 w-full mb-6">
          <div className="card text-center"><div className="text-2xl font-bold text-[var(--success)]">{known}</div><div className="text-xs text-[var(--text-muted)]">Known</div></div>
          <div className="card text-center"><div className="text-2xl font-bold text-[var(--danger)]">{unknown}</div><div className="text-xs text-[var(--text-muted)]">Review</div></div>
          <div className="card text-center"><div className="text-2xl font-bold text-[var(--primary)]">{score}%</div><div className="text-xs text-[var(--text-muted)]">Score</div></div>
        </div>
        {sessionXP > 0 && (
          <div className="w-full card mb-6 flex items-center justify-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-bold" style={{ color: 'var(--warning)' }}>+{displayXP(sessionXP)} XP</span>
          </div>
        )}
        <div className="flex flex-col gap-3 w-full">
          <Link href={`/structures/${slug}/translate`} className="btn-primary text-center">Practice Translation →</Link>
          <div className="flex gap-3">
            <button onClick={() => { setIndex(0); setSide('front'); setKnown(0); setUnknown(0); setSessionXP(0); setDone(false); }} className="btn-secondary flex-1">Again</button>
            <Link href={`/structures/${slug}`} className="btn-primary flex-1 text-center">Back</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between p-4">
        <button onClick={() => router.push(`/structures/${slug}`)} className="btn-icon" aria-label="Go back">←</button>
        <div className="text-center">
          <div className="font-semibold text-sm">Flashcards · {unit}</div>
          <div className="text-xs text-[var(--text-muted)]">{index + 1} / {deck.length}</div>
        </div>
        <div className="flex gap-2">
          <span className="text-xs font-medium text-[var(--success)]">✓{known}</span>
          <span className="text-xs font-medium text-[var(--danger)]">✗{unknown}</span>
        </div>
      </div>

      <div className="px-4">
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${((index + 1) / deck.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4">
        <div
          className="flip-card cursor-pointer flex-1"
          style={{ minHeight: 320 }}
          onClick={() => setSide(s => s === 'front' ? 'back' : 'front')}
        >
          <div className={`flip-card-inner w-full h-full ${side === 'back' ? 'flipped' : ''}`} style={{ minHeight: 320 }}>
            <div className="flip-card-front card flex flex-col items-center justify-center text-center p-6" style={{ minHeight: 320 }}>
              <div className="flex flex-wrap gap-1.5 justify-center mb-4">
                {current.ieltsUse.map(tag => (
                  <span key={tag} className="badge text-xs">{tag}</span>
                ))}
              </div>
              <h2 className="text-xl font-bold text-[var(--text)] leading-snug">{current.pattern}</h2>
              <p className="text-xs text-[var(--text-muted)] mt-3 leading-relaxed">💭 {current.scenario}</p>
              <p className="text-xs text-[var(--text-muted)] mt-4">Tap to reveal</p>
            </div>

            <div className="flip-card-back card flex flex-col items-center justify-center text-center p-6" style={{ minHeight: 320, background: 'var(--primary-bg)' }}>
              <p className="text-xs font-semibold text-[var(--primary)] mb-2">🇺🇿 O'zbek tarjimasi</p>
              <h2 className="text-xl font-bold text-[var(--primary)] mb-2">{current.uzTranslation}</h2>
              <p className="text-sm text-[var(--text)] mb-1">{current.definition}</p>
              <p className="text-sm text-[var(--primary)] mb-3">{current.uzDefinition}</p>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 w-full space-y-1">
                <p className="text-xs italic text-[var(--text)]">"{current.examples[0]}"</p>
                <p className="text-xs italic text-[var(--text-muted)]">"{current.exampleTranslations[0]}"</p>
              </div>
            </div>
          </div>
        </div>

        {side === 'back' ? (
          <div className="flex gap-3">
            <button
              onClick={() => advance(false)}
              className="flex-1 py-4 rounded-xl border-2 border-[var(--danger)] text-[var(--danger)] font-bold text-lg hover:bg-red-50 transition-colors press-3d"
            >
              Again
            </button>
            <button
              onClick={() => advance(true)}
              className="flex-1 py-4 rounded-xl border-2 border-[var(--success)] text-[var(--success)] font-bold text-lg hover:bg-green-50 transition-colors press-3d"
            >
              Know It
            </button>
          </div>
        ) : (
          <div className="text-center text-sm text-[var(--text-muted)]">Tap to reveal</div>
        )}
      </div>
    </div>
  );
}
