'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { STRUCTURES, STRUCTURE_UNITS, slugForUnit } from '@/lib/structures-data';
import { getStructuresSRS, getDueStructures } from '@/lib/storage';
import type { StructureItem } from '@/lib/types';

const UNIT_ICONS: Record<string, string> = {
  'Speaking Part 1': '🗣️',
  'Speaking Part 2': '🎤',
  'Speaking Part 3': '💬',
  'Writing Task 2': '✍️',
};

const ALL = 'All';

export default function StructuresPage() {
  const [activeTag, setActiveTag] = useState(ALL);
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Read fresh on every render (cheap — 156 items, plain localStorage reads)
  // so returning from Learn/Flashcards/Review always shows current state.
  const learnedIds = useMemo(() => new Set(getStructuresSRS().map(s => s.id)), []);
  const dueCount = useMemo(() => getDueStructures().length, []);
  const unitCounts = useMemo(() => {
    const map: Record<string, { total: number; learned: number }> = {};
    for (const unit of STRUCTURE_UNITS) {
      const inUnit = STRUCTURES.filter(s => s.unit === unit);
      map[unit] = { total: inUnit.length, learned: inUnit.filter(s => learnedIds.has(s.id)).length };
    }
    return map;
  }, [learnedIds]);

  const tags = useMemo(() => [ALL, ...new Set(STRUCTURES.flatMap(s => s.ieltsUse))], []);

  const visible = STRUCTURES.filter(s => {
    const matchTag = activeTag === ALL || s.ieltsUse.includes(activeTag);
    const q = search.toLowerCase();
    const matchSearch = !q || s.pattern.toLowerCase().includes(q) || s.definition.toLowerCase().includes(q) || s.uzTranslation.toLowerCase().includes(q) || s.uzDefinition.toLowerCase().includes(q) || s.scenario.toLowerCase().includes(q);
    return matchTag && matchSearch;
  });

  const toggle = (id: string) => setOpenId(prev => (prev === id ? null : id));

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      <div className="p-4 border-b border-[var(--border)]">
        <BackButton />
        <h1 className="text-xl font-bold text-[var(--text)]">🧩 IELTS Structures</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          {learnedIds.size} / {STRUCTURES.length} learned
        </p>

        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mt-4 mb-1.5">Learn by unit</p>
        <div className="grid grid-cols-2 gap-2">
          {STRUCTURE_UNITS.map(unit => {
            const c = unitCounts[unit];
            return (
              <Link
                key={unit}
                href={`/structures/${slugForUnit(unit)}`}
                className="card flex flex-col items-center justify-center gap-1 py-4 text-center hover:bg-[var(--surface-2)] transition-colors"
              >
                <span className="text-2xl">{UNIT_ICONS[unit]}</span>
                <span className="text-xs font-semibold text-[var(--text)]">{unit}</span>
                <span className="text-[10px] text-[var(--text-muted)]">{c.learned}/{c.total} learned</span>
              </Link>
            );
          })}
        </div>

        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mt-4 mb-1.5">Practice everything</p>
        <div className="grid grid-cols-3 gap-2">
          <Link href="/structures/flashcards" className="card flex flex-col items-center justify-center gap-1 py-4 text-center hover:bg-[var(--surface-2)] transition-colors">
            <span className="text-2xl">🃏</span>
            <span className="text-xs font-semibold text-[var(--text)]">Flashcards</span>
          </Link>
          <Link href="/structures/detective" className="card flex flex-col items-center justify-center gap-1 py-4 text-center hover:bg-[var(--surface-2)] transition-colors">
            <span className="text-2xl">🕵️</span>
            <span className="text-xs font-semibold text-[var(--text)]">Detective</span>
          </Link>
          <Link href="/structures/review" className="card flex flex-col items-center justify-center gap-1 py-4 text-center hover:bg-[var(--surface-2)] transition-colors relative">
            <span className="text-2xl">🔄</span>
            <span className="text-xs font-semibold text-[var(--text)]">Review</span>
            {dueCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                style={{ background: 'var(--danger)' }}
              >
                {dueCount}
              </span>
            )}
          </Link>
        </div>

        <div className="mt-4">
          <input
            type="text"
            placeholder="Search structures…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
          />
        </div>

        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTag === tag
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--primary-bg)]'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {visible.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-muted)]">
            <div className="text-5xl mb-3">🔍</div>
            <p>No structures match your search.</p>
          </div>
        ) : (
          visible.map(s => (
            <StructureCard
              key={s.id}
              item={s}
              learned={learnedIds.has(s.id)}
              open={openId === s.id}
              onToggle={() => toggle(s.id)}
            />
          ))
        )}
        <div className="pb-4" />
      </div>
    </div>
  );
}

function StructureCard({
  item, learned, open, onToggle,
}: {
  item: StructureItem;
  learned: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-black/5 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {learned && <span className="text-xs text-[var(--success)]">✓</span>}
            <h3 className="font-bold text-[var(--text)] text-sm">{item.pattern}</h3>
          </div>
          {!open && (
            <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2 leading-relaxed">
              {item.definition}
            </p>
          )}
        </div>
        <span className="text-sm text-[var(--text-muted)] flex-shrink-0 ml-1">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 animate-fade-in border-t border-[var(--border)]">
          <p className="text-sm text-[var(--text)] pt-3 leading-relaxed">{item.definition}</p>
          <div className="rounded-xl px-3 py-2.5 flex gap-2 items-start" style={{ background: 'var(--surface-2)', borderLeft: '3px solid var(--warning)' }}>
            <span className="text-lg flex-shrink-0">💭</span>
            <p className="text-sm text-[var(--text)] leading-relaxed">{item.scenario}</p>
          </div>
          <div className="bg-[var(--primary-bg)] rounded-xl px-3 py-2.5 space-y-2">
            <p className="text-sm font-semibold text-[var(--primary)]">{item.uzTranslation}</p>
            <p className="text-sm text-[var(--primary)] leading-relaxed">{item.uzDefinition}</p>
          </div>
          <div className="space-y-2">
            {item.examples.map((ex, i) => (
              <div key={i} className="rounded-xl px-3 py-2.5 bg-[var(--surface-2)] space-y-1">
                <p className="text-sm italic text-[var(--text)]">"{ex}"</p>
                <p className="text-sm italic text-[var(--text-muted)]">"{item.exampleTranslations[i]}"</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {item.ieltsUse.map(tag => (
              <span key={tag} className="badge text-xs">{tag}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
