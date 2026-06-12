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

  const levelInfo = getLevelInfo(xp);
  const masteredCount = srsWords.filter(w => w.reviewStage >= 4).length;
  const stageGroups = [0, 1, 2, 3, 4].map(stage => ({
    stage,
    count: srsWords.filter(w => w.reviewStage === stage).length,
  }));

  return (
    <div className="flex flex-col min-h-screen">
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">📊 Progress</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {(['overview', 'calendar', 'srs', 'achievements'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${tab === t ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
            >
              {t === 'overview' ? '📈 Overview' : t === 'calendar' ? '📅 Calendar' : t === 'srs' ? '🔄 SRS' : '🏆 Badges'}
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
              <StatBlock icon="🔥" label="Current Streak" value={`${streak} days`} color="#FF6B35" />
              <StatBlock icon="📅" label="Study Days" value={`${totalDays} days`} color="#6C63FF" />
              <StatBlock icon="📚" label="Words Learned" value={learnedCount} color="#10B981" />
              <StatBlock icon="🧠" label="SRS Mastered" value={masteredCount} color="#8B5CF6" />
              <StatBlock icon="⚡" label="Today's XP" value={`+${todayXp}`} color="#F59E0B" />
              <StatBlock icon="🎯" label="Today's Words" value={todayCount} color="#EC4899" />
            </div>

            {/* Due reviews */}
            {dueCount > 0 && (
              <Link href="/srs" className="card bg-red-50 border-[var(--danger)] flex items-center justify-between hover:bg-red-100 transition-colors">
                <div>
                  <p className="font-semibold text-[var(--danger)]">🔄 SRS Reviews Due</p>
                  <p className="text-sm text-[var(--text-muted)]">{dueCount} words waiting</p>
                </div>
                <span className="text-[var(--danger)] font-bold">→</span>
              </Link>
            )}

            {/* Other stats */}
            <div className="card">
              <h3 className="font-semibold mb-3">📌 Word Lists</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">⭐ Starred words</span>
                  <span className="font-medium">{starredCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">😓 Hard words</span>
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
                  <p className="font-semibold text-sm text-[var(--text)]">Learning History</p>
                  <p className="text-xs text-[var(--text-muted)]">Browse every word you've learned</p>
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
              <h3 className="font-semibold mb-3">SRS Stage Distribution</h3>
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
                  Learn some words to start SRS tracking.
                </p>
              )}
            </div>

            <div className="card">
              <h3 className="font-semibold mb-1">Total in SRS</h3>
              <p className="text-3xl font-bold text-[var(--primary)]">{srsWords.length}</p>
              <p className="text-sm text-[var(--text-muted)]">{masteredCount} mastered · {dueCount} due today</p>
            </div>

            {dueCount > 0 && (
              <Link href="/srs" className="btn-primary block text-center">
                🔄 Review {dueCount} Due Words
              </Link>
            )}
          </div>
        )}

        {tab === 'achievements' && (
          <div className="space-y-3 animate-fade-in">
            <p className="text-sm text-[var(--text-muted)]">{unlockedIds.length} / {ALL_ACHIEVEMENTS.length} unlocked</p>
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

const WEEK_COUNT = 16;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function cellColor(count: number): string {
  if (count === 0) return 'var(--surface-2)';
  if (count <= 4)  return 'rgba(108,99,255,0.30)';
  if (count <= 9)  return 'rgba(108,99,255,0.55)';
  if (count <= 19) return 'rgba(108,99,255,0.80)';
  return 'var(--primary)';
}

function buildGrid(history: Record<string, number>) {
  const today = new Date();
  // Anchor to the Sunday that ends the current week so the grid fills to today
  const dayOfWeek = today.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const gridEnd = new Date(today);
  gridEnd.setDate(today.getDate() + (6 - mondayOffset)); // end on Sunday

  const totalDays = WEEK_COUNT * 7;
  const gridStart = new Date(gridEnd);
  gridStart.setDate(gridEnd.getDate() - totalDays + 1);

  const weeks: { date: string; count: number; isToday: boolean; isFuture: boolean }[][] = [];
  const todayStr = today.toISOString().split('T')[0];

  for (let w = 0; w < WEEK_COUNT; w++) {
    const week: { date: string; count: number; isToday: boolean; isFuture: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + w * 7 + d);
      const dateStr = day.toISOString().split('T')[0];
      week.push({
        date: dateStr,
        count: history[dateStr] ?? 0,
        isToday: dateStr === todayStr,
        isFuture: dateStr > todayStr,
      });
    }
    weeks.push(week);
  }
  return { weeks, gridStart };
}

function buildMonthLabels(weeks: ReturnType<typeof buildGrid>['weeks']) {
  const labels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, col) => {
    const month = new Date(week[0].date).getMonth();
    if (month !== lastMonth) {
      labels.push({ label: new Date(week[0].date).toLocaleString('default', { month: 'short' }), col });
      lastMonth = month;
    }
  });
  return labels;
}

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

