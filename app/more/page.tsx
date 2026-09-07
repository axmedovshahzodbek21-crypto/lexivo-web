'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/useTranslation';

// ── "More" hub ────────────────────────────────────────────────────────────────
// Prototype: everything that is NOT one of the 3 priority areas
// (core vocab study / word organization / classes) lives here, one tap from
// home = 2 taps from anywhere. Reachable, but off the main surface — so
// "did you know Lexivo has X?" videos still have somewhere to point.
// NOTE: copy is English-only for now; wire into lib/i18n.ts before shipping.

type MoreItem = { label: string; sub: string; href: string; icon: string; gradient: string; edge: string; glow: string };
type MoreGroup = { key: string; title: string; items: MoreItem[] };

const GROUPS: MoreGroup[] = [
  {
    key: 'word-lists', title: 'Word lists',
    items: [
      { label: 'Starred',     sub: 'Words you starred',            href: '/starred',    icon: '⭐', gradient: 'linear-gradient(135deg, #b45309, #fcd34d)', edge: '#78350f', glow: 'rgba(180,83,9,0.4)' },
      { label: 'Hard Words',  sub: 'Words you found tricky',        href: '/hard-words', icon: '😓', gradient: 'linear-gradient(135deg, #dc2626, #f87171)', edge: '#991b1b', glow: 'rgba(220,38,38,0.4)' },
      { label: 'My Lists',    sub: 'Your custom word lists',        href: '/lists',      icon: '📋', gradient: 'linear-gradient(135deg, #7c3aed, #a78bfa)', edge: '#4c1d95', glow: 'rgba(124,58,237,0.4)' },
      { label: 'Library',     sub: 'Folders & units',              href: '/library',    icon: '📚', gradient: 'linear-gradient(135deg, #4d7c0f, #a3e635)', edge: '#365314', glow: 'rgba(77,124,15,0.4)' },
    ],
  },
  {
    key: 'reading', title: 'Reading & content',
    items: [
      { label: 'Ideas',         sub: 'Curated passages · free reading', href: '/reading',   icon: '💡', gradient: 'linear-gradient(135deg, #047857, #34d399)', edge: '#064e3b', glow: 'rgba(4,120,87,0.4)' },
      { label: 'IELTS Reading',  sub: 'Practice passages & tests',  href: '/ielts-reading', icon: '📝', gradient: 'linear-gradient(135deg, #4f46e5, #a5b4fc)', edge: '#3730a3', glow: 'rgba(79,70,229,0.4)' },
      { label: 'Real English',   sub: 'Learn from real videos',     href: '/real-english',  icon: '🗣️', gradient: 'linear-gradient(135deg, #0e7490, #06b6d4)', edge: '#164e63', glow: 'rgba(14,116,144,0.4)' },
      { label: 'Grammar Tips',   sub: 'Bite-size grammar',          href: '/grammar-tips',  icon: '📚', gradient: 'linear-gradient(135deg, #1a9a50, #2ECC71)', edge: '#0f6634', glow: 'rgba(46,204,113,0.4)' },
      { label: 'Structures',     sub: 'Sentence patterns',          href: '/structures',    icon: '🧩', gradient: 'linear-gradient(135deg, #7c2d92, #c026d3)', edge: '#581c62', glow: 'rgba(192,38,211,0.4)' },
    ],
  },
  {
    key: 'speaking', title: 'Speaking & debate',
    items: [
      { label: 'Speaking',      sub: 'IELTS speaking practice',     href: '/speaking',      icon: '🎤', gradient: 'linear-gradient(135deg, #be185d, #fb7185)', edge: '#831843', glow: 'rgba(190,24,93,0.4)' },
      { label: 'Battle-Ready',  sub: 'Debate practice',             href: '/battle-ready',  icon: '🛡️', gradient: 'linear-gradient(135deg, #b91c1c, #f87171)', edge: '#7f1d1d', glow: 'rgba(185,28,28,0.4)' },
      { label: 'Debate',        sub: 'Argue a topic',              href: '/debate',        icon: '⚔️', gradient: 'linear-gradient(135deg, #9a3412, #fb923c)', edge: '#7c2d12', glow: 'rgba(154,52,18,0.4)' },
    ],
  },
  {
    key: 'focus', title: 'Focus tools',
    items: [
      { label: 'Pomodoro',      sub: 'Timed study sessions',        href: '/pomodoro',      icon: '🍅', gradient: 'linear-gradient(135deg, #7f1d1d, #b91c1c)', edge: '#450a0a', glow: 'rgba(127,29,29,0.4)' },
      { label: 'Free Time',     sub: 'Light activities when caught up', href: '/free-time', icon: '🎈', gradient: 'linear-gradient(135deg, #0284c7, #38bdf8)', edge: '#0369a1', glow: 'rgba(2,132,199,0.4)' },
    ],
  },
  {
    key: 'progress', title: 'Progress & extras',
    items: [
      { label: 'Achievements',  sub: 'Badges & milestones',         href: '/achievements',  icon: '🏅', gradient: 'linear-gradient(135deg, #d97706, #fbbf24)', edge: '#92400e', glow: 'rgba(217,119,6,0.4)' },
    ],
  },
];

