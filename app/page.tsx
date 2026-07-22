'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { useAppStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { getWordOfDay } from '@/lib/data';
import { getStreak, getXP, getTodayXP, getTodayLearnedCount, getDueWords, getLearnedWords, getSettings, isOnboarded, getFreezes, checkAndGrantWeeklyFreeze, getImportedWords, getLastStudyDate, localDateStr } from '@/lib/storage';
import { getLevelInfo } from '@/lib/gamification';
import { speak } from '@/lib/speech';
import { getTheme, toggleTheme, type Theme } from '@/lib/theme';
import type { WordItem, UserSettings } from '@/lib/types';
import XpModal from '@/components/XpModal';
import TiltCard from '@/components/TiltCard';

const COLLECTION_META: Record<string, { icon: string; color: string; desc: string }> = {
  '30 Days of Powerful Words': { icon: '🏆', color: 'var(--primary)', desc: 'Essential IELTS vocabulary by topic' },
  '24 Vocabulary Challenge':   { icon: '💡', color: '#FF6584', desc: 'Idioms and phrases for fluent speakers' },
  'Word Mastery':              { icon: '🎯', color: '#2ECC71', desc: 'High-level C1 & B2 collocations' },
};

const LEVELED_NAMES = new Set(['A1', 'A2', 'B1', 'Advanced']);

