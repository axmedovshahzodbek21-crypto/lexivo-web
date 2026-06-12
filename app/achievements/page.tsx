'use client';
import { useEffect, useState } from 'react';
import { ALL_ACHIEVEMENTS } from '@/lib/gamification';
import { getUnlockedAchievements } from '@/lib/storage';

export default function AchievementsPage() {
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);

  useEffect(() => {
    setUnlockedIds(getUnlockedAchievements());
  }, []);

  const unlocked = ALL_ACHIEVEMENTS.filter(a => unlockedIds.includes(a.id));
  const locked = ALL_ACHIEVEMENTS.filter(a => !unlockedIds.includes(a.id));

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">🏆 Achievements</h1>
      <p className="text-sm text-[var(--text-muted)]">{unlocked.length} / {ALL_ACHIEVEMENTS.length} unlocked</p>

      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${(unlocked.length / ALL_ACHIEVEMENTS.length) * 100}%` }} />
      </div>

      {unlocked.length > 0 && (
        <div>
          <h2 className="font-semibold text-sm text-[var(--success)] mb-2">✅ Unlocked</h2>
          <div className="space-y-2">
            {unlocked.map(a => (
              <div key={a.id} className="card flex items-center gap-4 border-[var(--success)] bg-green-50 animate-pop">
                <div className="text-4xl">{a.icon}</div>
                <div>
                  <p className="font-bold">{a.title}</p>
                  <p className="text-sm text-[var(--text-muted)]">{a.description}</p>
                </div>
                <span className="ml-auto badge" style={{ background: '#d1fae5', color: '#065f46' }}>✓</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <h2 className="font-semibold text-sm text-[var(--text-muted)] mb-2">🔒 Locked</h2>
          <div className="space-y-2">
            {locked.map(a => (
              <div key={a.id} className="card flex items-center gap-4 opacity-50">
                <div className="text-4xl grayscale">{a.icon}</div>
                <div>
                  <p className="font-bold">{a.title}</p>
                  <p className="text-sm text-[var(--text-muted)]">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
