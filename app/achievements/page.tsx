'use client';
import { useEffect, useState } from 'react';
import { ALL_ACHIEVEMENTS, CATEGORY_META, CATEGORY_ORDER, getAchievementProgress } from '@/lib/gamification';
import { getUnlockedAchievements, getLearnedWords, getStreak, getXP, getGraduatedCount, getTotalStudyDays, getFlashcardTotalDays, getFlashcardStreak, getQuizTotalDays, getQuizStreak, getAchievementDate } from '@/lib/storage';
import type { Achievement } from '@/lib/types';
import { useTranslation } from '@/lib/useTranslation';

interface Stats {
  learnedCount: number; streak: number; xp: number; masteredCount: number;
  totalDays: number; flashDays: number; flashStreak: number; quizDays: number; quizStreak: number;
}

interface AchDetail extends Omit<Achievement, 'unlockedAt'> {
  unlocked: boolean;
  unlockedAt: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AchievementsPage() {
  const t = useTranslation();
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats>({ learnedCount: 0, streak: 0, xp: 0, masteredCount: 0, totalDays: 0, flashDays: 0, flashStreak: 0, quizDays: 0, quizStreak: 0 });
  const [selected, setSelected] = useState<AchDetail | null>(null);

  useEffect(() => {
    const load = () => {
      setUnlockedIds(getUnlockedAchievements());
      setStats({
        learnedCount: getLearnedWords().length,
        streak: getStreak(),
        xp: getXP(),
        masteredCount: getGraduatedCount(),
        totalDays: getTotalStudyDays(),
        flashDays: getFlashcardTotalDays(),
        flashStreak: getFlashcardStreak(),
        quizDays: getQuizTotalDays(),
        quizStreak: getQuizStreak(),
      });
    };
    load();
    window.addEventListener('lexivo-sync', load);
    return () => window.removeEventListener('lexivo-sync', load);
  }, []);

  const total    = ALL_ACHIEVEMENTS.length;
  const unlocked = unlockedIds.length;

  const byCategory: Record<string, Achievement[]> = {};
  for (const a of ALL_ACHIEVEMENTS) {
    (byCategory[a.category] ??= []).push(a);
  }

  function openDetail(a: Achievement) {
    setSelected({
      ...a,
      unlocked: unlockedIds.includes(a.id),
      unlockedAt: getAchievementDate(a.id),
    });
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">{t.achievements.title}</h1>

      {/* Overall progress */}
      <div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--primary-bg)' }}>
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {unlocked} / {total} unlocked
          </span>
          <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
            {Math.round((unlocked / total) * 100)}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${(unlocked / total) * 100}%`, background: 'var(--primary)' }} />
        </div>
      </div>

      {/* Category sections */}
      {CATEGORY_ORDER.map(cat => {
        const achs = byCategory[cat] ?? [];
        if (achs.length === 0) return null;
        const meta = CATEGORY_META[cat];
        const catUnlocked = achs.filter(a => unlockedIds.includes(a.id)).length;
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{meta.icon}</span>
              <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>{meta.label}</span>
              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: catUnlocked > 0 ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--surface-2)', color: catUnlocked > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                {catUnlocked}/{achs.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {achs.map(a => {
                const isUnlocked = unlockedIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => openDetail(a)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{
                      background: isUnlocked ? 'var(--surface)' : 'var(--surface-2)',
                      border: isUnlocked ? '1px solid color-mix(in srgb, var(--primary) 25%, transparent)' : '1px solid var(--border)',
                      opacity: isUnlocked ? 1 : 0.6,
                    }}
                  >
                    <span className="text-xl w-7 text-center shrink-0" style={{ filter: isUnlocked ? 'none' : 'grayscale(1)' }}>{a.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: isUnlocked ? 'var(--text)' : 'var(--text-muted)' }}>{a.title}</p>
                      <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{a.description}</p>
                    </div>
                    {isUnlocked
                      ? <span className="text-xs font-bold shrink-0" style={{ color: 'var(--primary)' }}>✓</span>
                      : (() => {
                          const prog = getAchievementProgress(a.id, stats);
                          if (!prog) return null;
                          const pct = Math.round((prog.current / prog.target) * 100);
                          return <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>{pct}%</span>;
                        })()
                    }
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-sm rounded-t-3xl p-6 pb-10 animate-slide-up"
            style={{ background: 'var(--surface)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center mb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
            </div>
            <div className="flex flex-col items-center gap-3 mt-4">
              <span className="text-5xl" style={{ filter: selected.unlocked ? 'none' : 'grayscale(1)' }}>{selected.icon}</span>
              <div className="text-center">
                <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>{selected.title}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{selected.description}</p>
              </div>

              {selected.unlocked ? (
                <div className="mt-2 px-4 py-2 rounded-xl text-center" style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>✓ Achieved</p>
                  {selected.unlockedAt && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{fmtDate(selected.unlockedAt)}</p>
                  )}
                </div>
              ) : (() => {
                const prog = getAchievementProgress(selected.id, stats);
                if (!prog) return null;
                const pct = (prog.current / prog.target) * 100;
                return (
                  <div className="w-full mt-2 space-y-2">
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--primary)' }} />
                    </div>
                    <p className="text-xs text-center font-semibold" style={{ color: 'var(--text-muted)' }}>
                      {prog.current} / {prog.target} {prog.label}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