function StudyCalendar({
  history, streak, totalDays,
}: {
  history: Record<string, number>;
  streak: number;
  totalDays: number;
}) {
  const [tooltip, setTooltip] = useState<{ date: string; count: number } | null>(null);
  const { weeks, gridStart } = buildGrid(history);
  const monthLabels = buildMonthLabels(weeks);
  const longestStreak = calcLongestStreak(history);
  const activeDays = Object.values(history).filter(c => c > 0).length;
  const totalWords = Object.values(history).reduce((a, c) => a + c, 0);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-[var(--danger)]">🔥 {streak}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Current streak</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-[var(--primary)]">{longestStreak}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Longest streak</div>
        </div>
        <div className="card text-center py-3">
          <div className="text-2xl font-bold text-[var(--success)]">{activeDays}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Active days</div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="card overflow-x-auto">
        <h3 className="font-semibold mb-3 text-sm">Last {WEEK_COUNT} weeks</h3>

        {/* Month labels */}
        <div className="flex gap-[3px] mb-1 pl-8">
          {weeks.map((_, col) => {
            const label = monthLabels.find(l => l.col === col);
            return (
              <div key={col} className="w-[14px] flex-shrink-0 text-[9px] text-[var(--text-muted)]">
                {label ? label.label : ''}
              </div>
            );
          })}
        </div>

        {/* Grid: rows = days of week, cols = weeks */}
        <div className="flex gap-1">
          {/* Day labels */}
          <div className="flex flex-col gap-[3px] mr-1">
            {DAY_LABELS.map((d, i) => (
              <div key={d} className="h-[14px] text-[9px] text-[var(--text-muted)] flex items-center">
                {i % 2 === 0 ? d : ''}
              </div>
            ))}
          </div>

          {/* Cells */}
          {weeks.map((week, col) => (
            <div key={col} className="flex flex-col gap-[3px]">
              {week.map((day, row) => (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.count} word${day.count !== 1 ? 's' : ''}`}
                  onClick={() => setTooltip(tooltip?.date === day.date ? null : { date: day.date, count: day.count })}
                  className="w-[14px] h-[14px] rounded-[3px] cursor-pointer transition-transform hover:scale-125"
                  style={{
                    background: day.isFuture ? 'transparent' : cellColor(day.count),
                    border: day.isToday ? '1.5px solid var(--primary)' : day.isFuture ? '1px dashed var(--border)' : 'none',
                    opacity: day.isFuture ? 0.3 : 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div className="mt-3 text-xs text-[var(--text-muted)] animate-fade-in">
            📅 {tooltip.date} — {tooltip.count > 0 ? `${tooltip.count} word${tooltip.count !== 1 ? 's' : ''} learned` : 'No activity'}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[9px] text-[var(--text-muted)]">Less</span>
          {[0, 2, 6, 12, 22].map(n => (
            <div key={n} className="w-[14px] h-[14px] rounded-[3px]" style={{ background: cellColor(n) }} />
          ))}
          <span className="text-[9px] text-[var(--text-muted)]">More</span>
        </div>
      </div>

      {/* Monthly breakdown */}
      <MonthlyBreakdown history={history} />
    </div>
  );
}

function MonthlyBreakdown({ history }: { history: Record<string, number> }) {
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
      <h3 className="font-semibold mb-3 text-sm">Monthly Summary</h3>
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
