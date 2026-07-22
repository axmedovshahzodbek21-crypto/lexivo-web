'use client';
import { PageLoader } from '@/components/Loader';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  getLearnedWords, getSRSWords, getStreak, getXP, getTotalStudyDays,
  getTodayXP, getTodayLearnedCount, getDueWords, getStarredWords, getHardWords,
  getStudyHistory, getStudyDays, getUnitDoneDays, getReviewDays, getWordGoalDays,
  getSettings, getXPHistory, localDateStr,
} from '@/lib/storage';
import type { XpEntry } from '@/lib/storage';
import { getLevelInfo, ALL_ACHIEVEMENTS } from '@/lib/gamification';
import { getUnlockedAchievements } from '@/lib/storage';
import { stageLabel, stageColor } from '@/lib/srs';
import type { SRSWord } from '@/lib/types';
import { useTranslation } from '@/lib/useTranslation';

export default function ProgressPageWrapper() {
  return (
    <Suspense fallback={<PageLoader />}>
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
  const [studyDays, setStudyDays] = useState<string[]>([]);
  const [unitDoneDays, setUnitDoneDays] = useState<string[]>([]);
  const [reviewDays, setReviewDays] = useState<string[]>([]);
  const [wordGoalDays, setWordGoalDays] = useState<string[]>([]);
  const [dailyGoal, setDailyGoal] = useState(10);
  const [xpHistory, setXpHistory] = useState<XpEntry[]>([]);
  const [tab, setTab] = useState<'overview' | 'srs' | 'achievements' | 'calendar'>(tabParam ?? 'overview');

  useEffect(() => {
    const load = () => {
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
      setStudyDays(getStudyDays());
      setUnitDoneDays(getUnitDoneDays());
      setReviewDays(getReviewDays());
      setWordGoalDays(getWordGoalDays());
      setDailyGoal(getSettings().dailyGoal);
      setXpHistory(getXPHistory());
    };
    load();
    window.addEventListener('lexivo-sync', load);
    return () => window.removeEventListener('lexivo-sync', load);
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
            <div
              className="rounded-3xl p-5 flex flex-col gap-3"
              style={{
                background: 'linear-gradient(135deg, #4338ca 0%, #7c3aed 100%)',
                boxShadow: '0 5px 0 #312e81',
              }}
            >
              <div className="flex justify-between items-center">
                <span className="font-black text-white text-xl">⭐ {levelInfo.level}</span>
                <span className="text-white/60 text-sm font-semibold">{xp} XP</span>
              </div>
              <div>
                <div className="h-2.5 rounded-full bg-white/25 overflow-hidden">
                  <div className="h-full rounded-full bg-white transition-all" style={{ width: `${levelInfo.progress}%` }} />
                </div>
                {levelInfo.next && <p className="text-white/50 text-xs mt-1.5">Next: {levelInfo.next}</p>}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatBlock icon="🔥" label={t.progress.currentStreak} value={`${streak} ${t.progress.days}`} bg="#c2410c" shadow="#7c2d12" />
              <StatBlock icon="📅" label={t.progress.studyDays} value={`${totalDays} ${t.progress.days}`} bg="#4338ca" shadow="#312e81" />
              <StatBlock icon="📚" label={t.progress.wordsLearned} value={learnedCount} bg="#059669" shadow="#064e3b" />
              <StatBlock icon="🧠" label={t.progress.srsMastered} value={masteredCount} bg="#7c3aed" shadow="#4c1d95" />
              <StatBlock icon="⚡" label={t.progress.todayXp} value={`+${todayXp}`} bg="#b45309" shadow="#78350f" />
              <StatBlock icon="🎯" label={t.progress.todayWords} value={todayCount} bg="#be185d" shadow="#831843" />
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

            {/* XP History */}
            <XpHistorySection entries={xpHistory} />

          </div>
        )}

        {tab === 'calendar' && (
          <div className="animate-fade-in max-w-lg mx-auto">
            <StudyCalendar
              history={studyHistory} streak={streak} totalDays={totalDays} studyDays={studyDays}
              unitDoneDays={unitDoneDays} reviewDays={reviewDays} wordGoalDays={wordGoalDays}
              dailyGoal={dailyGoal} dueCount={dueCount}
            />
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

function StatBlock({ icon, label, value, bg, shadow }: { icon: string; label: string; value: string | number; bg: string; shadow: string }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col justify-between min-h-[110px]"
      style={{ background: bg, boxShadow: `0 4px 0 ${shadow}` }}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-2xl font-black text-white leading-tight">{value}</div>
        <div className="text-xs text-white/70 font-medium mt-0.5">{label}</div>
      </div>
    </div>
  );
}

// ─── XP History ──────────────────────────────────────────────────────────────

const XP_ICONS: Record<string, string> = {
  Learn: '📖', Quiz: '🧠', Flashcard: '🃏', 'SRS Review': '🔄',
  'Level Complete': '🏆', Matching: '🎯', Pronunciation: '🎤',
};

function dayLabel(timestamp: number): string {
  const d = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  const key = fmt(d);
  if (key === fmt(today)) return 'Today';
  if (key === fmt(yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function groupByDay(entries: XpEntry[]): { label: string; total: number; items: XpEntry[] }[] {
  const map = new Map<string, { label: string; total: number; items: XpEntry[] }>();
  for (const e of entries) {
    const d = new Date(e.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!map.has(key)) map.set(key, { label: dayLabel(e.timestamp), total: 0, items: [] });
    const group = map.get(key)!;
    group.total += e.amount;
    group.items.push(e);
  }
  return Array.from(map.values());
}

function XpHistorySection({ entries }: { entries: XpEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const groups = groupByDay(entries);

  return (
    <div className="card">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">⭐</span>
          <span className="font-semibold">XP History</span>
        </div>
        <span className="text-[var(--text-muted)] text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-4">
          {groups.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-2">No XP earned yet</p>
          ) : (
            groups.map((group, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs text-[var(--text-muted)] font-semibold mb-2">
                  <span>{group.label}</span>
                  <span className="text-[var(--primary)]">+{group.total} XP</span>
                </div>
                <div className="space-y-1">
                  {group.items.map((entry, j) => {
                    const time = new Date(entry.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={j} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
                        <span className="text-lg">{XP_ICONS[entry.reason] ?? '⭐'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{entry.reason}</p>
                          <p className="text-xs text-[var(--text-muted)]">{time}</p>
                        </div>
                        <span className="text-sm font-bold text-[var(--primary)] whitespace-nowrap">+{entry.amount} XP</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Study Calendar ───────────────────────────────────────────────────────────

const MONTH_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function calcLongestStreak(days: string[]): number {
  const sorted = [...days].sort();
  let longest = 0, current = 0, prev = '';
  for (const d of sorted) {
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

const TASK_COLORS = {
  unit:   { bg: '#ea580c', shadow: '#9a3412' },
  review: { bg: '#4338ca', shadow: '#312e81' },
  words:  { bg: '#059669', shadow: '#064e3b' },
} as const;

function MiniCalendar({ title, color, days, year, month }: {
  title: string; color: string; days: string[]; year: number; month: number;
}) {
  const cells = buildMonthGrid(year, month);
  const todayStr = localDateStr(new Date());
  const mm = String(month + 1).padStart(2, '0');
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        <span className="text-xs font-bold text-[var(--text)]">{title}</span>
        <span className="text-[10px] text-[var(--text-muted)] ml-auto">{days.filter(d => d.startsWith(`${year}-${mm}`)).length} days this month</span>
      </div>
      <div className="grid grid-cols-7 gap-1 w-fit">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="w-9 h-6 flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)]">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="w-9 h-9" />;
          const dateStr = `${year}-${mm}-${String(day).padStart(2, '0')}`;
          const done = days.includes(dateStr);
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          return (
            <div key={i} className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{
                background: done ? color : 'var(--surface-2)',
                outline: isToday ? `2.5px solid ${color}` : 'none',
                outlineOffset: '2px',
                opacity: isFuture ? 0.2 : 1,
              }}
            >
              <span className="text-xs font-bold" style={{ color: done ? '#fff' : 'var(--text-muted)' }}>{day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StudyCalendar({
  history, streak, studyDays, unitDoneDays, reviewDays, wordGoalDays, dailyGoal, dueCount,
}: {
  history: Record<string, number>;
  streak: number;
  totalDays: number;
  studyDays: string[];
  unitDoneDays: string[];
  reviewDays: string[];
  wordGoalDays: string[];
  dailyGoal: number;
  dueCount: number;
}) {
  const t = useTranslation();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const todayStr = localDateStr(now);
  const longestStreak = calcLongestStreak(studyDays);
  const completeDays = unitDoneDays.filter(d => reviewDays.includes(d) && wordGoalDays.includes(d));
  const activeDays = completeDays.length;

  const cells = buildMonthGrid(viewYear, viewMonth);
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  const canGoNext = viewYear < now.getFullYear() || (viewYear === now.getFullYear() && viewMonth < now.getMonth());

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (!canGoNext) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  // If nothing is due for review today, treat the review task as N/A (auto-satisfied)
  const reviewNA = dueCount === 0;

  const sheetTasks = selectedDay ? {
    unit:   unitDoneDays.includes(selectedDay),
    review: reviewDays.includes(selectedDay) || (selectedDay === todayStr && reviewNA),
    words:  wordGoalDays.includes(selectedDay),
  } : null;
  const sheetIsToday = selectedDay === todayStr;

  return (
    <div className="space-y-4">
      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl p-3 flex flex-col gap-1" style={{ background: '#c2410c', boxShadow: '0 3px 0 #7c2d12' }}>
          <span className="text-xl">🔥</span>
          <div className="text-2xl font-black text-white leading-tight">{streak}</div>
          <div className="text-[10px] text-white/70 font-semibold leading-tight">{t.progress.currentStreak}</div>
        </div>
        <div className="rounded-2xl p-3 flex flex-col gap-1" style={{ background: '#4338ca', boxShadow: '0 3px 0 #312e81' }}>
          <span className="text-xl">⚡</span>
          <div className="text-2xl font-black text-white leading-tight">{longestStreak}</div>
          <div className="text-[10px] text-white/70 font-semibold leading-tight">{t.progress.longestStreak}</div>
        </div>
        <div className="rounded-2xl p-3 flex flex-col gap-1" style={{ background: '#059669', boxShadow: '0 3px 0 #064e3b' }}>
          <span className="text-xl">🏆</span>
          <div className="text-2xl font-black text-white leading-tight">{activeDays}</div>
          <div className="text-[10px] text-white/70 font-semibold leading-tight">Full days</div>
        </div>
      </div>

      {/* Calendar card */}
      <div className="card">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={prevMonth} aria-label="Previous month" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--surface-2)] transition-colors text-[var(--text)] text-xl font-bold">‹</button>
          <span className="font-bold text-[var(--text)]">{monthName}</span>
          <button onClick={nextMonth} disabled={!canGoNext} aria-label="Next month" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--surface-2)] transition-colors text-[var(--text)] text-xl font-bold disabled:opacity-30">›</button>
        </div>

        <div className="max-w-[308px] mx-auto">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {MONTH_DAYS.map(d => (
              <div key={d} className="w-10 h-7 flex items-center justify-center text-[10px] font-bold text-[var(--text-muted)]">{d}</div>
            ))}
          </div>

          {/* Day circles — partial fill: bottom=unit(orange), mid=review(indigo), top=words(green) */}
          <div className="grid grid-cols-7 gap-y-1.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="w-10 h-10" />;
              const mm = String(viewMonth + 1).padStart(2, '0');
              const dd = String(day).padStart(2, '0');
              const dateStr = `${viewYear}-${mm}-${dd}`;
              const isToday = dateStr === todayStr;
              const isFuture = dateStr > todayStr;
              const isSelected = selectedDay === dateStr;
              const unit   = unitDoneDays.includes(dateStr);
              const review = reviewDays.includes(dateStr) || (isToday && reviewNA);
              const words  = wordGoalDays.includes(dateStr);
              const taskCount = (unit ? 1 : 0) + (review ? 1 : 0) + (words ? 1 : 0);
              const anyDone = taskCount > 0;

              return (
                <button
                  key={dateStr}
                  onClick={() => !isFuture && setSelectedDay(isSelected ? null : dateStr)}
                  disabled={isFuture}
                  className="w-10 h-10 rounded-full relative overflow-hidden flex items-center justify-center transition-all disabled:opacity-20"
                  style={{
                    background: anyDone ? 'var(--surface-2)' : 'transparent',
                    outline: (isToday || isSelected) ? '2.5px solid #6366f1' : 'none',
                    outlineOffset: '2px',
                    transform: isSelected ? 'scale(1.12)' : 'scale(1)',
                  }}
                >
                  {unit   && <div className="absolute bottom-0 left-0 right-0" style={{ height: '33.34%', background: TASK_COLORS.unit.bg }} />}
                  {review && <div className="absolute left-0 right-0" style={{ bottom: '33.34%', height: '33.33%', background: TASK_COLORS.review.bg }} />}
                  {words  && <div className="absolute top-0 left-0 right-0" style={{ height: '33.34%', background: TASK_COLORS.words.bg }} />}
                  <span className="relative z-10 text-xs font-bold leading-none"
                    style={{ color: anyDone ? '#fff' : isToday ? 'var(--text)' : 'var(--text-muted)' }}>
                    {day}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-5 pt-3 border-t border-[var(--border)] flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full" style={{ background: TASK_COLORS.unit.bg }} />
            <span className="text-[10px] text-[var(--text-muted)]">Unit done</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full" style={{ background: TASK_COLORS.review.bg }} />
            <span className="text-[10px] text-[var(--text-muted)]">SRS review</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full" style={{ background: TASK_COLORS.words.bg }} />
            <span className="text-[10px] text-[var(--text-muted)]">{dailyGoal} words</span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] ml-auto">Tap a day for details</span>
        </div>
      </div>

      {/* Monthly breakdown */}
      <MonthlyBreakdown history={history} />

      {/* Bottom sheet */}
      {selectedDay && sheetTasks && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setSelectedDay(null)}>
          <div className="w-full max-w-lg rounded-t-3xl max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--bg)' }}
            onClick={e => e.stopPropagation()}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
            </div>
            <div className="px-5 pt-2 pb-8">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {new Date(selectedDay + 'T12:00:00').toLocaleDateString('default', { weekday: 'long' })}
                  </p>
                  <p className="text-xl font-black" style={{ color: 'var(--text)' }}>
                    {new Date(selectedDay + 'T12:00:00').toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => setSelectedDay(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>✕</button>
              </div>

              {/* Task rows */}
              <div className="space-y-2 mb-6">
                {([
                  { key: 'unit',   label: 'Unit Complete',                       done: sheetTasks.unit,   href: '/learn', btnLabel: 'Pick a Unit', color: TASK_COLORS.unit.bg },
                  { key: 'review', label: 'SRS Review',                          done: sheetTasks.review, href: '/srs',   btnLabel: reviewNA ? 'All caught up ✓' : 'Go to Review', color: TASK_COLORS.review.bg, na: sheetIsToday && reviewNA && !reviewDays.includes(todayStr) },
                  { key: 'words',  label: `Daily Words (${dailyGoal} goal)`,     done: sheetTasks.words,  href: '/learn', btnLabel: 'Learn Words',  color: TASK_COLORS.words.bg },
                ] as const).map(task => (
                  <div key={task.key} className="flex items-center gap-3 rounded-2xl p-3"
                    style={{ background: 'var(--surface-2)' }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: ('na' in task && task.na) ? 'var(--border)' : task.done ? task.color : 'var(--border)' }}>
                      <span className="text-xs font-black text-white">{('na' in task && task.na) ? '–' : task.done ? '✓' : ''}</span>
                    </div>
                    <span className="text-sm font-semibold flex-1" style={{ color: 'var(--text)' }}>{task.label}</span>
                    {('na' in task && task.na) ? (
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>All caught up ✓</span>
                    ) : sheetIsToday && !task.done ? (
                      <Link href={task.href} onClick={() => setSelectedDay(null)}
                        className="text-xs font-bold px-3 py-1.5 rounded-full text-white whitespace-nowrap"
                        style={{ background: task.color }}>
                        {task.btnLabel} →
                      </Link>
                    ) : task.done ? (
                      <span className="text-xs font-bold" style={{ color: task.color }}>Done ✓</span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Not done</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Three mini-calendars */}
              <div className="space-y-5">
                <MiniCalendar title="Unit Complete" color={TASK_COLORS.unit.bg}   days={unitDoneDays} year={viewYear} month={viewMonth} />
                <MiniCalendar title="SRS Review"    color={TASK_COLORS.review.bg} days={reviewDays}   year={viewYear} month={viewMonth} />
                <MiniCalendar title={`Daily Words (${dailyGoal})`} color={TASK_COLORS.words.bg} days={wordGoalDays} year={viewYear} month={viewMonth} />
              </div>
            </div>
          </div>
        </div>
      )}
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

