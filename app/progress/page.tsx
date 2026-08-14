'use client';
import { PageLoader } from '@/components/Loader';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  getLearnedWords, getSRSWords, getStreak, getXP, getTotalStudyDays,
  getTodayXP, getTodayLearnedCount, getDueWords, getStarredWords, getHardWords,
  getStudyHistory, getStudyDays, getReviewDays, getWordGoalDays,
  getSettings, getXPHistory, localDateStr, getReviewLog, getGraduatedCount, displayXP,
  getUnitProgress, getSRSLockedDays,
} from '@/lib/storage';
import type { XpEntry } from '@/lib/storage';
import { useAppStore } from '@/lib/store';
import { getLevelInfo, ALL_ACHIEVEMENTS, CATEGORY_ORDER, CATEGORY_META, getAchievementProgress } from '@/lib/gamification';
import { getUnlockedAchievements } from '@/lib/storage';
import { stageLabel, stageColor } from '@/lib/srs';
import type { SRSWord } from '@/lib/types';
import { SRS_INTERVALS } from '@/lib/types';
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
  const [reviewDays, setReviewDays] = useState<string[]>([]);
  const [wordGoalDays, setWordGoalDays] = useState<string[]>([]);
  const [srsLockedDays, setSrsLockedDays] = useState<string[]>([]);
  const [dailyGoal, setDailyGoal] = useState(10);
  const [xpHistory, setXpHistory] = useState<XpEntry[]>([]);
  const [tab, setTab] = useState<'overview' | 'srs' | 'achievements' | 'calendar'>(tabParam ?? 'overview');
  const [foundationDone, setFoundationDone] = useState<Record<string, { done: number; total: number }>>({});

  const { collections } = useAppStore();

  useEffect(() => {
    if (!collections.length) return;
    const result: Record<string, { done: number; total: number }> = {};
    for (const name of ['A1', 'A2', 'B1']) {
      const col = collections.find(c => c.name === name);
      if (!col) { result[name] = { done: 0, total: 0 }; continue; }
      const done = col.days.filter(d => !!getUnitProgress(name, d.dayNumber).completedAt).length;
      result[name] = { done, total: col.days.length };
    }
    setFoundationDone(result);
  }, [collections]);

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
      setReviewDays(getReviewDays());
      setWordGoalDays(getWordGoalDays());
      setSrsLockedDays(getSRSLockedDays());
      setDailyGoal(getSettings().dailyGoal);
      setXpHistory(getXPHistory());
    };
    load();
  }, []);

  const t = useTranslation();
  const levelInfo = getLevelInfo(xp);
  const masteredCount = getGraduatedCount();

  // Weekly activity (last 7 days)
  const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = localDateStr(d);
    const label = i === 6 ? 'Today' : i === 5 ? 'Yes' :
      d.toLocaleDateString('default', { weekday: 'short' }).slice(0, 3);
    return { dateStr, label, active: studyDays.includes(dateStr) };
  });
  const activeThisWeek = weeklyActivity.filter(d => d.active).length;

  // Averages
  const wordsPerDay = totalDays > 0 ? (learnedCount / totalDays).toFixed(1) : '—';
  const xpPerDay = totalDays > 0 ? displayXP(Math.round(xp / totalDays)) : '—';

  // Foundation meta
  const LEVEL_META = [
    { name: 'A1', color: '#2ECC71' },
    { name: 'A2', color: '#27AE60' },
    { name: 'B1', color: '#3498DB' },
  ];
  const reviewLog = getReviewLog();
  const completionGroups = [0, 1, 2, 3, 4, 5].map(n => ({
    completedCount: n,
    count: srsWords.filter(w => (reviewLog[w.id] ?? []).length === n).length,
  }));

  return (
    <div className="flex flex-col min-h-screen">
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">{t.progress.title}</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {(['overview', 'calendar', 'srs', 'achievements'] as const).map(tabKey => {
            const icons: Record<string, string> = { overview: '📊', calendar: '📅', srs: '🔄', achievements: '🏆' };
            const labels: Record<string, string> = { overview: t.progress.tabOverview, calendar: t.progress.tabCalendar, srs: t.progress.tabSRS, achievements: t.progress.tabBadges };
            const active = tab === tabKey;
            return (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap"
                style={active ? {
                  background: 'linear-gradient(135deg, var(--primary), #818CF8)',
                  color: '#fff',
                  boxShadow: '0 3px 0 #4338CA, 0 6px 16px color-mix(in srgb, var(--primary) 40%, transparent)',
                } : {
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                }}
              >
                {icons[tabKey]} {labels[tabKey]}
              </button>
            );
          })}
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
                <span className="text-white/60 text-sm font-semibold">{displayXP(xp)} XP</span>
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
              <StatBlock icon="⚡" label={t.progress.todayXp} value={`+${displayXP(todayXp)}`} bg="#b45309" shadow="#78350f" />
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

            {/* Weekly Activity */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">📅 This Week</h3>
                <span className="text-sm font-bold text-[var(--primary)]">{activeThisWeek} / 7 days</span>
              </div>
              <div className="flex gap-1.5">
                {weeklyActivity.map((day, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="w-full aspect-square rounded-xl flex items-center justify-center text-xs font-bold"
                      style={{ background: day.active ? 'var(--primary)' : 'var(--surface-2)', color: day.active ? '#fff' : 'var(--text-muted)' }}
                    >
                      {day.active ? '✓' : '·'}
                    </div>
                    <span className="text-[9px] font-medium text-[var(--text-muted)]">{day.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Averages */}
            <div className="card">
              <h3 className="font-semibold mb-3">📊 Averages</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Words per study day</span>
                  <span className="font-bold text-[var(--primary)]">{wordsPerDay}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">XP per study day</span>
                  <span className="font-bold text-[var(--primary)]">{xpPerDay}</span>
                </div>
              </div>
            </div>

            {/* Foundation Progress */}
            {LEVEL_META.some(l => foundationDone[l.name]?.total > 0) && (
              <div className="card">
                <h3 className="font-semibold mb-3">🌱 Foundation Progress</h3>
                <div className="space-y-3">
                  {LEVEL_META.map(({ name, color }) => {
                    const fd = foundationDone[name];
                    if (!fd || fd.total === 0) return null;
                    const pct = fd.done / fd.total;
                    return (
                      <div key={name}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-semibold" style={{ color }}>{name}</span>
                          <span className="text-[var(--text-muted)] text-xs">{fd.done} / {fd.total} units</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct * 100}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* XP History */}
            <XpHistorySection entries={xpHistory} />

          </div>
        )}

        {tab === 'calendar' && (
          <div className="animate-fade-in">
            <StudyCalendar
              history={studyHistory} streak={streak} totalDays={totalDays} studyDays={studyDays}
              reviewDays={reviewDays} wordGoalDays={wordGoalDays} srsLockedDays={srsLockedDays}
              dailyGoal={dailyGoal} dueCount={dueCount} todayWordsCount={todayCount}
            />
          </div>
        )}

        {tab === 'srs' && (
          <div className="space-y-4 animate-fade-in">
            <div className="card">
              <h3 className="font-semibold mb-3">{t.progress.srsDistribution}</h3>
              {completionGroups.map(({ completedCount, count }) => (
                <div key={completedCount} className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: stageColor(completedCount) }} className="font-medium">
                      {stageLabel(completedCount)}
                      <span className="text-[var(--text-muted)] font-normal ml-1 text-xs">({completedCount}/{SRS_INTERVALS.length})</span>
                    </span>
                    <span className="text-[var(--text-muted)]">{count} words</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: srsWords.length ? `${(count / srsWords.length) * 100}%` : '0%',
                        background: stageColor(completedCount),
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

        {tab === 'achievements' && (() => {
          const stats = { learnedCount, streak, xp, masteredCount: 0, totalDays,
            flashDays: 0, flashStreak: 0, quizDays: 0, quizStreak: 0 };
          const xpEarned = ALL_ACHIEVEMENTS.filter(a => unlockedIds.includes(a.id)).reduce((s, a) => s + a.xp, 0);
          const xpTotal  = ALL_ACHIEVEMENTS.reduce((s, a) => s + a.xp, 0);
          const byCategory: Record<string, typeof ALL_ACHIEVEMENTS> = {};
          for (const a of ALL_ACHIEVEMENTS) (byCategory[a.category] ??= []).push(a);
          return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Summary row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {unlockedIds.length} / {ALL_ACHIEVEMENTS.length} unlocked
                </p>
                <p style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>✨ {xpEarned} / {xpTotal} XP</p>
              </div>

              {/* Category sections */}
              {CATEGORY_ORDER.map(cat => {
                const achs = byCategory[cat] ?? [];
                if (!achs.length) return null;
                const meta = CATEGORY_META[cat];
                const catUnlocked = achs.filter(a => unlockedIds.includes(a.id)).length;
                return (
                  <div key={cat}>
                    {/* Category header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                      padding: '8px 12px', borderRadius: 12,
                      background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 14 }}>{meta.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)', flex: 1 }}>{meta.label}</span>
                      <div style={{ height: 3, width: 40, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', marginRight: 6 }}>
                        <div style={{ height: '100%', borderRadius: 2, background: 'var(--primary)',
                          width: `${achs.length ? (catUnlocked / achs.length) * 100 : 0}%` }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: catUnlocked > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {catUnlocked}/{achs.length}
                      </span>
                    </div>

                    {/* 2-col card grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {achs.map(a => {
                        const isUnlocked = unlockedIds.includes(a.id);
                        const prog = !isUnlocked ? getAchievementProgress(a.id, stats) : null;
                        const pct = prog ? prog.current / prog.target : 0;
                        return (
                          <div key={a.id} style={{
                            display: 'flex', flexDirection: 'column', padding: '10px 10px 8px',
                            borderRadius: 14, position: 'relative', overflow: 'hidden',
                            background: isUnlocked ? 'var(--surface)' : 'var(--surface-2)',
                            border: `1px solid ${isUnlocked ? 'color-mix(in srgb, var(--primary) 28%, transparent)' : 'var(--border)'}`,
                            boxShadow: isUnlocked ? '0 2px 10px color-mix(in srgb, var(--primary) 10%, transparent)' : 'none',
                            opacity: isUnlocked ? 1 : 0.65,
                          }}>
                            {/* XP badge */}
                            <div style={{ position: 'absolute', top: 7, right: 7, fontSize: 8, fontWeight: 800,
                              padding: '2px 5px', borderRadius: 5,
                              background: isUnlocked ? 'linear-gradient(135deg, var(--primary), var(--primary-light))' : 'var(--border)',
                              color: isUnlocked ? 'white' : 'var(--text-muted)' }}>
                              +{a.xp} XP
                            </div>
                            {/* Icon */}
                            <div style={{ width: 38, height: 38, borderRadius: 11, marginBottom: 7,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                              background: isUnlocked ? 'color-mix(in srgb, var(--primary) 10%, var(--surface))' : 'var(--border)',
                              filter: isUnlocked ? 'none' : 'grayscale(1)' }}>
                              {a.icon}
                            </div>
                            {/* Title */}
                            <p style={{ fontSize: 11, fontWeight: 700, margin: 0, lineHeight: 1.3,
                              color: isUnlocked ? 'var(--text)' : 'var(--text-muted)', paddingRight: 24 }}>
                              {a.title}
                            </p>
                            {/* Description hint */}
                            <p style={{ fontSize: 9.5, margin: '2px 0 6px', lineHeight: 1.3,
                              color: isUnlocked ? 'color-mix(in srgb, var(--primary) 75%, transparent)' : 'var(--text-muted)' }}>
                              {a.description}
                            </p>
                            {/* Bottom: check or progress */}
                            {isUnlocked ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 14, height: 14, borderRadius: '50%',
                                  background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 8, color: 'white', fontWeight: 700 }}>✓</div>
                                <span style={{ fontSize: 9, color: 'var(--primary)', fontWeight: 600 }}>Achieved</span>
                              </div>
                            ) : prog ? (
                              <>
                                <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', marginBottom: 2 }}>
                                  <div style={{ height: '100%', borderRadius: 2, width: `${pct * 100}%`, background: 'var(--primary)' }} />
                                </div>
                                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{prog.current}/{prog.target} {prog.label}</span>
                              </>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
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
                  <span className="text-[var(--primary)]">+{displayXP(group.total)} XP</span>
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
                        <span className="text-sm font-bold text-[var(--primary)] whitespace-nowrap">+{displayXP(entry.amount)} XP</span>
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

function calcCurrentStreak(days: string[]): number {
  if (!days.length) return 0;
  const sorted = [...days].sort().reverse();
  const today = localDateStr(new Date());
  const yesterday = localDateStr(new Date(Date.now() - 86400000));
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;
  let count = 0;
  let expected = new Date(sorted[0] === today ? Date.now() : Date.now() - 86400000);
  for (const d of sorted) {
    if (d === localDateStr(expected)) { count++; expected = new Date(expected.getTime() - 86400000); }
    else break;
  }
  return count;
}

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

function MiniCalendar({ title, color, days, year, month, lockedDays }: {
  title: string; color: string; days: string[]; year: number; month: number; lockedDays?: string[];
}) {
  const cells = buildMonthGrid(year, month);
  const todayStr = localDateStr(new Date());
  const mm = String(month + 1).padStart(2, '0');
  const monthCount = days.filter(d => d.startsWith(`${year}-${mm}`)).length;
  return (
    <div className="rounded-2xl p-3" style={{ background: 'var(--surface-2)', border: `1px solid ${color}33` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
          <span className="text-xs font-bold truncate" style={{ color: 'var(--text)' }}>{title}</span>
        </div>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
          style={{ background: color, color: '#fff' }}>
          {monthCount} {monthCount === 1 ? 'day' : 'days'}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="flex items-center justify-center text-[8px] font-bold pb-0.5" style={{ color: 'var(--text-muted)' }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="aspect-square" />;
          const dateStr = `${year}-${mm}-${String(day).padStart(2, '0')}`;
          const done    = days.includes(dateStr);
          const locked  = !done && !!lockedDays?.includes(dateStr);
          const isToday  = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          const hasCircle = done || locked || isToday;
          return (
            <div key={i} className="aspect-square flex items-center justify-center"
              style={{ opacity: isFuture ? 0.2 : 1 }}
            >
              <div className="flex items-center justify-center"
                style={{
                  width: hasCircle ? '72%' : 'auto',
                  aspectRatio: hasCircle ? '1' : undefined,
                  borderRadius: '50%',
                  background: done ? color : locked ? '#52525244' : 'transparent',
                  outline: isToday ? `2px solid ${color}` : 'none',
                  outlineOffset: '2px',
                  boxShadow: done ? `0 0 5px ${color}70` : isToday ? `0 0 5px ${color}40` : 'none',
                }}
              >
                {locked
                  ? <span style={{ fontSize: 7, lineHeight: 1 }}>🔒</span>
                  : <span style={{ fontSize: 10, fontWeight: done || isToday ? 700 : 500, lineHeight: 1, color: done ? '#fff' : isToday ? color : 'var(--text-muted)' }}>{day}</span>
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StudyCalendar({
  history, streak, studyDays, reviewDays, wordGoalDays, srsLockedDays, dailyGoal, dueCount, todayWordsCount,
}: {
  history: Record<string, number>;
  streak: number;
  totalDays: number;
  studyDays: string[];
  reviewDays: string[];
  wordGoalDays: string[];
  srsLockedDays: string[];
  dailyGoal: number;
  dueCount: number;
  todayWordsCount: number;
}) {
  const t = useTranslation();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [infoModal, setInfoModal] = useState<{ title: string; body: string; emoji: string; color: string; x: number; y: number; above: boolean } | null>(null);

  const INFO = {
    review:   { title: 'SRS Review',       emoji: '🔁', color: TASK_COLORS.review.bg, body: 'Spaced Repetition System — words you\'ve learned come back for review at growing intervals. Complete all words due today to mark the blue half of your day circle.' },
    words:    { title: 'Daily Word Goal',   emoji: '✏️', color: TASK_COLORS.words.bg,  body: 'Learn new words each day to hit your personal target. You set the number yourself in Settings. Reach it to mark the green half of your day circle.' },
    streak:   { title: 'Current Streak',   emoji: '🔥', color: '#be123c',              body: 'Days in a row where you completed BOTH SRS review and your word goal. Miss a day without a streak freeze and it resets to 0.' },
    longest:  { title: 'Longest Streak',   emoji: '⚡', color: '#0369a1',              body: 'Your all-time personal best — the longest consecutive run of perfect days you\'ve ever achieved. It never resets.' },
    fulldays: { title: 'Full Days',         emoji: '🏆', color: '#b45309',              body: 'Total count of days where you completed both tasks. Every perfect day adds 1 — this is your lifetime tally of fully productive days.' },
    monthly:  { title: 'Monthly Summary',  emoji: '📅', color: '#6d28d9',              body: 'Words you learned and days you studied each month. A day counts if you did at least one learning session.' },
  };
  function InfoBtn({ k, light }: { k: keyof typeof INFO; light?: boolean }) {
    return (
      <button
        onClick={e => {
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          const above = r.bottom > window.innerHeight * 0.6;
          setInfoModal({ ...INFO[k], x: r.left + r.width / 2, y: above ? r.top - 8 : r.bottom + 8, above });
        }}
        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
        style={{ background: light ? 'rgba(255,255,255,0.25)' : 'var(--border)', color: light ? '#fff' : 'var(--text-muted)', fontSize: 9, fontWeight: 700, lineHeight: 1 }}
      >i</button>
    );
  }
  const todayStr = localDateStr(now);
  const completeDays = reviewDays.filter(d => wordGoalDays.includes(d));
  const longestStreak = calcLongestStreak(completeDays);
  const activeDays = completeDays.length;

  // Per-task stats
  const wordsCurrent = calcCurrentStreak(wordGoalDays);
  const wordsLongest = calcLongestStreak(wordGoalDays);
  const srsCurrent   = calcCurrentStreak(reviewDays);
  const srsLongest   = calcLongestStreak(reviewDays);

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

  const sheetTasks = selectedDay ? {
    review: reviewDays.includes(selectedDay),
    words:  wordGoalDays.includes(selectedDay),
  } : null;
  const sheetIsToday = selectedDay === todayStr;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

      {/* ── Left column: stats + calendar ── */}
      <div className="space-y-4">

      {/* ── Today task cards ── */}
      {(() => {
        const reviewToday = reviewDays.includes(todayStr);
        const wordsToday  = wordGoalDays.includes(todayStr);
        const goalLabel   = wordsToday
          ? `${dailyGoal} words ✓`
          : `${Math.min(todayWordsCount, dailyGoal)}/${dailyGoal} words`;
        return (
          <div className="grid grid-cols-2 gap-3 mb-1">
            {/* Review card */}
            <div className="rounded-2xl py-4 px-4 flex flex-col items-center gap-2 relative overflow-hidden"
              style={{
                background: reviewToday
                  ? `linear-gradient(135deg, ${TASK_COLORS.review.bg}, ${TASK_COLORS.review.shadow})`
                  : 'var(--surface)',
                border: `2px solid ${reviewToday ? TASK_COLORS.review.bg : 'var(--border)'}`,
                boxShadow: reviewToday ? `0 4px 0 ${TASK_COLORS.review.shadow}, 0 8px 20px ${TASK_COLORS.review.bg}55` : 'none',
              }}>
              {reviewToday && <div style={{ position: 'absolute', right: -8, bottom: -10, fontSize: 60, opacity: 0.1, pointerEvents: 'none', userSelect: 'none', lineHeight: 1 }}>🔁</div>}
              <span style={{ fontSize: 26, position: 'relative', zIndex: 1 }}>{reviewToday ? '✅' : '○'}</span>
              <span className="flex items-center gap-1" style={{ position: 'relative', zIndex: 1 }}>
                <span className="text-xs font-black" style={{ color: reviewToday ? '#fff' : 'var(--text-muted)' }}>Review</span>
                <InfoBtn k="review" light={reviewToday} />
              </span>
              <span className="text-[10px] font-bold" style={{ color: reviewToday ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)', position: 'relative', zIndex: 1 }}>
                {reviewToday ? 'All done!' : dueCount > 0 ? `${dueCount} due` : 'Nothing due'}
              </span>
            </div>
            {/* Words card */}
            <div className="rounded-2xl py-4 px-4 flex flex-col items-center gap-2 relative overflow-hidden"
              style={{
                background: wordsToday
                  ? `linear-gradient(135deg, ${TASK_COLORS.words.bg}, ${TASK_COLORS.words.shadow})`
                  : 'var(--surface)',
                border: `2px solid ${wordsToday ? TASK_COLORS.words.bg : 'var(--border)'}`,
                boxShadow: wordsToday ? `0 4px 0 ${TASK_COLORS.words.shadow}, 0 8px 20px ${TASK_COLORS.words.bg}55` : 'none',
              }}>
              {wordsToday && <div style={{ position: 'absolute', right: -8, bottom: -10, fontSize: 60, opacity: 0.1, pointerEvents: 'none', userSelect: 'none', lineHeight: 1 }}>✏️</div>}
              <span style={{ fontSize: 26, position: 'relative', zIndex: 1 }}>{wordsToday ? '✅' : '✏️'}</span>
              <span className="flex items-center gap-1" style={{ position: 'relative', zIndex: 1 }}>
                <span className="text-xs font-black" style={{ color: wordsToday ? '#fff' : 'var(--text-muted)' }}>Words</span>
                <InfoBtn k="words" light={wordsToday} />
              </span>
              <span className="text-[10px] font-bold" style={{ color: wordsToday ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)', position: 'relative', zIndex: 1 }}>{goalLabel}</span>
            </div>
          </div>
        );
      })()}

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-3">
        {/* Current Streak */}
        <div className="rounded-2xl p-3 flex flex-col gap-1 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #F43F5E, #BE123C, #881337)', boxShadow: '0 4px 0 #881337, 0 8px 20px #BE123C55' }}>
          <div style={{ position: 'absolute', right: -6, bottom: -10, fontSize: 52, opacity: 0.12, lineHeight: 1, pointerEvents: 'none', userSelect: 'none' }}>🔥</div>
          <span className="text-xl relative z-10">🔥</span>
          <div className="text-3xl font-black text-white leading-tight relative z-10">{streak}</div>
          <div className="flex items-center gap-1 relative z-10">
            <div className="text-[10px] text-white/70 font-bold leading-tight">{t.progress.currentStreak}</div>
            <InfoBtn k="streak" light />
          </div>
        </div>
        {/* Longest Streak */}
        <div className="rounded-2xl p-3 flex flex-col gap-1 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #38BDF8, #0369A1, #0C4A6E)', boxShadow: '0 4px 0 #0C4A6E, 0 8px 20px #0369A155' }}>
          <div style={{ position: 'absolute', right: -6, bottom: -10, fontSize: 52, opacity: 0.12, lineHeight: 1, pointerEvents: 'none', userSelect: 'none' }}>⚡</div>
          <span className="text-xl relative z-10">⚡</span>
          <div className="text-3xl font-black text-white leading-tight relative z-10">{longestStreak}</div>
          <div className="flex items-center gap-1 relative z-10">
            <div className="text-[10px] text-white/70 font-bold leading-tight">{t.progress.longestStreak}</div>
            <InfoBtn k="longest" light />
          </div>
        </div>
        {/* Full Days */}
        <div className="rounded-2xl p-3 flex flex-col gap-1 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #FBBF24, #B45309, #78350F)', boxShadow: '0 4px 0 #78350F, 0 8px 20px #B4530955' }}>
          <div style={{ position: 'absolute', right: -6, bottom: -10, fontSize: 52, opacity: 0.12, lineHeight: 1, pointerEvents: 'none', userSelect: 'none' }}>🏆</div>
          <span className="text-xl relative z-10">🏆</span>
          <div className="text-3xl font-black text-white leading-tight relative z-10">{activeDays}</div>
          <div className="flex items-center gap-1 relative z-10">
            <div className="text-[10px] text-white/70 font-bold leading-tight">Full days</div>
            <InfoBtn k="fulldays" light />
          </div>
        </div>
      </div>

      {/* Task breakdown — collapsed by default */}
      <div>
        <button
          onClick={() => setShowBreakdown(b => !b)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold"
          style={{ color: 'var(--text-muted)' }}
        >
          Task breakdown
          <span style={{ fontSize: 9 }}>{showBreakdown ? '▴' : '▾'}</span>
        </button>

        {showBreakdown && (
          <div className="space-y-2 mt-1">
            {([
              { label: 'Words', color: TASK_COLORS.words.bg, current: wordsCurrent, longest: wordsLongest, total: wordGoalDays.length },
              { label: 'SRS',   color: TASK_COLORS.review.bg, current: srsCurrent,  longest: srsLongest,  total: reviewDays.length   },
            ] as const).map(row => (
              <div key={row.label} className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: 'var(--surface-2)', borderLeft: `3px solid ${row.color}` }}>
                <span className="text-xs font-bold w-10 shrink-0" style={{ color: row.color }}>{row.label}</span>
                <div className="flex gap-4 flex-1 justify-around">
                  {([
                    { val: row.current, label: 'Current' },
                    { val: row.longest, label: 'Longest' },
                    { val: row.total,   label: 'Days' },
                  ] as const).map(stat => (
                    <div key={stat.label} className="text-center">
                      <div className="text-sm font-black" style={{ color: 'var(--text)' }}>{stat.val}</div>
                      <div className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
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

          {/* Day circles — partial fill: bottom=review(indigo), top=words(green) */}
          <div className="grid grid-cols-7 gap-y-1.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="w-10 h-10" />;
              const mm = String(viewMonth + 1).padStart(2, '0');
              const dd = String(day).padStart(2, '0');
              const dateStr = `${viewYear}-${mm}-${dd}`;
              const isToday = dateStr === todayStr;
              const isFuture = dateStr > todayStr;
              const isSelected = selectedDay === dateStr;
              const review   = reviewDays.includes(dateStr);
              const words    = wordGoalDays.includes(dateStr);
              const srsLocked = !review && srsLockedDays.includes(dateStr);
              const anyDone  = review || words || srsLocked;

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
                    boxShadow: isToday ? '0 0 14px #6366f180' : isSelected ? '0 0 8px #6366f150' : 'none',
                  }}
                >
                  {/* Bottom half: SRS review (indigo) or locked (gray) */}
                  {review    && <div className="absolute bottom-0 left-0 right-0" style={{ height: '50%', background: TASK_COLORS.review.bg }} />}
                  {srsLocked && <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-0.5" style={{ height: '50%', background: '#52525280' }}>
                    <span style={{ fontSize: 7, lineHeight: 1 }}>🔒</span>
                  </div>}
                  {/* Top half: words goal (green) */}
                  {words && <div className="absolute top-0 left-0 right-0" style={{ height: '50%', background: TASK_COLORS.words.bg }} />}
                  {/* Separator line when both halves have content */}
                  {(review || srsLocked) && words && (
                    <div className="absolute inset-x-0 z-10" style={{ top: '50%', height: 1, background: 'rgba(0,0,0,0.3)', transform: 'translateY(-0.5px)' }} />
                  )}
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
            <div className="w-3.5 h-3.5 rounded-full" style={{ background: TASK_COLORS.review.bg }} />
            <span className="text-[10px] text-[var(--text-muted)]">SRS review</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full" style={{ background: TASK_COLORS.words.bg }} />
            <span className="text-[10px] text-[var(--text-muted)]">{`${dailyGoal} words goal`}</span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] ml-auto">Tap a day for details</span>
        </div>
      </div>
      </div> {/* end left column */}

      {/* ── Right column: info + monthly summary ── */}
      <div className="space-y-4">

        {/* How days get marked */}
        <div className="rounded-2xl p-4 flex gap-3" style={{ background: 'var(--surface-2)' }}>
          <span className="text-xl shrink-0">💡</span>
          <div className="space-y-1.5">
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>How to mark a day</p>
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0 inline-block" style={{ background: TASK_COLORS.review.bg }} />
                Complete all due SRS reviews
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0 inline-block" style={{ background: TASK_COLORS.words.bg }} />
                Reach your self-set daily word goal
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Each task fills half the day circle. Complete both to fully mark a day.</p>
          </div>
        </div>

        {/* Monthly breakdown */}
        <MonthlyBreakdown history={history} onInfo={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const above = r.bottom > window.innerHeight * 0.6;
          setInfoModal({ ...INFO.monthly, x: r.left + r.width / 2, y: above ? r.top - 8 : r.bottom + 8, above });
        }} />

      </div> {/* end right column */}

      {/* Bottom sheet — outside grid */}
      {/* Info tooltip */}
      {infoModal && (
        <>
          <div className="fixed inset-0 z-[59]" onClick={() => setInfoModal(null)} />
          <div className="fixed z-[60] w-52 rounded-xl overflow-hidden"
            style={{
              left: Math.min(Math.max(infoModal.x - 104, 8), (typeof window !== 'undefined' ? window.innerWidth : 800) - 216),
              top: infoModal.above ? undefined : infoModal.y,
              bottom: infoModal.above ? (typeof window !== 'undefined' ? window.innerHeight - infoModal.y : undefined) : undefined,
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              background: 'rgba(18, 12, 38, 0.88)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="h-0.5" style={{ background: infoModal.color }} />
            <div className="p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span style={{ fontSize: 13, lineHeight: 1 }}>{infoModal.emoji}</span>
                <p className="font-bold text-[11px]" style={{ color: '#fff' }}>{infoModal.title}</p>
              </div>
              <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{infoModal.body}</p>
              <button onClick={() => setInfoModal(null)}
                className="mt-2.5 w-full py-1.5 rounded-lg text-[10px] font-bold text-white"
                style={{ background: infoModal.color }}>
                Got it
              </button>
            </div>
          </div>
        </>
      )}

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
            <div className="px-4 pt-2 pb-8">
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

              {/* Task cards */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                {([
                  { key: 'review', label: 'SRS Review',                done: sheetTasks.review, href: '/srs',   btnLabel: 'Go to Review', color: TASK_COLORS.review.bg, nothingDue: sheetIsToday && dueCount === 0 && !sheetTasks.review },
                  { key: 'words',  label: `Words (${dailyGoal} goal)`, done: sheetTasks.words,  href: '/learn', btnLabel: 'Learn Words',  color: TASK_COLORS.words.bg },
                ] as const).map(task => (
                  <div key={task.key} className="rounded-2xl p-4 flex flex-col gap-3"
                    style={{ background: 'var(--surface-2)', border: `1px solid ${task.color}33` }}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: task.done ? task.color : 'var(--border)', boxShadow: task.done ? `0 0 8px ${task.color}80` : 'none' }}>
                        <span className="text-[11px] font-black text-white">{task.done ? '✓' : ''}</span>
                      </div>
                      <span className="text-sm font-bold leading-tight" style={{ color: 'var(--text)' }}>{task.label}</span>
                    </div>
                    {('nothingDue' in task && task.nothingDue) ? (
                      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Nothing due</span>
                    ) : sheetIsToday && !task.done ? (
                      <Link href={task.href} onClick={() => setSelectedDay(null)}
                        className="text-xs font-bold px-3 py-2 rounded-xl text-white text-center"
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

              {/* Two mini-calendars */}
              <div className="grid grid-cols-2 gap-3">
                <MiniCalendar title="SRS"                    color={TASK_COLORS.review.bg} days={reviewDays}   year={viewYear} month={viewMonth} lockedDays={srsLockedDays} />
                <MiniCalendar title={`Words (${dailyGoal})`} color={TASK_COLORS.words.bg}  days={wordGoalDays} year={viewYear} month={viewMonth} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MonthlyBreakdown({ history, onInfo }: { history: Record<string, number>; onInfo?: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
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
      <div className="flex items-center gap-1.5 mb-3">
        <h3 className="font-semibold text-sm">{t.progress.monthlySummary}</h3>
        {onInfo && (
          <button onClick={onInfo}
            className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'var(--border)', color: 'var(--text-muted)', fontSize: 9, fontWeight: 700 }}>
            i
          </button>
        )}
      </div>
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

