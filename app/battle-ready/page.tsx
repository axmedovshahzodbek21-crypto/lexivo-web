'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { DEBATE_TOPICS } from '@/lib/debateMock';
import { getBRSideContent } from '@/lib/battleReadyContent';

export default function BattleReadyHubPage() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => DEBATE_TOPICS.filter(t => t.title.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  const filledCount = useMemo(
    () => DEBATE_TOPICS.filter(t => getBRSideContent(t.slug, 'for') || getBRSideContent(t.slug, 'against')).length,
    []
  );

  return (
    <div className="p-4 space-y-6 animate-fade-in max-w-3xl mx-auto">
      <BackButton href="/" />

      <div className="flex items-center gap-3">
        <span className="text-3xl">🛡️</span>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Battle-Ready</h1>
          <p className="text-sm text-[var(--text-muted)]">{filledCount}/{DEBATE_TOPICS.length} topics filled in</p>
        </div>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search topics..."
        className="w-full rounded-xl px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[#818cf8]"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filtered.map(t => {
          const hasContent = !!getBRSideContent(t.slug, 'for') || !!getBRSideContent(t.slug, 'against');
          return (
            <Link
              key={t.slug}
              href={`/battle-ready/${t.slug}`}
              className="relative rounded-2xl p-3 border border-[var(--border)] bg-[var(--surface)] hover:-translate-y-0.5 transition-transform flex flex-col items-center text-center gap-1.5"
            >
              {hasContent && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500" title="Has content" />}
              <span className="text-2xl">{t.emoji}</span>
              <div className="font-semibold text-xs text-[var(--text)] leading-tight">{t.title}</div>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-full text-sm text-[var(--text-muted)] text-center py-8">No topics match your search.</p>
        )}
      </div>
    </div>
  );
}
