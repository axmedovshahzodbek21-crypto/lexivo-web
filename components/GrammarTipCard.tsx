'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { GrammarTip } from '@/lib/grammar-tips';

export default function GrammarTipCard({ tip }: { tip: GrammarTip }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="mt-3 rounded-xl border border-[var(--border)] overflow-hidden"
      style={{ background: `${tip.categoryColor}08` }}
    >
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/5 transition-colors"
      >
        <span className="text-base flex-shrink-0">{tip.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${tip.categoryColor}20`, color: tip.categoryColor }}
            >
              {tip.category}
            </span>
            <span className="text-xs font-semibold text-[var(--text)] truncate">{tip.title}</span>
          </div>
          {!open && (
            <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">
              {tip.explanation}
            </p>
          )}
        </div>
        <span className="text-xs text-[var(--text-muted)] flex-shrink-0 ml-1">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-3 pb-3 space-y-2 animate-fade-in border-t border-[var(--border)]">
          <p className="text-sm text-[var(--text)] pt-2 leading-relaxed">{tip.explanation}</p>

          {/* Examples */}
          <div className="space-y-1.5">
            {tip.examples.map((ex, i) => (
              <div
                key={i}
                className="rounded-lg px-3 py-2"
                style={{ background: `${tip.categoryColor}10` }}
              >
                <p className="text-sm font-mono text-[var(--text)]">{ex.en}</p>
                {ex.note && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 italic">— {ex.note}</p>
                )}
              </div>
            ))}
          </div>

          {/* Remember */}
          <div
            className="rounded-lg px-3 py-2 flex gap-2"
            style={{ background: `${tip.categoryColor}15` }}
          >
            <span className="text-base flex-shrink-0">💡</span>
            <p className="text-xs text-[var(--text)] font-medium leading-relaxed">{tip.remember}</p>
          </div>

          <Link
            href={`/grammar-tips#${tip.id}`}
            className="text-xs font-medium hover:underline block text-right"
            style={{ color: tip.categoryColor }}
          >
            See all tips →
          </Link>
        </div>
      )}
    </div>
  );
}
