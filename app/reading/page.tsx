'use client';
import { useState } from 'react';
import Link from 'next/link';
import { readingPassages, type ReadingPassage } from '@/lib/reading-data';

const CARD_COLORS = [
  ['#6C63FF', '#8B5CF6'],
  ['#0E7490', '#22D3EE'],
  ['#1A9A50', '#2ECC71'],
  ['#B45309', '#FBBF24'],
  ['#BE123C', '#FB7185'],
  ['#EC4899', '#F472B6'],
  ['#0284C7', '#38BDF8'],
  ['#D97706', '#FCD34D'],
];

export default function ReadingPage() {
  const [selected, setSelected] = useState<ReadingPassage | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  if (selected) {
    const paragraphs = selected.content.split('\n').map(p => p.trim()).filter(Boolean);
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        <button
          onClick={() => { setSelected(null); setRevealed(new Set()); }}
          className="flex items-center gap-1.5 text-sm mb-6"
          style={{ color: 'var(--text-muted)' }}
        >
          ← Back to Library
        </button>

        {/* Topic chip */}
        <span
          className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-4"
          style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}
        >
          {selected.topic}
        </span>

        <h1 className="text-2xl font-black mb-6" style={{ color: 'var(--text)' }}>
          {selected.title}
        </h1>

        {/* Passage */}
        <div className="space-y-5 mb-10">
          {paragraphs.map((para, i) => (
            <p key={i} className="text-base leading-[1.85]" style={{ color: 'var(--text)', textAlign: 'justify' }}>
              {para}
            </p>
          ))}
        </div>

        {/* Questions */}
        {selected.questions.length > 0 && (
          <>
            <div className="border-t mb-8" style={{ borderColor: 'var(--border)' }} />
            <h2 className="text-lg font-black mb-1" style={{ color: 'var(--text)' }}>
              Comprehension Questions
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Think about your answer, then reveal the explanation.
            </p>
            <div className="space-y-3">
              {selected.questions.map((q, i) => {
                const isRevealed = revealed.has(i);
                return (
                  <div
                    key={i}
                    className="rounded-2xl overflow-hidden border"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                  >
                    <div className="flex gap-3 p-4">
                      <span
                        className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black"
                        style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}
                      >
                        {i + 1}
                      </span>
                      <p className="text-sm font-semibold leading-relaxed" style={{ color: 'var(--text)' }}>
                        {q.question}
                      </p>
                    </div>

                    {isRevealed && (
                      <div
                        className="flex gap-2 px-4 pb-4"
                        style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}
                      >
                        <span className="text-sm shrink-0">💡</span>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                          {q.explanation}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        const next = new Set(revealed);
                        if (isRevealed) next.delete(i); else next.add(i);
                        setRevealed(next);
                      }}
                      className="w-full py-3 text-sm font-bold transition-colors"
                      style={{
                        borderTop: '1px solid var(--border)',
                        color: 'var(--primary)',
                        background: isRevealed ? 'var(--surface)' : 'var(--primary-bg)',
                      }}
                    >
                      {isRevealed ? 'Hide explanation' : 'Show explanation'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>📖 Reading</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {readingPassages.length} {readingPassages.length === 1 ? 'passage' : 'passages'}
          </p>
        </div>
        <Link
          href="/reading/free"
          className="text-xs font-bold px-3 py-2 rounded-xl border transition-colors"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
        >
          Free Read →
        </Link>
      </div>

      {/* Grid */}
      <div className="flex flex-col gap-3">
        {readingPassages.map((passage, i) => {
          const [c1, c2] = CARD_COLORS[i % CARD_COLORS.length];
          return (
            <button
              key={passage.id}
              onClick={() => { setSelected(passage); setRevealed(new Set()); }}
              className="w-full text-left rounded-2xl px-5 py-4 flex items-center gap-4 transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
              style={{
                background: `linear-gradient(135deg, ${c1}, ${c2})`,
                boxShadow: `0 6px 0 ${c1}99, 0 10px 24px ${c1}55`,
              }}
            >
              <span
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                {passage.id}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-white text-base leading-tight">{passage.title}</p>
                <p className="text-xs mt-0.5 font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {passage.topic}
                </p>
              </div>
              {passage.questions.length > 0 && (
                <span
                  className="shrink-0 text-xs font-bold px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
                >
                  {passage.questions.length} Q
                </span>
              )}
              <span className="text-white/50 text-sm">›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