const HOME_MODES: { key: 'full' | 'class'; label: string }[] = [
  { key: 'full',  label: 'Learner' },
  { key: 'class', label: 'Classes' },
];

export default function MorePage() {
  const t = useTranslation();
  const [homeMode, setHomeMode] = useState<'full' | 'class'>('full');

  useEffect(() => {
    try {
      if (localStorage.getItem('lexivo_home_mode') === 'class') setHomeMode('class');
    } catch { /* storage disabled */ }
  }, []);

  const pickMode = (m: 'full' | 'class') => {
    setHomeMode(m);
    try {
      if (m === 'class') localStorage.setItem('lexivo_home_mode', 'class');
      else localStorage.removeItem('lexivo_home_mode');
    } catch { /* storage disabled */ }
  };

  return (
    <div className="p-4 space-y-8 animate-fade-in">
      <div>
        <Link href="/" className="text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          {t.hub.backHome}
        </Link>
        <h1 className="text-2xl font-bold text-[var(--text)] mt-2">{t.nav.more}</h1>
        <p className="text-sm text-[var(--text-muted)]">Everything beyond your daily vocabulary practice.</p>
      </div>

      {GROUPS.map(group => (
        <div key={group.key}>
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1">{group.title}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {group.items.map(item => (
              <Link key={item.href} href={item.href} className="block">
                <div
                  className="rounded-2xl h-full min-h-[110px] p-4 flex flex-col justify-center items-center text-center gap-2 hover:-translate-y-1 transition-all duration-200"
                  style={{ background: item.gradient, boxShadow: `0 10px 0 ${item.edge}, 0 18px 40px ${item.glow}`, textShadow: '0 1px 3px rgba(0,0,0,0.35)' }}
                >
                  <div className="text-3xl">{item.icon}</div>
                  <div className="font-bold text-sm text-white leading-tight">{item.label}</div>
                  <div className="text-[10px] text-white/70">{item.sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* ── Home layout ── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-lg">🏠</span>
          <span className="text-sm font-bold text-[var(--text)]">Home layout</span>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
          {HOME_MODES.map(m => {
            const active = homeMode === m.key;
            return (
              <button key={m.key} onClick={() => pickMode(m.key)}
                className="flex-1 text-xs font-bold rounded-lg py-2 transition-colors"
                style={active ? { background: 'var(--primary)', color: '#fff' } : { color: 'var(--text-muted)' }}>
                {m.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-2">
          {homeMode === 'class'
            ? 'Home shows your classes and homework first.'
            : 'Home shows the full learner layout with study, stats and word of the day.'}
        </p>
      </div>
    </div>
  );
}
