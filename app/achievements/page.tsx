'use client';
import { useEffect, useState } from 'react';
import { ALL_ACHIEVEMENTS } from '@/lib/gamification';
import { getUnlockedAchievements, getLearnedWords, getStreak, getXP, getSRSWords } from '@/lib/storage';
import { useTranslation } from '@/lib/useTranslation';

interface Stats {
  learnedCount: number;
  streak: number;
  xp: number;
  masteredCount: number;
}

function getProgress(id: string, stats: Stats): { current: number; target: number } | null {
  switch (id) {
    case 'first_word':   return { current: Math.min(stats.learnedCount, 1), target: 1 };
    case 'words_10':     return { current: Math.min(stats.learnedCount, 10),  target: 10 };
    case 'words_50':     return { current: Math.min(stats.learnedCount, 50),  target: 50 };
    case 'words_100':    return { current: Math.min(stats.learnedCount, 100), target: 100 };
    case 'words_250':    return { current: Math.min(stats.learnedCount, 250), target: 250 };
    case 'words_500':    return { current: Math.min(stats.learnedCount, 500), target: 500 };
    case 'streak_3':     return { current: Math.min(stats.streak, 3),  target: 3 };
    case 'streak_7':     return { current: Math.min(stats.streak, 7),  target: 7 };
    case 'streak_30':    return { current: Math.min(stats.streak, 30), target: 30 };
    case 'xp_100':       return { current: Math.min(stats.xp, 100),  target: 100 };
    case 'xp_500':       return { current: Math.min(stats.xp, 500),  target: 500 };
    case 'xp_1000':      return { current: Math.min(stats.xp, 1000), target: 1000 };
    case 'srs_mastered_10': return { current: Math.min(stats.masteredCount, 10), target: 10 };
    default: return null;
  }
}

function getProgressLabel(id: string, current: number, target: number): string {
  if (id.startsWith('words_') || id === 'first_word') return `${current} / ${target} words`;
  if (id.startsWith('streak_')) return `${current} / ${target} days`;
  if (id.startsWith('xp_')) return `${current} / ${target} XP`;
  if (id === 'srs_mastered_10') return `${current} / ${target} mastered`;
  return `${current} / ${target}`;
}

export default function AchievementsPage() {
  const t = useTranslation();
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats>({ learnedCount: 0, streak: 0, xp: 0, masteredCount: 0 });

  useEffect(() => {
    setUnlockedIds(getUnlockedAchievements());
    setStats({
      learnedCount: getLearnedWords().length,
      streak: getStreak(),
      xp: getXP(),
      masteredCount: getSRSWords().filter(w => w.reviewStage >= 4).length,
    });
  }, []);

  const unlocked = ALL_ACHIEVEMENTS.filter(a => unlockedIds.includes(a.id));
  const locked   = ALL_ACHIEVEMENTS.filter(a => !unlockedIds.includes(a.id));

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">{t.achievements.title}</h1>
      <p className="text-sm text-[var(--text-muted)]">{t.achievements.unlockedOf(unlocked.length, ALL_ACHIEVEMENTS.length)}</p>

      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${(unlocked.length / ALL_ACHIEVEMENTS.length) * 100}%` }} />
      </div>

      {unlocked.length > 0 && (
        <div>
          <h2 className="font-semibold text-sm text-[var(--success)] mb-2">{t.achievements.unlocked}</h2>
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
          <h2 className="font-semibold text-sm text-[var(--text-muted)] mb-2">{t.achievements.locked}</h2>
          <div className="space-y-2">
            {locked.map(a => {
              const prog = getProgress(a.id, stats);
              const pct  = prog ? (prog.current / prog.target) * 100 : 0;
              return (
                <div key={a.id} className="card flex items-center gap-4">
                  <div className="text-4xl grayscale opacity-50">{a.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[var(--text-muted)]">{a.title}</p>
                    <p className="text-sm text-[var(--text-muted)]">{a.description}</p>
                    {prog && (
                      <div className="mt-1.5 space-y-0.5">
                        <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--primary)] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">
                          {getProgressLabel(a.id, prog.current, prog.target)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
