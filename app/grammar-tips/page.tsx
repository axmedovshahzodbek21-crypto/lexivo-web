'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GRAMMAR_TIPS, TIP_CATEGORIES, type GrammarTip } from '@/lib/grammar-tips';

const ALL = 'All';

export default function GrammarTipsPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const categories = [ALL, ...TIP_CATEGORIES];

  const visible = GRAMMAR_TIPS.filter(t => {
    const matchCat = activeCategory === ALL || t.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.explanation.toLowerCase().includes(q) ||
      t.remember.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const toggle = (id: string) => setOpenId(prev => (prev === id ? null : id));

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-3 hover:text-[var(--text)] transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-[var(--text)]">📚 Grammar Tips</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          {GRAMMAR_TIPS.length} tips across {TIP_CATEGORIES.length} categories
        </p>

        {/* Search */}
        <div className="mt-3">
          <input
            type="text"
            placeholder="Search tips…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
          />
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--primary-bg)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tips list */}
      <div className="flex-1 p-4 space-y-3">
        {visible.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-muted)]">
            <div className="text-5xl mb-3">🔍</div>
            <p>No tips match your search.</p>
          </div>
        ) : (
          visible.map(tip => (
            <TipCard
              key={tip.id}
              tip={tip}
              open={openId === tip.id}
              onToggle={() => toggle(tip.id)}
            />
          ))
        )}
        <div className="pb-4" />
      </div>
    </div>
  );
}

function TipCard({
  tip, open, onToggle,
}: {
  tip: GrammarTip;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      id={tip.id}
      className="rounded-2xl border border-[var(--border)] overflow-hidden scroll-mt-4"
      style={{ background: `${tip.categoryColor}08` }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-black/5 transition-colors"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${tip.categoryColor}20` }}
        >
          {tip.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: `${tip.categoryColor}25`, color: tip.categoryColor }}
            >
              {tip.category}
            </span>
            <h3 className="font-bold text-[var(--text)] text-sm">{tip.title}</h3>
          </div>
          {!open && (
            <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2 leading-relaxed">
              {tip.explanation}
            </p>
          )}
        </div>
        <span className="text-sm text-[var(--text-muted)] flex-shrink-0 ml-1">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-4 pb-4 space-y-3 animate-fade-in border-t border-[var(--border)]">
          <p className="text-sm text-[var(--text)] pt-3 leading-relaxed">{tip.explanation}</p>

          {/* Examples */}
          <div className="space-y-2">
            {tip.examples.map((ex, i) => (
              <div
                key={i}
                className="rounded-xl px-3 py-2.5"
                style={{ background: `${tip.categoryColor}12` }}
              >
                <p className="text-sm font-mono text-[var(--text)]">{ex.en}</p>
                {ex.note && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 italic">— {ex.note}</p>
                )}
              </div>
            ))}
          </div>

          {/* Remember box */}
          <div
            className="rounded-xl px-3 py-2.5 flex gap-2 items-start"
            style={{ background: `${tip.categoryColor}18`, borderLeft: `3px solid ${tip.categoryColor}` }}
          >
            <span className="text-lg flex-shrink-0">💡</span>
            <p className="text-sm text-[var(--text)] font-medium leading-relaxed">{tip.remember}</p>
          </div>
        </div>
      )}
    </div>
  );
}
