'use client';
import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { STRUCTURES, UNIT_SLUGS } from '@/lib/structures-data';
import {
  getStructuresSRS, getNextSentenceBatch, advanceSentenceProgress,
  getSentenceProgress, getSentenceTotal,
} from '@/lib/storage';
import type { TranslationSentence } from '@/lib/types';

// Production practice: the learner writes their own English translation of
// each Uzbek sentence in a plain textarea (nothing is sent anywhere or
// graded), then taps "Show model answer" to self-check. Matches the
// well-supported finding that retrieval/production beats passive review —
// this is the one exercise in the Structures feature that asks for actual
// output rather than recognition.
export default function UnitTranslatePage({ params }: { params: Promise<{ unit: string }> }) {
  const { unit: slug } = use(params);
  const router = useRouter();
  const unit = UNIT_SLUGS[slug];

  const hasLearnedAny = useMemo(() => {
    if (!unit) return false;
    return getStructuresSRS().some(s => s.unit === unit);
  }, [unit]);

  const [batch, setBatch] = useState<TranslationSentence[]>(() => unit ? getNextSentenceBatch(unit, 3) : []);
  const [attempts, setAttempts] = useState<string[]>(() => batch.map(() => ''));
  const [revealed, setRevealed] = useState<boolean[]>(() => batch.map(() => false));
  const [finished, setFinished] = useState(false);
  const progress = unit ? getSentenceProgress(unit) : 0;
  const total = unit ? getSentenceTotal(unit) : 0;

  useEffect(() => {
    setAttempts(batch.map(() => ''));
    setRevealed(batch.map(() => false));
  }, [batch]);

  if (!unit) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen">
        <p className="text-[var(--text-muted)] mb-4">Unknown unit.</p>
        <Link href="/structures" className="btn-primary inline-block">Back to Structures</Link>
      </div>
    );
  }

  if (!hasLearnedAny) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-5xl mb-4">📭</div>
        <h2 className="font-bold text-xl mb-2">Learn a few {unit} structures first</h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">Translation practice draws on structures you've already learned in this unit.</p>
        <Link href={`/structures/${slug}/learn`} className="btn-primary inline-block">Learn {unit} →</Link>
      </div>
    );
  }

  if (batch.length === 0 || finished) {
    const done = progress >= total;
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen animate-fade-in">
        <div className="text-6xl mb-4">{done ? '🏆' : '✅'}</div>
        <h2 className="text-2xl font-bold mb-2">{done ? "That's every sentence!" : 'Batch complete'}</h2>
        <p className="text-[var(--text-muted)] mb-6">
          {Math.min(progress, total)}/{total} sentences translated in {unit}
          {!done && ' — come back next time for the next batch.'}
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link href={`/structures/${slug}`} className="btn-primary text-center">Back to {unit}</Link>
        </div>
      </div>
    );
  }

  const setAttempt = (i: number, value: string) => {
    setAttempts(prev => prev.map((a, idx) => idx === i ? value : a));
  };

  const reveal = (i: number) => {
    setRevealed(prev => prev.map((r, idx) => idx === i ? true : r));
  };

  const finishBatch = () => {
    advanceSentenceProgress(unit, batch.length);
    setFinished(true);
  };

  const allRevealed = revealed.every(Boolean);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between p-4">
        <button onClick={() => router.push(`/structures/${slug}`)} className="btn-icon" aria-label="Go back">←</button>
        <div className="text-center">
          <div className="font-semibold text-sm">Translate · {unit}</div>
          <div className="text-xs text-[var(--text-muted)]">{progress}/{total} done</div>
        </div>
        <div style={{ width: 32 }} />
      </div>

      <div className="flex-1 p-4 flex flex-col gap-5">
        {batch.map((sentence, i) => {
          const structure = sentence.structureId ? STRUCTURES.find(s => s.id === sentence.structureId) : undefined;
          return (
            <div key={sentence.id} className="card p-4 flex flex-col gap-3" style={{ borderLeft: '3px solid var(--primary)' }}>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Sentence {i + 1} of {batch.length}</p>
              <p className="text-lg font-bold text-[var(--text)] leading-snug">{sentence.uz}</p>
              <textarea
                value={attempts[i]}
                onChange={e => setAttempt(i, e.target.value)}
                placeholder="Write your English translation here…"
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)] resize-none"
              />
              {revealed[i] ? (
                <div className="bg-[var(--primary-bg)] rounded-xl p-3 space-y-1 animate-fade-in">
                  <p className="text-xs font-semibold text-[var(--primary)]">Model answer — compare it with your own:</p>
                  <p className="text-sm font-semibold text-[var(--primary)]">{sentence.en}</p>
                  {structure && (
                    <p className="text-xs text-[var(--text-muted)] pt-1">uses: {structure.pattern}</p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => reveal(i)}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-[var(--primary)] text-[var(--primary)] font-semibold text-sm hover:bg-[var(--primary-bg)] transition-colors"
                >
                  Show model answer
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={finishBatch}
          disabled={!allRevealed}
          className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {allRevealed ? 'Done with this batch' : 'Check all sentences to continue'}
        </button>
      </div>
    </div>
  );
}
