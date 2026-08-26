'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { useAppStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { getWordOfDay } from '@/lib/data';
import { getStreak, getXP, getTodayXP, getTodayLearnedCount, getDueWords, getLearnedWords, getSettings, isOnboarded, setOnboarded, getFreezes, checkAndGrantWeeklyFreeze, getLastStudyDate, localDateStr, addDaysToDateStr, displayXP } from '@/lib/storage';
import { pullAll } from '@/lib/sync';
import { useAuth } from '@/lib/auth-context';
import { getLevelInfo } from '@/lib/gamification';
import { speak } from '@/lib/speech';
import { getTheme, toggleTheme, type Theme } from '@/lib/theme';
import type { WordItem, UserSettings } from '@/lib/types';
import XpModal from '@/components/XpModal';
import DailyGoalModal from '@/components/DailyGoalModal';
import { supabase } from '@/lib/supabase';
import { APK_DOWNLOAD_URL } from '@/lib/constants';
import { HUB_CATEGORIES } from '@/lib/hubCategories';

type HomeClassSummary = {
  classId: string; className: string; isTeacher: boolean;
  studentCount: number; activeToday: number;
  classXP: number; classStreak: number; pendingHomework: number;
};

const CLASS_GRADIENTS = [
  { bg: 'linear-gradient(135deg, #7c3aed, #a78bfa)', edge: '#4c1d95', glow: 'rgba(124,58,237,0.4)' },
  { bg: 'linear-gradient(135deg, #0e7490, #22d3ee)', edge: '#164e63', glow: 'rgba(14,116,144,0.4)' },
  { bg: 'linear-gradient(135deg, #b45309, #fbbf24)', edge: '#78350f', glow: 'rgba(180,83,9,0.4)'  },
  { bg: 'linear-gradient(135deg, #be123c, #fb7185)', edge: '#881337', glow: 'rgba(190,18,60,0.4)'  },
  { bg: 'linear-gradient(135deg, #1a9a50, #2ECC71)', edge: '#0f6634', glow: 'rgba(46,204,113,0.4)' },
  { bg: 'linear-gradient(135deg, #ec4899, #f472b6)', edge: '#9d174d', glow: 'rgba(236,72,153,0.4)' },
  { bg: 'linear-gradient(135deg, #d97706, #fcd34d)', edge: '#92400e', glow: 'rgba(217,119,6,0.4)'  },
  { bg: 'linear-gradient(135deg, #0284c7, #38bdf8)', edge: '#0369a1', glow: 'rgba(2,132,199,0.4)'  },
];
function classGradient(classId: string) {
  const hash = classId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return CLASS_GRADIENTS[hash % CLASS_GRADIENTS.length];
}

