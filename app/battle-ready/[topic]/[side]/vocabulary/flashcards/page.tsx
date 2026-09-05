'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { getBRSideContent, type BRSide } from '@/lib/battleReadyContent';

export default function VocabFlashcardsPage() {
  const params = useParams();
  const slug = String(params.topic);
  const side = String(params.side) as BRSide;
  const content = getBRSideContent(slug, side);
  if (!content) notFound();

  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const item = content.vocab[i];
  const sideColor = side === 'for' ? '#22c55e' : '#ef4444';

  function go(delta: number) {
    setI(prev => (prev + delta + content!.vocab.length) % content!.vocab.length);
    setFlipped(false);
  }

  return (
    <div className="p-4 space-y-5 animate-fade-in max-w-xl mx-auto">
      <BackButton href={`/battle-ready/${slug}/${side}/vocabulary`} label="Vocabulary" />
      <h1 className="text-lg font-bold text-[var(--text)]">Flashcards</h1>
      <div className="text-xs text-[var(--text-muted)] text-center">{i + 1} / {content.vocab.length}</div>

      <button
        onClick={() => setFlipped(f => !f)}
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center min-h-[180px] flex flex-col items-center justify-center gap-2"
      >
        <div className="font-bold text-xl text-[var(--text)]">{flipped ? item.definition : item.term}</div>
        {flipped && <div className="text-sm italic text-[var(--text-muted)]">“{item.example}”</div>}
      </button>

      <div className="flex gap-2">
        <button onClick={() => go(-1)} className="flex-1 rounded-xl py-2.5 font-bold text-sm border border-[var(--border)] text-[var(--text)]">← Prev</button>
        <button onClick={() => setFlipped(f => !f)} className="flex-1 rounded-xl py-2.5 font-bold text-sm text-white" style={{ background: sideColor }}>Flip</button>
        <button onClick={() => go(1)} className="flex-1 rounded-xl py-2.5 font-bold text-sm border border-[var(--border)] text-[var(--text)]">Next →</button>
      </div>
    </div>
  );
}
