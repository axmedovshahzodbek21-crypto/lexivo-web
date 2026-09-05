'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { getBRSideContent, type BRSide } from '@/lib/battleReadyContent';

export default function ArgumentsPage() {
  const params = useParams();
  const slug = String(params.topic);
  const side = String(params.side) as BRSide;
  const content = getBRSideContent(slug, side);
  if (!content) notFound();

  const sideColor = side === 'for' ? '#22c55e' : '#ef4444';
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const open = openIdx !== null ? content.arguments[openIdx] : null;

  return (
    <div className="p-4 space-y-5 animate-fade-in max-w-2xl mx-auto">
      <BackButton href={`/battle-ready/${slug}/${side}`} label="Categories" />
      <div>
        <h1 className="text-lg font-bold text-[var(--text)]">Arguments</h1>
        <p className="text-xs text-[var(--text-muted)]">{content.arguments.length} arguments. Tap one to read the full explanation.</p>
      </div>

      <div className="space-y-2">
        {content.arguments.map((a, idx) => (
          <button
            key={idx}
            onClick={() => setOpenIdx(idx)}
            className="w-full text-left rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:-translate-y-0.5 transition-transform flex items-center justify-between gap-3"
          >
            <div className="font-bold text-sm text-[var(--text)]">{idx + 1}. {a.claim}</div>
            <span className="text-lg shrink-0" style={{ color: sideColor }}>›</span>
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => setOpenIdx(null)}
        >
          <div
            className="w-full sm:max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="font-bold text-lg text-[var(--text)]">{open.claim}</h2>
              <button onClick={() => setOpenIdx(null)} className="shrink-0 text-[var(--text-muted)] text-xl leading-none">×</button>
            </div>
            <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-line">{open.explanation}</p>
            <button
              onClick={() => setOpenIdx(null)}
              className="w-full rounded-xl py-2.5 font-bold text-white text-sm mt-5"
              style={{ background: sideColor }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
