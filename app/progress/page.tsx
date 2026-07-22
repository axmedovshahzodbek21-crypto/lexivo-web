'use client';
import { PageLoader } from '@/components/Loader';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  getLearnedWords, getSRSWords, getStreak, getXP, getTotalStudyDays,
  getTodayXP, getTodayLearnedCount, getDueWords, getStarredWords, getHardWords,
  getStudyHistory, getXPHistory, localDateStr,
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

  const todayStr = localDateStr(now);
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
          <span className="text-xl">📅</span>
          <div className="text-2xl font-black text-white leading-tight">{activeDays}</div>
          <div className="text-[10px] text-white/70 font-semibold leading-tight">{t.progress.activeDays}</div>
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

          {/* Day circles */}
          <div className="grid grid-cols-7 gap-y-1.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="w-10 h-10" />;
              const mm = String(viewMonth + 1).padStart(2, '0');
              const dd = String(day).padStart(2, '0');
              const dateStr = `${viewYear}-${mm}-${dd}`;
              const count = history[dateStr] ?? 0;
              const isToday = dateStr === todayStr;
              const isFuture = dateStr > todayStr;
              const isSelected = selected === dateStr;
              const studied = count > 0;

              const bg = studied
                ? count >= 20 ? '#3730a3'
                : count >= 10 ? '#4f46e5'
                : '#818cf8'
                : isToday ? 'var(--surface-2)' : 'transparent';

              return (
                <button
                  key={dateStr}
                  onClick={() => !isFuture && setSelected(isSelected ? null : dateStr)}
                  disabled={isFuture}
                  className="w-10 h-10 rounded-full flex flex-col items-center justify-center transition-all disabled:opacity-20"
                  style={{
                    background: bg,
                    outline: (isToday || isSelected) ? '2.5px solid #6366f1' : 'none',
                    outlineOffset: '2px',
                    transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                  }}
                >
                  <span className="text-xs font-bold leading-none" style={{ color: studied ? '#fff' : isToday ? 'var(--text)' : 'var(--text-muted)' }}>
                    {day}
                  </span>
                  {studied && (
                    <span className="text-[8px] leading-none mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day info */}
        {selected && (() => {
          const count = history[selected] ?? 0;
          const dateLabel = new Date(selected + 'T12:00:00').toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' });
          return (
            <div className="mt-4 pt-3 border-t border-[var(--border)] animate-fade-in flex items-center gap-3">
              <span className="text-2xl">{count > 0 ? '✅' : '😴'}</span>
              <div>
                <p className="font-semibold text-[var(--text)] text-sm">{dateLabel}</p>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">
                  {count > 0 ? `${count} word${count !== 1 ? 's' : ''} learned` : 'No activity'}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Legend */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[var(--border)] flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-[#818cf8]" />
            <span className="text-[10px] text-[var(--text-muted)]">1–9 words</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-[#4f46e5]" />
            <span className="text-[10px] text-[var(--text-muted)]">10–19</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-[#3730a3]" />
            <span className="text-[10px] text-[var(--text-muted)]">20+</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-4 h-4 rounded-full border-2 border-[#6366f1]" style={{ background: 'var(--surface-2)' }} />
            <span className="text-[10px] text-[var(--text-muted)]">Today</span>
          </div>
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

