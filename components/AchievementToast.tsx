'use client';
import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

export default function AchievementToast() {
  const { pendingAchievements, popAchievement } = useAppStore();
  const current = pendingAchievements[0];

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(popAchievement, 3500);
    return () => clearTimeout(t);
  }, [current, popAchievement]);

  if (!current) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-pop">
      <div className="flex items-center gap-3 bg-white rounded-2xl shadow-xl px-5 py-3 border border-[var(--primary-bg)]"
        style={{ boxShadow: '0 8px 32px rgba(108,99,255,0.2)' }}>
        <span className="text-3xl">{current.icon}</span>
        <div>
          <div className="text-xs font-semibold text-[var(--primary)] uppercase tracking-wider">Achievement Unlocked!</div>
          <div className="font-bold text-[var(--text)]">{current.title}</div>
          <div className="text-xs text-[var(--text-muted)]">{current.description}</div>
        </div>
      </div>
    </div>
  );
}
