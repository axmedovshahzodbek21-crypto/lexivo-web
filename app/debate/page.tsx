'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { DEBATE_TOPICS, CORE_SKILLS_PROGRESS, isBattleReady } from '@/lib/debateMock';

function ProgressRing({ forP, againstP, size = 44 }: { forP: number; againstP: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const forLen = (forP / 100) * (c / 2);
  const againstLen = (againstP / 100) * (c / 2);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
      {/* FOR half (top) */}
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#22c55e" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${forLen} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {/* AGAINST half (bottom) */}
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ef4444" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${againstLen} ${c}`} transform={`rotate(90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export default function DebateArenaPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'progress' | 'az'>('progress');

  const battleReadyCount = DEBATE_TOPICS.filter(isBattleReady).length;

  const filtered = useMemo(() => {
    let list = DEBATE_TOPICS.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));
    list = [...list].sort((a, b) => {
      if (sort === 'az') return a.title.localeCompare(b.title);
      const avgA = (a.progress.for + a.progress.against) / 2;
      const avgB = (b.progress.for + b.progress.against) / 2;
      return avgB - avgA;
    });
    return list;
  }, [search, sort]);

  return (
    <div className="p-4 space-y-6 animate-fade-in max-w-3xl mx-auto">
      <BackButton href="/" />

      <div>
        <div className="flex items-center gap-3">
          <span className="text-3xl">🗣️</span>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text)]">Debate Arena</h1>
            <p className="text-sm text-[var(--text-muted)]">Master both sides. Argue anything, instantly.</p>
          </div>
        </div>
      </div>

      {/* Core Skills bar */}
      <Link
        href="/debate/core-skills"
        className="block rounded-2xl p-4 hover:-translate-y-0.5 transition-transform"
        style={{ background: 'linear-gradient(135deg, #4338ca, #818cf8)', boxShadow: '0 10px 0 #312e81, 0 18px 40px rgba(67,56,202,0.4)' }}
      >
        <div className="flex items-center justify-between text-white">
          <div>
            <div className="font-bold text-sm">Core Skills</div>
            <div className="text-xs text-white/70">Openings, signposting, rebuttal phrases</div>
          </div>
          <div className="text-right">
            <div className="font-bold">{CORE_SKILLS_PROGRESS}%</div>
          </div>
        </div>
        <div className="mt-2 h-2 rounded-full bg-white/25 overflow-hidden">
          <div className="h-full bg-white rounded-full" style={{ width: `${CORE_SKILLS_PROGRESS}%` }} />
        </div>
      </Link>

      {/* Battle Drills + My Progress row */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/debate/drills"
          className="rounded-2xl p-4 text-white hover:-translate-y-0.5 transition-transform"
          style={{ background: 'linear-gradient(135deg, #b91c1c, #f87171)', boxShadow: '0 10px 0 #7f1d1d, 0 18px 40px rgba(185,28,28,0.4)' }}
        >
          <div className="text-2xl mb-1">⚔️</div>
          <div className="font-bold text-sm">Battle Drills</div>
          <div className="text-xs text-white/70">{battleReadyCount} topics unlocked</div>
        </Link>
        <Link
          href="/debate/progress"
          className="rounded-2xl p-4 text-white hover:-translate-y-0.5 transition-transform"
          style={{ background: 'linear-gradient(135deg, #d97706, #fbbf24)', boxShadow: '0 10px 0 #92400e, 0 18px 40px rgba(217,119,6,0.4)' }}
        >
          <div className="text-2xl mb-1">📊</div>
          <div className="font-bold text-sm">My Progress</div>
          <div className="text-xs text-white/70">{battleReadyCount}/{DEBATE_TOPICS.length} battle-ready</div>
        </Link>
      </div>

      {/* Search / filter / sort */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search topics..."
          className="flex-1 rounded-xl px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[#818cf8]"
        />
        <select
          value={sort}
          onChange={e => setSort(e.target.value as 'progress' | 'az')}
          className="rounded-xl px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
        >
          <option value="progress">Sort: Progress</option>
          <option value="az">Sort: A-Z</option>
        </select>
      </div>

      {/* Topics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filtered.map(t => {
          const ready = isBattleReady(t);
          return (
            <Link
              key={t.slug}
              href={`/debate/${t.slug}`}
              className="relative rounded-2xl p-3 border border-[var(--border)] bg-[var(--surface)] hover:-translate-y-0.5 transition-transform flex flex-col items-center text-center gap-1.5"
            >
              {ready && <span className="absolute top-2 right-2 text-base" title="Battle-Ready">🏅</span>}
              <span className="text-2xl">{t.emoji}</span>
              <ProgressRing forP={t.progress.for} againstP={t.progress.against} />
              <div className="font-semibold text-xs text-[var(--text)] leading-tight">{t.title}</div>
              <div className="text-[10px] text-[var(--text-muted)] flex gap-2">
                <span className="text-green-500">FOR {t.progress.for}%</span>
                <span className="text-red-500">AGN {t.progress.against}%</span>
              </div>
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
