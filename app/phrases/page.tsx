'use client';
import PageTip from '@/components/PageTip';
import { useTranslation } from '@/lib/useTranslation';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { useAppStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { PHRASE_LEVELS, phraseCollectionName, type PhraseLevel } from '@/lib/phrases';

const LEVEL_STYLE: Record<PhraseLevel, { emoji: string; gradient: string; edge: string; glow: string }> = {
  A1: { emoji: '🌱', gradient: 'linear-gradient(135deg, #1a9a50, #2ECC71)', edge: '#0f6634', glow: 'rgba(46,204,113,0.4)' },
  A2: { emoji: '📗', gradient: 'linear-gradient(135deg, #15803d, #27AE60)', edge: '#14532d', glow: 'rgba(39,174,96,0.4)' },
  B1: { emoji: '📘', gradient: 'linear-gradient(135deg, #1d4ed8, #3498DB)', edge: '#1e3a8a', glow: 'rgba(52,152,219,0.4)' },
  B2: { emoji: '💬', gradient: 'linear-gradient(135deg, #7c3aed, #a78bfa)', edge: '#5b21b6', glow: 'rgba(139,92,246,0.4)' },
  C1: { emoji: '🎓', gradient: 'linear-gradient(135deg, #c2410c, #f97316)', edge: '#7c2d12', glow: 'rgba(249,115,22,0.4)' },
  C2: { emoji: '👑', gradient: 'linear-gradient(135deg, #b91c1c, #ef4444)', edge: '#7f1d1d', glow: 'rgba(239,68,68,0.4)' },
};

// Level picker for the Phrases collection — one card per CEFR level.
// Levels without a "Phrases <level>" collection yet show as coming soon.
export default function PhrasesPage() {
  const t = useTranslation();
  const { collections } = useAppStore(useShallow(s => ({ collections: s.collections })));

  return (
    <div className="px-6 py-8 pb-28">
      <BackButton href="/collections" />
      <h1 className="text-3xl font-black text-[var(--text)] mb-8">💬 {t.collectionsPage.phrasesTitle} <PageTip id="phrases" inline /></h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {PHRASE_LEVELS.map(level => {
          const style = LEVEL_STYLE[level];
          const col = collections.find(c => c.name === phraseCollectionName(level));
          const wordCount = col?.days.reduce((a, d) => a + d.words.length, 0) ?? 0;
          const card = (
            <div
              className={`relative rounded-3xl p-5 flex flex-col justify-between min-h-[150px] transition-all duration-200 ${col ? 'group-hover:-translate-y-1' : 'opacity-50'}`}
              style={{
                background: style.gradient,
                boxShadow: `0 10px 0 ${style.edge}, 0 18px 40px ${style.glow}`,
                textShadow: '0 1px 3px rgba(0,0,0,0.35)',
              }}
            >
              <div className="flex items-start justify-between">
                <span className="text-4xl" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }}>{style.emoji}</span>
                <span className="text-xs font-black px-2 py-1 rounded-full text-white" style={{ background: 'rgba(0,0,0,0.25)' }}>
                  {col ? level : `🔒 ${level}`}
                </span>
              </div>
              <div>
                <div className="text-xl font-black text-white leading-tight">{level}</div>
                <div className="text-xs text-white/85 mt-1">{t.collectionsPage.phrasesLevels[level]}</div>
                <div className="text-[11px] font-bold text-white/75 mt-2">
                  {col ? t.collectionsPage.unitsWordsCount(col.days.length, wordCount) : t.collectionsPage.phrasesComingSoon}
                </div>
              </div>
            </div>
          );
          return col
            ? <Link key={level} href={`/collections/${encodeURIComponent(col.name)}`} className="block group">{card}</Link>
            : <div key={level} aria-disabled="true">{card}</div>;
        })}
      </div>
    </div>
  );
}
