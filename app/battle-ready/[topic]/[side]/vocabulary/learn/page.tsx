'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { getBRSideContent, type BRSide } from '@/lib/battleReadyContent';

export default function VocabLearnPage() {
  const params = useParams();
  const slug = String(params.topic);
  const side = String(params.side) as BRSide;
  const content = getBRSideContent(slug, side);
  if (!content) notFound();

  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const item = content.vocab[i];
  const isLast = i === content.vocab.length - 1;
  const sideColor = side === 'for' ? '#22c55e' : '#ef4444';

  function next() {
    if (!revealed) { setRevealed(true); return; }
    if (isLast) return;
    setI(i + 1);
    setRevealed(false);
  }

  return (
    <div className="p-4 space-y-5 animate-fade-in max-w-xl mx-auto">
      <BackButton href={`/battle-ready/${slug}/${side}/vocabulary`} label="Vocabulary" />
      <h1 className="text-lg font-bold text-[var(--text)]">Learn</h1>

      <div className="text-xs text-[var(--text-muted)]">{i + 1} / {content.vocab.length}</div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-3">
        <div className="font-bold text-xl text-[var(--text)]">{item.term}</div>
        {revealed && (
          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <div className="text-sm text-[var(--text)]">{item.definition}</div>
            <div className="text-sm italic text-[var(--text-muted)]">“{item.example}”</div>
          </div>
        )}
      </div>

      <button
        onClick={next}
        disabled={revealed && isLast}
        className="w-full rounded-xl py-3 font-bold text-white text-sm disabled:opacity-40"
        style={{ background: sideColor }}
      >
        {!revealed ? 'Reveal meaning' : isLast ? 'All words learned' : 'Next word'}
      </button>
    </div>
  );
}
