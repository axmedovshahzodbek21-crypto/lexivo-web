'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { getHubCategory } from '@/lib/hubCategories';
import { getDueWords, getXP } from '@/lib/storage';
import XpHistoryModal from '@/components/XpHistoryModal';

export default function HubCategoryPage() {
  const params = useParams();
  const t = useTranslation();
  const [dueCount, setDueCount] = useState(0);
  const [xp, setXp] = useState(0);
  const [showXpHistoryModal, setShowXpHistoryModal] = useState(false);

  useEffect(() => {
    setDueCount(getDueWords().length);
    setXp(getXP());
  }, []);

  const categoryKey = String(params.category);
  const category = getHubCategory(categoryKey);
  if (!category) notFound();

  const catLabel = t.hub.categories[category.key as keyof typeof t.hub.categories];

  return (
    <div className="p-4 space-y-6 animate-fade-in">
      <div>
        <Link href="/" className="text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          {t.hub.backHome}
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-3xl">{category.icon}</span>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text)]">{catLabel.title}</h1>
            <p className="text-sm text-[var(--text-muted)]">{catLabel.sub}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {category.items.map(item => {
          const label = t.hub.items[item.key as keyof typeof t.hub.items];
          const isSrsCaughtUp = item.key === 'srs' && dueCount === 0;
          const gradient = isSrsCaughtUp ? 'linear-gradient(135deg, #1a9a50, #2ECC71)' : item.gradient;
          const edge = isSrsCaughtUp ? '#0f6634' : item.edge;
          const glow = isSrsCaughtUp ? 'rgba(46,204,113,0.4)' : item.glow;
          const tile = (
            <div
              className="rounded-2xl h-full min-h-[110px] p-4 flex flex-col justify-center items-center text-center gap-2 hover:-translate-y-1 transition-all duration-200"
              style={{ background: gradient, boxShadow: `0 10px 0 ${edge}, 0 18px 40px ${glow}`, textShadow: '0 1px 3px rgba(0,0,0,0.35)' }}
            >
              <div className="text-3xl">{item.icon}</div>
              <div className="font-bold text-sm text-white leading-tight">{label.title}</div>
              <div className="text-[10px] text-white/70">
                {item.key === 'srs' ? (dueCount > 0 ? `${dueCount} due` : label.sub) : label.sub}
              </div>
            </div>
          );

          if (item.key === 'xp_history') {
            return (
              <button key={item.key} onClick={() => setShowXpHistoryModal(true)} className="block w-full">
                {tile}
              </button>
            );
          }

          const href = item.key === 'srs' ? (dueCount > 0 ? '/srs' : '/free-time') : item.href;
          return (
            <Link key={item.key} href={href} className="block">
              {tile}
            </Link>
          );
        })}
      </div>

      {showXpHistoryModal && <XpHistoryModal xp={xp} onClose={() => setShowXpHistoryModal(false)} />}
    </div>
  );
}
