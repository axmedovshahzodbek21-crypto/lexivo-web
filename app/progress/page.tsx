'use client';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  getLearnedWords, getSRSWords, getStreak, getXP, getTotalStudyDays,
  getTodayXP, getTodayLearnedCount, getDueWords, getStarredWords, getHardWords,
  getStudyHistory,
} from '@/lib/storage';
import { getLevelInfo, ALL_ACHIEVEMENTS } from '@/lib/gamification';
import { getUnlockedAchievements } from '@/lib/storage';
import { stageLabel, stageColor } from '@/lib/srs';
import type { SRSWord } from '@/lib/types';
import { useTranslation } from '@/lib/useTranslation';

export default function ProgressPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-4xl animate-bounce">📊</div></div>}>
      <ProgressPage />
    </Suspense>
  );
}

function ProgressPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as 'overview' | 'calendar' | 'srs' | 'achievements' | null;
  const [learnedCount, setLearnedCount] = useState(0);
  const [srsWords, setSrsWords] = useState<SRSWord[]>([]);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [totalDays, setTotalDays] = useState(0);
  const [todayXp, setTodayXp] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [starredCount, setStarredCount] = useState(0);
  const [hardCount, setHardCount] = useState(0);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [studyHistory, setStudyHistory] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<'overview' | 'srs' | 'achievements' | 'calendar'>(tabParam ?? 'overview');

  useEffect(() => {
    setLearnedCount(getLearnedWords().length);
    setSrsWords(getSRSWords());
    setStreak(getStreak());
    setXp(getXP());
    setTotalDays(getTotalStudyDays());
    setTodayXp(getTodayXP());
    setTodayCount(getTodayLearnedCount());
    setDueCount(getDueWords().length);
    setStarredCount(getStarredWords().length);
    setHardCount(getHardWords().length);
    setUnlockedIds(getUnlockedAchievements());
    setStudyHistory(getStudyHistory());
  }, []);

  const t = useTranslation();
  const levelInfo = getLevelInfo(xp);
  const masteredCount = srsWords.filter(w => w.reviewStage >= 4).length;
  const stageGroups = [0, 1, 2, 3, 4].map(stage => ({
    stage,
    count: srsWords.filter(w => w.reviewStage === stage).length,
  }));

  return (
    <div className="flex flex-col min-h-screen">
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">{t.progress.title}</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {(['overview', 'calendar', 'srs', 'achievements'] as const).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${tab === tabKey ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
            >
              {tabKey === 'overview' ? t.progress.tabOverview : tabKey === 'calendar' ? t.progress.tabCalendar : tabKey === 'srs' ? t.progress.tabSRS : t.progress.tabBadges}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-4 animate-fade-in">
            {/* Level card */}
            <div className="card">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-lg">⭐ {levelInfo.level}</span>
                <span className="text-sm text-[var(--text-muted)]">{xp} XP</span>
              </div>
              <div className="progress-bar mb-1">
                <div className="progress-bar-fill" style={{ width: `${levelInfo.progress}%` }} />
              </div>
              {levelInfo.next && <p className="text-xs text-[var(--text-muted)]">Next: {levelInfo.next}</p>}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatBlock icon="🔥" label={t.progress.currentStreak} value={`${streak} ${t.progress.days}`} color="#FF6B35" />
              <StatBlock icon="📅" label={t.progress.studyDays} value={`${totalDays} ${t.progress.days}`} color="#6C63FF" />
              <StatBlock icon="📚" label={t.progress.wordsLearned} value={learnedCount} color="#10B981" />
              <StatBlock icon="🧠" label={t.progress.srsMastered} value={masteredCount} color="#8B5CF6" />
              <StatBlock icon="⚡" label={t.progress.todayXp} value={`+${todayXp}`} color="#F59E0B" />
              <StatBlock icon="🎯" label={t.progress.todayWords} value={todayCount} color="#EC4899" />
            </div>

            {/* Due reviews */}
            {dueCount > 0 && (
              <Link href="/srs" className="card bg-red-50 border-[var(--danger)] flex items-center justify-between hover:bg-red-100 transition-colors">
                <div>
                  <p className="font-semibold text-[var(--danger)]">{t.progress.srsReviewDue}</p>
                  <p className="text-sm text-[var(--text-muted)]">{t.progress.waiting(dueCount)}</p>
                </div>
                <span className="text-[var(--danger)] font-bold">→</span>
              </Link>
            )}

            {/* Other stats */}
            <div className="card">
              <h3 className="font-semibold mb-3">{t.progress.wordLists}</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">{t.progress.starred}</span>
                  <span className="font-medium">{starredCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">{t.progress.hard}</span>
                  <span className="font-medium">{hardCount}</span>
                </div>
              </div>
            </div>

            {/* Learning history link */}
            <Link
              href="/history"
              className="card flex items-center justify-between hover:border-[var(--primary)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--primary-bg)] flex items-center justify-center text-xl">📖</div>
                <div>
                  <p className="font-semibold text-sm text-[var(--text)]">{t.progress.learningHistory}</p>
                  <p className="text-xs text-[var(--text-muted)]">{t.progress.browseWords}</p>
                </div>
              </div>
              <span className="text-[var(--primary)]">→</span>
            </Link>
          </div>
        )}

        {tab === 'calendar' && (
          <div className="animate-fade-in">
            <StudyCalendar history={studyHistory} streak={streak} totalDays={totalDays} />
          </div>
        )}

        {tab === 'srs' && (
          <div className="space-y-4 animate-fade-in">
            <div className="card">
              <h3 className="font-semibold mb-3">{t.progress.srsDistribution}</h3>
              {stageGroups.map(({ stage, count }) => (
                <div key={stage} className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: stageColor(stage) }} className="font-medium">{stageLabel(stage)}</span>
                    <span className="text-[var(--text-muted)]">{count} words</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: srsWords.length ? `${(count / srsWords.length) * 100}%` : '0%',
                        background: stageColor(stage),
                      }}
                    />
                  </div>
                </div>
              ))}
              {srsWords.length === 0 && (
                <p className="text-[var(--text-muted)] text-sm text-center py-4">
                  {t.progress.learnForSRS}
                </p>
              )}
            </div>

            <div className="card">
              <h3 className="font-semibold mb-1">{t.progress.totalInSRS}</h3>
              <p className="text-3xl font-bold text-[var(--primary)]">{srsWords.length}</p>
              <p className="text-sm text-[var(--text-muted)]">{t.progress.masteredDue(masteredCount, dueCount)}</p>
            </div>

            {dueCount > 0 && (
              <Link href="/srs" className="btn-primary block text-center">
                {t.progress.reviewDue(dueCount)}
              </Link>
            )}
          </div>
        )}

        {tab === 'achievements' && (
          <div className="space-y-3 animate-fade-in">
            <p className="text-sm text-[var(--text-muted)]">{t.progress.unlockedOf(unlockedIds.length, ALL_ACHIEVEMENTS.length)}</p>
            <div className="grid grid-cols-1 gap-2">
              {ALL_ACHIEVEMENTS.map(a => {
                const unlocked = unlockedIds.includes(a.id);
                return (
                  <div key={a.id} className={`card flex items-center gap-3 ${unlocked ? '' : 'opacity-40'}`}>
                    <div className="text-3xl">{a.icon}</div>
                    <div>
                      <p className="font-semibold text-sm">{a.title} {unlocked && '✓'}</p>
                      <p className="text-xs text-[var(--text-muted)]">{a.description}</p>
                    </div>
                    {unlocked && <span className="ml-auto badge text-xs">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBlock({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div className="card py-3">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="font-bold text-lg" style={{ color }}>{value}</div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
    </div>
  );
}

// ─── Study Calendar ───────────────────────────────────────────────────────────

const MONTH_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function calcLongestStreak(history: Record<string, number>): number {
  const dates = Object.keys(history).filter(d => history[d] > 0).sort();
  let longest = 0, current = 0, prev = '';
  for (const d of dates) {
    if (prev) {
      const diff = (new Date(d).getTime() - new Date(prev).getTime()) / 86400000;
      current = diff === 1 ? current + 1 : 1;
    } else {
      current = 1;
    }
    if (current > longest) longest = current;
    prev = d;
  }
  return longest;
}

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  // Monday = 0 offset
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function StudyCalendar({
  history, streak,
}: {
  history: Record<string, number>;
  streak: number;
  totalDays: number;
}) {
  const t = useTranslation();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(null);

  const todayStr = now.toISOString().split('T')[0];
  const longestStreak = calcLongestStreak(history);
  const activeDays = Object.values(history).filter(c => c > 0).length;

  const cells = buildMonthGrid(viewYear, viewMonth);
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const canGoNext = viewYear < now.getFullYear() || (viewYear === now.getFullYear() && viewMonth < now.getMonth());

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelected(null);
  }
  function nextMonth() {
    if (!canGoNext) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelected(null);
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-[var(--danger)]">🔥 {streak}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">{t.progress.currentStreak}</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-[var(--primary)]">{longestStreak}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">{t.progress.longestStreak}</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-[var(--success)]">{activeDays}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">{t.progress.activeDays}</div>
        </div>
      </div>

      {/* Calendar */}
      <div className="card">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--surface-2)] transition-colors text-[var(--text)]">‹</button>
          <span className="font-semibold text-sm text-[var(--text)]">{monthName}</span>
          <button onClick={nextMonth} disabled={!canGoNext} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--surface-2)] transition-colors text-[var(--text)] disabled:opacity-30">›</button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {MONTH_DAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-[var(--text-muted)] py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const mm = String(viewMonth + 1).padStart(2, '0');
            const dd = String(day).padStart(2, '0');
            const dateStr = `${viewYear}-${mm}-${dd}`;
            const count = history[dateStr] ?? 0;
            const isToday = dateStr === todayStr;
            const isFuture = dateStr > todayStr;
            const isSelected = selected === dateStr;
            const studied = count > 0;

            return (
              <button
                key={dateStr}
                onClick={() => setSelected(isSelected ? null : dateStr)}
                disabled={isFuture}
                className="flex flex-col items-center justify-center aspect-square rounded-xl transition-all disabled:opacity-25"
                style={{
                  background: studied ? 'var(--primary)' : isToday ? 'var(--surface-2)' : 'transparent',
                  border: isToday && !studied ? '2px solid var(--primary)' : isSelected ? '2px solid var(--primary)' : '2px solid transparent',
                  transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                <span className="text-xs font-semibold" style={{ color: studied ? '#fff' : 'var(--text)' }}>{day}</span>
                {studied && <span className="text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Selected day info */}
        {selected && (
          <div className="mt-4 pt-3 border-t border-[var(--border)] text-sm animate-fade-in">
            {(() => {
              const count = history[selected] ?? 0;
              const dateLabel = new Date(selected).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' });
              return count > 0
                ? <p className="text-[var(--text)]">📅 <strong>{dateLabel}</strong> — {count} word{count !== 1 ? 's' : ''} learned</p>
                : <p className="text-[var(--text-muted)]">📅 <strong>{dateLabel}</strong> — No activity</p>;
            })()}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--border)]">
          <div className="w-5 h-5 rounded-md bg-[var(--surface-2)] border-2 border-[var(--primary)]" />
          <span className="text-[11px] text-[var(--text-muted)] mr-3">Today</span>
          <div className="w-5 h-5 rounded-md" style={{ background: 'var(--primary)' }} />
          <span className="text-[11px] text-[var(--text-muted)]">Studied</span>
        </div>
      </div>

      {/* Monthly breakdown */}
      <MonthlyBreakdown history={history} />
    </div>
  );
}

function MonthlyBreakdown({ history }: { history: Record<string, number> }) {
  const t = useTranslation();
  const months: { label: string; words: number; days: number }[] = [];
  const seen = new Set<string>();

  for (const date of Object.keys(history).sort().reverse()) {
    const [y, m] = date.split('-');
    const key = `${y}-${m}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const monthDates = Object.keys(history).filter(d => d.startsWith(key));
    const words = monthDates.reduce((a, d) => a + history[d], 0);
    const days = monthDates.filter(d => history[d] > 0).length;
    const label = new Date(`${key}-01`).toLocaleString('default', { month: 'long', year: 'numeric' });
    months.push({ label, words, days });
    if (months.length >= 4) break;
  }

  if (months.length === 0) return null;

  return (
    <div className="card">
      <h3 className="font-semibold mb-3 text-sm">{t.progress.monthlySummary}</h3>
      <div className="space-y-3">
        {months.map(m => (
          <div key={m.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-[var(--text)]">{m.label}</span>
              <span className="text-[var(--text-muted)]">{m.words} words · {m.days} days</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${Math.min((m.words / 100) * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
