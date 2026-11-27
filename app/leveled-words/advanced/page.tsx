'use client';
import { useTranslation } from '@/lib/useTranslation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { ADVANCED_LEVELS, advancedCollectionName } from '@/lib/advanced-levels';

const STYLE = {
  'B2+': { labelKey: 'levelB2', descKey: 'levelB2Desc', emoji: '📖', gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)', edge: '#4c1d95', glow: 'rgba(124,58,237,0.4)' },
  C1:    { labelKey: 'levelC1', descKey: 'levelC1Desc', emoji: '🎯', gradient: 'linear-gradient(135deg, #6d28d9, #8E44AD)', edge: '#3b0764', glow: 'rgba(109,40,217,0.4)' },
  C2:    { labelKey: 'levelC2', descKey: 'levelC2Desc', emoji: '🏆', gradient: 'linear-gradient(135deg, #4c1d95, #6C3483)', edge: '#2e1065', glow: 'rgba(76,29,149,0.45)' },
} as const;

export default function AdvancedPage() {
  const t = useTranslation();
  const router = useRouter();
  const { collections } = useAppStore();

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label={t.foundationPage.goBack}>
          ←
        </button>
        <h1 className="font-bold text-[var(--text)]">{t.advancedPage.title}</h1>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {ADVANCED_LEVELS.map(level => {
          const s = STYLE[level];
          const name = advancedCollectionName(level);
          const days = collections.find(c => c.name === name)?.days.filter(d => d.words.length > 0) ?? [];
          const wordCount = days.reduce((a, d) => a + d.words.length, 0);
          const ready = days.length > 0;
          const body = (
            <>
              <div className="flex items-start justify-between">
                <span className="text-4xl" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }}>{s.emoji}</span>
                <span className="text-xs font-black px-2 py-1 rounded-full text-white" style={{ background: 'rgba(0,0,0,0.25)' }}>
                  {level}
                </span>
              </div>
              <div>
                <div className="text-xl font-black text-white leading-tight">{t.advancedPage[s.labelKey]}</div>
                <div className="text-xs text-white/80 mt-1">{t.advancedPage[s.descKey]}</div>
                <div className="text-[11px] font-bold text-white/70 mt-2">
                  {ready ? t.foundationPage.unitsAndWords(days.length, wordCount) : t.advancedPage.comingSoon}
                </div>
              </div>
            </>
          );
          const className = 'group relative rounded-3xl p-5 flex flex-col justify-between min-h-[168px] transition-all duration-200';
          const style = { background: s.gradient, boxShadow: `0 10px 0 ${s.edge}, 0 18px 40px ${s.glow}`, textShadow: '0 1px 3px rgba(0,0,0,0.35)' };

          return ready ? (
            <Link key={level} href={`/collections/${encodeURIComponent(name)}`} className={`${className} hover:-translate-y-1`} style={style}>
              {body}
              <span className="absolute bottom-5 right-5 text-lg font-black text-white opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </Link>
          ) : (
            <div key={level} className={`${className} opacity-60 cursor-default`} style={style}>{body}</div>
          );
        })}
      </div>
    </div>
  );
}