export default function HomePage() {
  const router = useRouter();
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
  const [settings, setSettings] = useState<UserSettings>({ name: 'Learner', dailyGoal: 10, languageLevel: 'B1', defaultAccent: 'us', autoPlayOnReveal: true, sessionSize: 20, fontSize: 'normal', studyOrder: 'random', quizDirection: 'word-to-uz', reduceMotion: false, uiLanguage: 'en', showOnLeaderboard: true });
  const [freezes, setFreezes] = useState(0);
  const [streakRisk, setStreakRisk] = useState<'safe' | 'at-risk' | 'freeze-saves'>('safe');
  const [importedCount, setImportedCount] = useState(0);
  const [wodRevealed, setWodRevealed] = useState(false);
  const [theme, setThemeState] = useState<Theme>('light');
  const [showXpModal, setShowXpModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showReviewBanner, setShowReviewBanner] = useState(true);

  useEffect(() => {
    if (!isOnboarded()) { router.replace('/onboarding'); return; }
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
    setImportedCount(getImportedWords().length);
    if (!localStorage.getItem('android_banner_seen')) {
      localStorage.setItem('android_banner_seen', '1');
      setShowBanner(true);
    }
  }, [router]);

  useEffect(() => {
    if (collectionsLoaded && collections.length > 0) {
      setWod(getWordOfDay(collections));
    }
  }, [collectionsLoaded, collections]);

  useEffect(() => {
    const handleSync = () => {
      setStreak(getStreak());
      setXp(getXP());
      setTodayXp(getTodayXP());
      setTodayCount(getTodayLearnedCount());
      setDueCount(getDueWords().length);
      setLearnedCount(getLearnedWords().length);
      setSettings(getSettings());
    };
    window.addEventListener('lexivo-sync', handleSync);
    return () => window.removeEventListener('lexivo-sync', handleSync);
  }, []);

  const t = useTranslation();
  const levelInfo = getLevelInfo(xp);
  const dailyProgress = Math.min((todayCount / settings.dailyGoal) * 100, 100);
  const mainCollections = collections.filter(c => !LEVELED_NAMES.has(c.name));

  return (
    <div className="p-4 space-y-5 animate-fade-in">
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
          href="https://github.com/axmedovshahzodbek21-crypto/lexivo-web/releases/latest/download/app-release.apk"
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
        <div className="flex items-center gap-4 p-4 rounded-2xl border-2"
          style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.35)' }}>
          <Link href="/srs" className="flex items-center gap-4 flex-1 min-w-0 hover:opacity-90 transition-opacity">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: 'rgba(239,68,68,0.15)' }}>🔔</div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm" style={{ color: 'var(--danger)' }}>
                {dueCount} {dueCount === 1 ? 'word' : 'words'} due for review!
              </div>
              <div className="text-xs mt-0.5 text-[var(--text-muted)]">Complete your reviews for best results.</div>
            </div>
            <span className="text-sm font-bold flex-shrink-0 mr-1" style={{ color: 'var(--danger)' }}>→</span>
          </Link>
          <button
            onClick={() => setShowReviewBanner(false)}
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stats bento — desktop: Day Streak big center, 4 smaller on sides */}
      <div className="hidden sm:grid gap-3" style={{ gridTemplateColumns: '1fr 1.5fr 1fr' }}>
        {/* Left top: Collections */}
        <Link href="/collections" style={{ gridColumn: 1, gridRow: 1 }} className="block">
          <StatCard icon="🗂️" value={mainCollections.length + 2} label={t.home.collections}
            gradient="linear-gradient(135deg, #d97706, #fbbf24)" edge="#92400e" glowColor="rgba(217,119,6,0.4)" />
        </Link>
        {/* Center: Day Streak big */}
        <Link href="/progress?tab=calendar" style={{ gridColumn: 2, gridRow: '1 / 3' }} className="block">
          <div
            className="rounded-2xl px-8 py-10 flex flex-col items-center justify-center text-center gap-4 transition-all duration-200 hover:-translate-y-2 h-full"
            style={{
              background: 'linear-gradient(135deg, #FF6B35, #ff9f7f)',
              boxShadow: '0 10px 0 #b84a1a, 0 16px 36px rgba(255,107,53,0.45)',
              textShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }}
          >
            <div className="text-7xl">🔥</div>
            <div className="text-6xl font-black text-white leading-none">{streak}</div>
            <div className="text-base text-white/85 font-semibold">{t.home.dayStreak}</div>
          </div>
        </Link>
        {/* Right top: Total XP */}
        <button onClick={() => setShowXpModal(true)} style={{ gridColumn: 3, gridRow: 1 }} className="text-left w-full">
          <StatCard icon="⚡" value={xp} label={t.home.totalXp}
            gradient="linear-gradient(135deg, #6c63ff, #a78bfa)" edge="#3f38cc" glowColor="rgba(108,99,255,0.4)" />
        </button>
        {/* Left bottom: Reading */}
        <Link href="/reading" style={{ gridColumn: 1, gridRow: 2 }} className="block">
          <StatCard icon="📰" value="→" label="Reading"
            gradient="linear-gradient(135deg, #7c3aed, #a855f7)" edge="#4c1d95" glowColor="rgba(124,58,237,0.4)" />
        </Link>
        {/* Right bottom: Words */}
        <Link href="/progress" style={{ gridColumn: 3, gridRow: 2 }} className="block">
          <StatCard icon="📚" value={learnedCount} label={t.home.words}
            gradient="linear-gradient(135deg, #0284c7, #38bdf8)" edge="#0369a1" glowColor="rgba(2,132,199,0.4)" />
        </Link>
      </div>

      {/* Stats — mobile: simple 3-col */}
      <div className="grid sm:hidden grid-cols-3 gap-3">
        <Link href="/progress?tab=calendar">
          <StatCard icon="🔥" value={streak} label={t.home.dayStreak}
            gradient="linear-gradient(135deg, #FF6B35, #ff9f7f)" edge="#b84a1a" glowColor="rgba(255,107,53,0.4)" />
        </Link>
        <button onClick={() => setShowXpModal(true)} className="text-left w-full">
          <StatCard icon="⚡" value={xp} label={t.home.totalXp}
            gradient="linear-gradient(135deg, #6c63ff, #a78bfa)" edge="#3f38cc" glowColor="rgba(108,99,255,0.4)" />
        </button>
        <Link href="/progress">
          <StatCard icon="📚" value={learnedCount} label={t.home.words}
            gradient="linear-gradient(135deg, #0284c7, #38bdf8)" edge="#0369a1" glowColor="rgba(2,132,199,0.4)" />
        </Link>
      </div>

      {showXpModal && <XpModal xp={xp} onClose={() => setShowXpModal(false)} />}

      {/* Daily goal — prominent */}
      <TiltCard className="card" intensity={3}>
        <div className="flex items-center gap-4">
          {/* Ring */}
          <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
            <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="32" cy="32" r="26" fill="none" stroke="var(--border)" strokeWidth="6" />
              <circle
                cx="32" cy="32" r="26" fill="none"
                stroke={dailyProgress >= 100 ? 'var(--success)' : 'var(--primary)'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${Math.min(dailyProgress, 100) / 100 * 163.4} 163.4`}
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-black" style={{ color: dailyProgress >= 100 ? 'var(--success)' : 'var(--primary)' }}>
                {dailyProgress >= 100 ? '✓' : todayCount}
              </span>
            </div>
          </div>
          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-[var(--text)]">{todayCount}</span>
              <span className="text-sm text-[var(--text-muted)] font-medium">/ {settings.dailyGoal} {t.home.dailyGoal.toLowerCase()}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(dailyProgress, 100)}%`, background: dailyProgress >= 100 ? 'var(--success)' : 'var(--primary)' }}
              />
            </div>
            <p className="text-xs mt-1" style={{ color: dailyProgress >= 100 ? 'var(--success)' : 'var(--text-muted)' }}>
              {dailyProgress >= 100 ? `${t.home.goalReached} · ${todayXp} XP today` : `${todayXp} XP today · ${Math.max(0, settings.dailyGoal - todayCount)} words to go`}
            </p>
          </div>
        </div>
      </TiltCard>

      {/* Streak at risk warning */}
      {streakRisk === 'freeze-saves' && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium"
          style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)', color: '#B45309' }}>
          <span className="text-base">⚠️</span>
          <span>Study today — a 🧊 freeze will protect your {streak}-day streak!</span>
        </div>
      )}
      {streakRisk === 'at-risk' && streak > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#DC2626' }}>
          <span className="text-base">🔥</span>
          <span>Your {streak}-day streak is at risk! Study something today.</span>
        </div>
      )}

      {/* Streak freeze indicator */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium"
        style={{
          background: freezes > 0 ? 'rgba(99,179,237,0.12)' : 'rgba(148,163,184,0.08)',
          border: `1px solid ${freezes > 0 ? 'rgba(99,179,237,0.35)' : 'rgba(148,163,184,0.2)'}`,
          color: freezes > 0 ? '#3B82F6' : 'var(--text-muted)',
        }}
      >
        <span className="text-base">🧊</span>
        <span className="flex-1">
          {freezes === 0
            ? 'No streak freezes — earn one by studying 7 days in a row'
            : freezes === 1 ? t.home.freezeSingle : t.home.freezeMulti(freezes)}
        </span>
        {freezes > 0 && (
          <span className="text-xs opacity-60">auto-applies if you miss a day</span>
        )}
      </div>

      {/* Level progress */}
      <TiltCard className="card overflow-hidden hover:border-[var(--primary)] transition-colors cursor-pointer animate-glow-pulse" intensity={4}>
        <button onClick={() => setShowXpModal(true)} className="w-full text-left" style={{ margin: '-20px', padding: '20px' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-[var(--text)]">⭐ {levelInfo.level}</span>
            <span className="text-sm text-[var(--text-muted)]">{xp} XP {levelInfo.next && `→ ${levelInfo.next}`}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${levelInfo.progress}%` }} />
          </div>
          {levelInfo.next && (
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5 text-right">
              {levelInfo.xpToNext} XP to {levelInfo.next} · tap for details
            </p>
          )}
        </button>
      </TiltCard>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ActionCard href="/learn" icon="📖" title={t.home.learnTitle} subtitle={t.home.learnSub}
          gradient="linear-gradient(135deg, #6c63ff, #a78bfa)" edge="#3f38cc" glow="rgba(108,99,255,0.4)" />
        <ActionCard href="/flashcards" icon="🃏" title={t.home.flashcardsTitle} subtitle={t.home.flashcardsSub}
          gradient="linear-gradient(135deg, #FF6B35, #ff9f7f)" edge="#b84a1a" glow="rgba(255,107,53,0.4)" />
        <ActionCard href="/srs" icon="🔄" title={t.home.srsTitle}
          subtitle={dueCount > 0 ? t.home.srsDue(dueCount) : t.home.srsAllCaughtUp}
          gradient={dueCount > 0 ? 'linear-gradient(135deg, #ef4444, #f87171)' : 'linear-gradient(135deg, #1a9a50, #2ECC71)'}
          edge={dueCount > 0 ? '#b91c1c' : '#0f6634'}
          glow={dueCount > 0 ? 'rgba(239,68,68,0.4)' : 'rgba(46,204,113,0.4)'}
          badge={dueCount > 0 ? String(dueCount) : undefined} />
        <ActionCard href="/quiz" icon="❓" title={t.home.quizTitle} subtitle={t.home.quizSub}
          gradient="linear-gradient(135deg, #f59e0b, #fcd34d)" edge="#a16207" glow="rgba(245,158,11,0.4)" />
        <ActionCard href="/pronunciation" icon="🎙️" title={t.home.pronounceTitle} subtitle={t.home.pronounceSub}
          gradient="linear-gradient(135deg, #7c3aed, #a855f7)" edge="#4c1d95" glow="rgba(124,58,237,0.4)" />
        <ActionCard href="/matching" icon="🎯" title={t.home.matchTitle} subtitle={t.home.matchSub}
          gradient="linear-gradient(135deg, #ec4899, #f472b6)" edge="#9d174d" glow="rgba(236,72,153,0.4)" />
        <ActionCard href="/pomodoro" icon="🍅" title={t.home.pomodoroTitle} subtitle={t.home.pomodoroSub}
          gradient="linear-gradient(135deg, #dc2626, #ef4444)" edge="#991b1b" glow="rgba(220,38,38,0.4)" />
        <ActionCard href="/leaderboard" icon="🏆" title="Leaderboard" subtitle="See top learners"
          gradient="linear-gradient(135deg, #d97706, #fbbf24)" edge="#92400e" glow="rgba(217,119,6,0.4)" />
      </div>

      {/* Word of the Day */}
      {wod && (
        <TiltCard className="card" intensity={3}>
          <div className="flex items-center justify-between mb-3">
            <span className="badge">{t.home.wordOfDay}</span>
            <button
              onClick={() => speak(wod.word)}
              className="w-8 h-8 rounded-full bg-[var(--primary-bg)] flex items-center justify-center text-sm hover:bg-[var(--primary)] hover:text-white transition-colors"
              aria-label="Listen to pronunciation"
            >
              🔊
            </button>
          </div>
          <h2 className="text-2xl font-bold text-[var(--text)]">{wod.word}</h2>
          <p className="text-sm text-[var(--text-muted)] mb-1">{wod.partOfSpeech} · {wod.pronunciation}</p>
          <p className="text-base font-medium text-[var(--primary)]">{wod.translation}</p>
          {wodRevealed ? (
            <div className="mt-3 space-y-2 animate-fade-in">
              <p className="text-sm text-[var(--text)]">{wod.definition}</p>
              <div className="bg-[var(--primary-bg)] rounded-xl p-3">
                <p className="text-sm italic text-[var(--text)]">"{wod.example1}"</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setWodRevealed(true)}
              className="mt-3 text-sm text-[var(--primary)] font-medium hover:underline"
            >
              {t.home.showDefinition}
            </button>
          )}
        </TiltCard>
      )}

      {/* Shortcuts */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        <ShortcutCard href="/starred"      icon="⭐" label={t.home.starredTitle}  sub={t.home.starredSub}
          gradient="linear-gradient(135deg, #d97706, #f59e0b)" edge="#92400e" glow="rgba(217,119,6,0.35)" />
        <ShortcutCard href="/hard-words"   icon="😓" label={t.home.hardTitle}    sub={t.home.hardSub}
          gradient="linear-gradient(135deg, #dc2626, #ef4444)" edge="#991b1b" glow="rgba(220,38,38,0.35)" />
        <ShortcutCard href="/lists"        icon="📋" label={t.home.listsTitle}   sub={t.home.listsSub}
          gradient="linear-gradient(135deg, #7c3aed, #8b5cf6)" edge="#4c1d95" glow="rgba(124,58,237,0.35)" />
        <ShortcutCard href="/grammar-tips" icon="📚" label={t.home.grammarTitle} sub={t.home.grammarSub}
          gradient="linear-gradient(135deg, #1a9a50, #2ECC71)" edge="#0f6634" glow="rgba(46,204,113,0.35)" />
        <ShortcutCard href="/classes"      icon="👩‍🏫" label={t.home.classesTitle} sub={t.home.classesSub}
          gradient="linear-gradient(135deg, #0284c7, #38bdf8)" edge="#0369a1" glow="rgba(2,132,199,0.35)" />
      </div>

      <div className="pb-4" />
    </div>
  );
}

function StatCard({ icon, value, label, gradient, edge, glowColor }: {
  icon: string; value: number | string; label: string;
  gradient: string; edge: string; glowColor: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col items-center text-center gap-1 transition-all duration-200 hover:-translate-y-1 w-full h-full"
      style={{
        background: gradient,
        boxShadow: `0 7px 0 ${edge}, 0 10px 24px ${glowColor}`,
        textShadow: '0 1px 3px rgba(0,0,0,0.35)',
      }}
    >
      <div className="text-3xl">{icon}</div>
      <div className="text-xl font-black text-white">{value}</div>
      <div className="text-xs text-white/80 font-medium">{label}</div>
    </div>
  );
}

function ActionCard({
  href, icon, title, subtitle, gradient, edge, glow, badge,
}: {
  href: string; icon: string; title: string; subtitle: string;
  gradient: string; edge: string; glow: string; badge?: string;
}) {
  return (
    <Link href={href} className="block relative group">
      {badge && (
        <div className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] rounded-full bg-white text-[var(--danger)] text-[10px] flex items-center justify-center font-black z-10 shadow px-1">
          {parseInt(badge) > 9 ? '9+' : badge}
        </div>
      )}
      <div
        className="rounded-2xl p-5 flex flex-col items-center text-center gap-2 transition-all duration-200 group-hover:-translate-y-1.5 h-full"
        style={{
          background: gradient,
          boxShadow: `0 8px 0 ${edge}, 0 12px 28px ${glow}`,
          textShadow: '0 1px 3px rgba(0,0,0,0.35)',
        }}
      >
        <div className="text-4xl">{icon}</div>
        <div>
          <div className="font-bold text-white text-sm leading-tight">{title}</div>
          <div className="text-white/85 text-xs mt-0.5">{subtitle}</div>
        </div>
      </div>
    </Link>
  );
}

function ShortcutCard({ href, icon, label, sub, gradient, edge, glow }: {
  href: string; icon: string; label: string; sub: string;
  gradient: string; edge: string; glow: string;
}) {
  return (
    <Link href={href} className="block group">
      <div
        className="rounded-2xl p-4 flex flex-col items-center text-center gap-1.5 transition-all duration-200 group-hover:-translate-y-1"
        style={{
          background: gradient,
          boxShadow: `0 6px 0 ${edge}, 0 10px 20px ${glow}`,
          textShadow: '0 1px 3px rgba(0,0,0,0.35)',
        }}
      >
        <div className="text-3xl">{icon}</div>
        <div className="font-bold text-white text-xs leading-tight">{label}</div>
        <div className="text-white/80 text-[10px]">{sub}</div>
      </div>
    </Link>
  );
}