function computeClassStreak(datesDesc: string[]): number {
  if (!datesDesc.length) return 0;
  const set = new Set(datesDesc);
  const today = localDateStr();
  const yesterday = addDaysToDateStr(today, -1);
  if (!set.has(today) && !set.has(yesterday)) return 0;
  let streak = 0;
  let cur = set.has(today) ? today : yesterday;
  while (set.has(cur)) { streak++; cur = addDaysToDateStr(cur, -1); }
  return streak;
}

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { collections, collectionsLoaded } = useAppStore(
    useShallow(s => ({ collections: s.collections, collectionsLoaded: s.collectionsLoaded }))
  );
  const [wod, setWod] = useState<WordItem | null>(null);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [todayXp, setTodayXp] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [learnedCount, setLearnedCount] = useState(0);
  const [settings, setSettings] = useState<UserSettings>({ name: 'Learner', dailyGoal: 10, languageLevel: 'B1', defaultAccent: 'us', autoPlayOnReveal: true, sessionSize: 20, fontSize: 'normal', studyOrder: 'random', quizDirection: 'word-to-uz', reduceMotion: false, uiLanguage: 'en', showOnLeaderboard: true, pulseEnabled: true, pulseSpeed: 'normal' });
  const [freezes, setFreezes] = useState(0);
  const [streakRisk, setStreakRisk] = useState<'safe' | 'at-risk' | 'freeze-saves'>('safe');
  const [wodRevealed, setWodRevealed] = useState(false);
  const [theme, setThemeState] = useState<Theme>('light');
  const [showXpModal, setShowXpModal] = useState(false);
  const [showDailyGoalModal, setShowDailyGoalModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showReviewBanner, setShowReviewBanner] = useState(true);
  const [homeClasses, setHomeClasses] = useState<HomeClassSummary[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!isOnboarded()) {
      if (user) {
        setOnboarded(); // already has an account — skip onboarding on new device
      } else {
        router.replace('/onboarding');
        return;
      }
    }
    checkAndGrantWeeklyFreeze();
    const currentStreak = getStreak();
    const currentFreezes = getFreezes();
    setStreak(currentStreak);
    setFreezes(currentFreezes);

    if (currentStreak > 0) {
      const today = localDateStr();
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yStr = localDateStr(yesterday);
      const twoDaysAgo = new Date(); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const tdStr = localDateStr(twoDaysAgo);
      const last = getLastStudyDate();
      if (last === today) {
        setStreakRisk('safe');
      } else if (last === tdStr) {
        setStreakRisk(currentFreezes > 0 ? 'freeze-saves' : 'at-risk');
      } else if (last === yStr) {
        setStreakRisk('safe');
      } else {
        setStreakRisk('at-risk');
      }
    }
    setXp(getXP());
    setTodayXp(getTodayXP());
    setTodayCount(getTodayLearnedCount());
    setDueCount(getDueWords().length);
    setLearnedCount(getLearnedWords().length);
    setSettings(getSettings());
    setThemeState(getTheme());
    if (!localStorage.getItem('android_banner_seen')) {
      localStorage.setItem('android_banner_seen', '1');
      setShowBanner(true);
    }

    const refreshState = () => {
      setXp(getXP());
      setStreak(getStreak());
      setFreezes(getFreezes());
      setTodayXp(getTodayXP());
      setTodayCount(getTodayLearnedCount());
      setDueCount(getDueWords().length);
      setLearnedCount(getLearnedWords().length);
      setSettings(getSettings());
    };
    pullAll().then(refreshState).catch(refreshState);
  }, [router, user, authLoading]);

  useEffect(() => {
    if (collectionsLoaded && collections.length > 0) {
      setWod(getWordOfDay(collections));
    }
  }, [collectionsLoaded, collections]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [{ data: taught }, { data: memberships }] = await Promise.all([
          supabase.from('classes').select('id, name').eq('teacher_id', user.id),
          supabase.from('class_members').select('class_id, class_xp').eq('student_id', user.id),
        ]);
        const taughtIds = new Set((taught ?? []).map((c: { id: string }) => c.id));
        const cards: HomeClassSummary[] = [];

        if (taught && taught.length > 0) {
          const taughtList = taught.map((c: { id: string }) => c.id);
          const today = localDateStr();
          const [{ data: memberRows }, { data: activeTodayRows }] = await Promise.all([
            supabase.from('class_members').select('class_id').in('class_id', taughtList),
            supabase.from('class_study_days').select('class_id').in('class_id', taughtList).eq('study_date', today),
          ]);
          const memberCount: Record<string, number> = {};
          for (const r of memberRows ?? []) memberCount[r.class_id] = (memberCount[r.class_id] ?? 0) + 1;
          const activeCount: Record<string, number> = {};
          for (const r of activeTodayRows ?? []) activeCount[r.class_id] = (activeCount[r.class_id] ?? 0) + 1;
          for (const c of taught) {
            cards.push({ classId: c.id, className: c.name, isTeacher: true,
              studentCount: memberCount[c.id] ?? 0, activeToday: activeCount[c.id] ?? 0,
              classXP: 0, classStreak: 0, pendingHomework: 0 });
          }
        }

        const studentMemberships = (memberships ?? []).filter((m: { class_id: string }) => !taughtIds.has(m.class_id));
        if (studentMemberships.length > 0) {
          const studentClassIds = studentMemberships.map((m: { class_id: string }) => m.class_id);
          const xpMap: Record<string, number> = {};
          for (const m of studentMemberships) xpMap[m.class_id] = m.class_xp ?? 0;
          const [{ data: classNames }, { data: studyDays }, { data: pendingHw }] = await Promise.all([
            supabase.from('classes').select('id, name').in('id', studentClassIds),
            supabase.from('class_study_days').select('class_id, study_date')
              .eq('student_id', user.id).in('class_id', studentClassIds)
              .order('study_date', { ascending: false }).limit(60),
            supabase.from('class_targets').select('class_id')
              .eq('student_id', user.id).in('class_id', studentClassIds).is('completed_at', null),
          ]);
          const daysByClass: Record<string, string[]> = {};
          for (const r of studyDays ?? []) {
            if (!daysByClass[r.class_id]) daysByClass[r.class_id] = [];
            daysByClass[r.class_id].push(r.study_date);
          }
          const pendingByClass: Record<string, number> = {};
          for (const r of pendingHw ?? []) pendingByClass[r.class_id] = (pendingByClass[r.class_id] ?? 0) + 1;
          for (const c of classNames ?? []) {
            cards.push({ classId: c.id, className: c.name, isTeacher: false,
              studentCount: 0, activeToday: 0,
              classXP: xpMap[c.id] ?? 0,
              classStreak: computeClassStreak(daysByClass[c.id] ?? []),
              pendingHomework: pendingByClass[c.id] ?? 0 });
          }
        }
        setHomeClasses(cards);
      } catch {
        // best-effort — leave whatever class cards were already loaded
      }
    })();
  }, [user]);

  const t = useTranslation();
  const levelInfo = getLevelInfo(xp);
  const dailyProgress = Math.min((todayCount / settings.dailyGoal) * 100, 100);
  const pulseClass = (settings.pulseEnabled ?? true) ? `animate-heartbeat-${settings.pulseSpeed ?? 'normal'}` : '';

  return (
    <div className="p-4 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Hi, {settings.name}! 👋</h1>
          <p className="text-sm text-[var(--text-muted)]">{t.home.readyToLearn}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { const next = toggleTheme(); setThemeState(next); }}
            className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg hover:bg-[var(--primary-bg)] transition-colors"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link href="/settings" className="w-10 h-10 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-lg">
            ⚙️
          </Link>
        </div>
      </div>

      {/* ── Download banner (shown once) ── */}
      {showBanner && (
        <a
          href={APK_DOWNLOAD_URL}
          download
          className="flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors"
          style={{ background: 'rgba(61,220,132,0.08)', borderColor: 'rgba(61,220,132,0.35)' }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: 'rgba(61,220,132,0.15)' }}>
            🤖
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm" style={{ color: '#3DDC84' }}>{t.home.downloadApp}</div>
            <div className="text-xs mt-0.5 text-[var(--text-muted)]">{t.home.downloadSub}</div>
          </div>
          <span className="text-sm font-bold flex-shrink-0" style={{ color: '#3DDC84' }}>↓</span>
        </a>
      )}

      {/* ── Review reminder banner ── */}
      {dueCount > 0 && showReviewBanner && (
        <div className="relative overflow-hidden rounded-2xl p-[18px]"
          style={{
            background: 'linear-gradient(135deg, #FB923C, #F97316, #C2410C)',
            boxShadow: '0 4px 0 #7C2D12, 0 8px 18px rgba(249,115,22,0.35)',
          }}>
          {/* watermark */}
          <div className="absolute -right-2 -bottom-4 text-[80px] leading-none pointer-events-none select-none"
            style={{ opacity: 0.1 }}>🔔</div>
          {/* eyebrow + skip */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black tracking-[1.2px] text-white">{t.home.reviewDueBadge}</span>
            <button onClick={() => setShowReviewBanner(false)}
              className="text-xs font-semibold transition-opacity hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.75)' }}>
              {t.home.reviewDueSkip}
            </button>
          </div>
          {/* title */}
          <div className="text-[18px] font-black text-white leading-tight">
            {t.home.reviewDueTitle(dueCount)}
          </div>
          {/* subtitle */}
          <div className="text-xs mt-1 leading-[1.4]" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {t.home.reviewDueSubtitle}
          </div>
          {/* CTA */}
          <Link href="/srs"
            className="mt-3.5 flex items-center justify-center w-full py-3 rounded-xl font-black text-[15px] text-white transition-opacity hover:opacity-90"
            style={{ background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.4)' }}>
            Start Reviews 🧠
          </Link>
        </div>
      )}

      {showXpModal && <XpModal xp={xp} onClose={() => setShowXpModal(false)} />}
      {showDailyGoalModal && (
        <DailyGoalModal
          settings={settings}
          todayCount={todayCount}
          onSave={goal => setSettings(s => ({ ...s, dailyGoal: goal }))}
          onClose={() => setShowDailyGoalModal(false)}
        />
      )}

      {/* ── Today ── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1">{t.hub.today}</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <Link href="/progress?tab=calendar" className="block">
            <div className={`rounded-2xl p-4 h-full flex flex-col items-center justify-center text-center gap-2 hover:-translate-y-1 transition-all duration-200 ${pulseClass}`}
              style={{ background: 'linear-gradient(135deg, #FF6B35, #ff9f7f)', boxShadow: '0 10px 0 #b84a1a, 0 18px 40px rgba(255,107,53,0.55)', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
              <div className="text-3xl">🔥</div>
              <div className="text-xl font-black text-white">{streak}</div>
              <div className="text-xs text-white/85 font-semibold">{t.home.dayStreak}</div>
            </div>
          </Link>

          <button onClick={() => setShowXpModal(true)} className="block w-full h-full text-left">
            <StatCard icon="⚡" value={displayXP(xp)} label={t.home.totalXp}
              gradient="linear-gradient(135deg, #a78bfa, #6C63FF, #4C1D95)" edge="#3D1F9E" glowColor="rgba(108,99,255,0.4)" pulseClass={pulseClass} />
          </button>

          <Link href="/progress" className="block h-full">
            <StatCard icon="📚" value={learnedCount} label={t.home.words}
              gradient="linear-gradient(135deg, #0284c7, #38bdf8)" edge="#0369a1" glowColor="rgba(2,132,199,0.4)" pulseClass={pulseClass} />
          </Link>

          <button onClick={() => setShowDailyGoalModal(true)} className="block w-full h-full text-left">
            <div className={`rounded-2xl p-4 h-full flex flex-col justify-center gap-3 hover:-translate-y-1 transition-all duration-200 ${pulseClass}`}
              style={{ background: 'linear-gradient(135deg, #5b21b6, #8b5cf6)', boxShadow: '0 10px 0 #3b0764, 0 18px 40px rgba(91,33,182,0.5)' }}>
              <div className="relative self-center" style={{ width: 42, height: 42 }}>
                <svg width="42" height="42" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="21" cy="21" r="17" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
                  <circle cx="21" cy="21" r="17" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${Math.min(dailyProgress, 100) / 100 * 106.8} 106.8`}
                    style={{ transition: 'stroke-dasharray 0.5s ease' }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-black text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{dailyProgress >= 100 ? '✓' : todayCount}</span>
                </div>
              </div>
              <div className="text-center" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                <div className="text-xs font-black text-white">{todayCount} / {settings.dailyGoal}</div>
                <div className="text-[10px] text-white/75">{t.home.dailyGoal}</div>
              </div>
            </div>
          </button>

          <Link href="/progress" className="block h-full">
            <div className={`rounded-2xl p-4 h-full flex flex-col items-center justify-center text-center gap-1 ${pulseClass}`}
              style={{ background: 'linear-gradient(135deg, #be123c, #fb7185)', boxShadow: '0 10px 0 #881337, 0 18px 40px rgba(190,18,60,0.5)', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
              <div className="text-2xl mb-1">⭐</div>
              <div className="text-sm font-black text-white leading-tight">{levelInfo.level}</div>
              <div className="text-xs text-white/75 mt-0.5">{displayXP(xp)} XP</div>
            </div>
          </Link>

          {wod ? (
            <div className={`rounded-2xl p-4 h-full flex flex-col justify-between ${pulseClass}`}
              style={{ background: 'linear-gradient(135deg, #a21caf, #e879f9)', boxShadow: '0 10px 0 #701a75, 0 18px 40px rgba(162,28,175,0.5)', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-bold text-white/60 uppercase tracking-wider mb-1">{t.home.wordOfDay}</div>
                  <div className="text-sm font-black text-white leading-tight">{wod.word}</div>
                </div>
                <button onClick={() => speak(wod.word)}
                  className="shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs hover:bg-white/30 transition-colors"
                  style={{ textShadow: 'none' }} aria-label="Pronounce">🔊</button>
              </div>
              {wodRevealed ? (
                <p className="text-[10px] text-white/85 leading-snug mt-1 line-clamp-2">{wod.definition}</p>
              ) : (
                <button onClick={() => setWodRevealed(true)}
                  className="mt-1 text-[10px] font-semibold text-white bg-white/20 hover:bg-white/30 rounded-xl px-2 py-1 transition-colors self-start"
                  style={{ textShadow: 'none' }}>{t.home.showDefinition}</button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl h-full animate-pulse" style={{ background: 'rgba(162,28,175,0.2)', minHeight: 92 }} />
          )}
        </div>
      </div>

      {/* ── Explore ── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1">{t.hub.explore}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {HUB_CATEGORIES.map(cat => {
            const label = t.hub.categories[cat.key as keyof typeof t.hub.categories];
            return (
              <Link key={cat.key} href={`/hub/${cat.key}`} className="block">
                <div className="rounded-2xl h-full min-h-[128px] p-4 flex flex-col justify-between hover:-translate-y-1 transition-all duration-200"
                  style={{ background: cat.gradient, boxShadow: `0 10px 0 ${cat.edge}, 0 18px 40px ${cat.glow}`, textShadow: '0 1px 3px rgba(0,0,0,0.35)' }}>
                  <span className="text-2xl">{cat.icon}</span>
                  <div>
                    <div className="font-black text-sm text-white leading-tight">{label.title}</div>
                    <div className="text-[10px] text-white/70 mt-0.5">{label.sub}</div>
                  </div>
                  <span className="text-[10px] font-mono text-white/60 self-end">{cat.items.length} →</span>
                </div>
              </Link>
            );
          })}

          <Link href="/classes" className="block">
            <div className="rounded-2xl h-full min-h-[128px] p-4 flex flex-col justify-between hover:-translate-y-1 transition-all duration-200"
              style={{ background: 'linear-gradient(135deg, #0284c7, #38bdf8)', boxShadow: '0 10px 0 #0369a1, 0 18px 40px rgba(2,132,199,0.4)', textShadow: '0 1px 3px rgba(0,0,0,0.35)' }}>
              <span className="text-2xl">👩‍🏫</span>
              <div>
                <div className="font-black text-sm text-white leading-tight">{t.home.classesTitle}</div>
                <div className="text-[10px] text-white/70 mt-0.5">{t.home.classesSub}</div>
              </div>
              <span className="text-[10px] font-mono text-white/60 self-end">{homeClasses.length > 0 ? `${homeClasses.length} →` : '→'}</span>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Classes ── */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2 px-1">{t.hub.yourClasses}</h2>
        {homeClasses.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {homeClasses.map(card => {
              const { bg, edge, glow } = classGradient(card.classId);
              return (
                <div key={card.classId} className="relative">
                  {card.pendingHomework > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] rounded-full bg-white text-[var(--danger)] text-[10px] flex items-center justify-center font-black z-10 shadow px-1">
                      {card.pendingHomework}
                    </div>
                  )}
                  <Link href={`/classes/${card.classId}/home`} className="block h-full">
                    <div className={`rounded-2xl h-full min-h-[104px] p-3 flex flex-col justify-between hover:-translate-y-1 transition-all duration-200 ${pulseClass}`}
                      style={{ background: bg, boxShadow: `0 10px 0 ${edge}, 0 18px 40px ${glow}`, textShadow: '0 1px 3px rgba(0,0,0,0.35)' }}>
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-black text-white leading-tight truncate">{card.className}</div>
                          <div className="text-[10px] text-white/70 mt-1">
                            {card.isTeacher ? `👨‍🎓 ${card.studentCount} students` : `⚡ ${displayXP(card.classXP)} XP`}
                          </div>
                        </div>
                        <span className="text-lg opacity-80 shrink-0">{card.isTeacher ? '🏫' : '🎓'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold bg-white/20 text-white rounded-full px-2 py-0.5">
                          {card.isTeacher ? 'Teacher' : 'Student'}
                        </span>
                        {!card.isTeacher && card.classStreak > 0 && (
                          <span className="text-[10px] text-white/70">🔥 {card.classStreak}d</span>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <Link href="/classes" className="flex items-center justify-between px-4 py-3.5 rounded-2xl border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
            <span className="text-sm font-semibold">{t.hub.joinClass}</span>
            <span className="text-lg">👩‍🏫</span>
          </Link>
        )}
      </div>

      <div className="pb-4" />
    </div>
  );
}

function StatCard({ icon, value, label, gradient, edge, glowColor, pulseClass = '' }: {
  icon: string; value: number | string; label: string;
  gradient: string; edge: string; glowColor: string; pulseClass?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-4 flex flex-col items-center text-center gap-1 transition-all duration-200 hover:-translate-y-1 w-full h-full ${pulseClass}`}
      style={{
        background: gradient,
        boxShadow: `0 10px 0 ${edge}, 0 18px 40px ${glowColor}`,
        textShadow: '0 1px 3px rgba(0,0,0,0.35)',
      }}
    >
      <div className="text-3xl">{icon}</div>
      <div className="text-xl font-black text-white">{value}</div>
      <div className="text-xs text-white/80 font-medium">{label}</div>
    </div>
  );
}
