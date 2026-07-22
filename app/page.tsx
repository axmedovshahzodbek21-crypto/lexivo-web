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
  const [hideStats, setHideStats] = useState(false);
  const [hideGoalLevel, setHideGoalLevel] = useState(false);
  const [hideWod, setHideWod] = useState(false);
  const [hideActions, setHideActions] = useState(false);
  const [hideShortcuts, setHideShortcuts] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [sectionOrder, setSectionOrder] = useState(['stats', 'goal', 'actions', 'shortcuts']);
  const [hideFlashcards, setHideFlashcards] = useState(false);
  const [hideQuiz, setHideQuiz] = useState(false);
  const [hideMatch, setHideMatch] = useState(false);
  const [hidePomodoro, setHidePomodoro] = useState(false);
  const [hideLeaderboard, setHideLeaderboard] = useState(false);
  const [hideStarred, setHideStarred] = useState(false);
  const [hideHardWords, setHideHardWords] = useState(false);
  const [hideLists, setHideLists] = useState(false);
  const [hideGrammar, setHideGrammar] = useState(false);
  const [hideClasses, setHideClasses] = useState(false);

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
    setHideStats(localStorage.getItem('home_hide_stats') === '1');
    setHideGoalLevel(localStorage.getItem('home_hide_goal_level') === '1');
    setHideWod(localStorage.getItem('home_hide_wod') === '1');
    setHideActions(localStorage.getItem('home_hide_actions') === '1');
    setHideShortcuts(localStorage.getItem('home_hide_shortcuts') === '1');
    const savedOrder = localStorage.getItem('home_section_order');
    setSectionOrder(savedOrder ? savedOrder.split(',') : ['stats', 'goal', 'actions', 'shortcuts']);
    setHideFlashcards(localStorage.getItem('home_hide_flashcards') === '1');
    setHideQuiz(localStorage.getItem('home_hide_quiz') === '1');
    setHideMatch(localStorage.getItem('home_hide_match') === '1');
    setHidePomodoro(localStorage.getItem('home_hide_pomodoro') === '1');
    setHideLeaderboard(localStorage.getItem('home_hide_leaderboard') === '1');
    setHideStarred(localStorage.getItem('home_hide_starred') === '1');
    setHideHardWords(localStorage.getItem('home_hide_hard_words') === '1');
    setHideLists(localStorage.getItem('home_hide_lists') === '1');
    setHideGrammar(localStorage.getItem('home_hide_grammar') === '1');
    setHideClasses(localStorage.getItem('home_hide_classes') === '1');
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
          <button
            onClick={() => setShowCustomize(true)}
            className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center hover:bg-[var(--primary-bg)] transition-colors text-[var(--text-muted)]"
            aria-label="Customize home"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="4" y1="12" x2="20" y2="12"/>
              <line x1="4" y1="18" x2="20" y2="18"/>
              <circle cx="9" cy="6" r="2.5" fill="currentColor" stroke="none"/>
              <circle cx="15" cy="12" r="2.5" fill="currentColor" stroke="none"/>
              <circle cx="9" cy="18" r="2.5" fill="currentColor" stroke="none"/>
            </svg>
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

      {showXpModal && <XpModal xp={xp} onClose={() => setShowXpModal(false)} />}

      {sectionOrder.map(sId => {
        if (sId === 'stats' && !hideStats) return (
          <div key="stats">
            {/* Stats bento — desktop */}
            <div className="hidden sm:grid gap-3" style={{ gridTemplateColumns: '1fr 1.5fr 1fr' }}>
              <Link href="/collections" style={{ gridColumn: 1, gridRow: 1 }} className="block">
                <StatCard icon="🗂️" value={mainCollections.length + 2} label={t.home.collections}
                  gradient="linear-gradient(135deg, #1d4ed8, #60a5fa)" edge="#1e3a8a" glowColor="rgba(29,78,216,0.4)" />
              </Link>
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
              <button onClick={() => setShowXpModal(true)} style={{ gridColumn: 3, gridRow: 1 }} className="text-left w-full">
                <StatCard icon="⚡" value={xp} label={t.home.totalXp}
                  gradient="linear-gradient(135deg, #d97706, #fbbf24)" edge="#92400e" glowColor="rgba(217,119,6,0.4)" />
              </button>
              <Link href="/reading" style={{ gridColumn: 1, gridRow: 2 }} className="block">
                <StatCard icon="📰" value="→" label="Reading"
                  gradient="linear-gradient(135deg, #047857, #34d399)" edge="#064e3b" glowColor="rgba(4,120,87,0.4)" />
              </Link>
              <Link href="/progress" style={{ gridColumn: 3, gridRow: 2 }} className="block">
                <StatCard icon="📚" value={learnedCount} label={t.home.words}
                  gradient="linear-gradient(135deg, #0284c7, #38bdf8)" edge="#0369a1" glowColor="rgba(2,132,199,0.4)" />
              </Link>
            </div>
            {/* Stats — mobile */}
            <div className="grid sm:hidden grid-cols-3 gap-3">
              <Link href="/progress?tab=calendar">
                <StatCard icon="🔥" value={streak} label={t.home.dayStreak}
                  gradient="linear-gradient(135deg, #FF6B35, #ff9f7f)" edge="#b84a1a" glowColor="rgba(255,107,53,0.4)" />
              </Link>
              <button onClick={() => setShowXpModal(true)} className="text-left w-full">
                <StatCard icon="⚡" value={xp} label={t.home.totalXp}
                  gradient="linear-gradient(135deg, #d97706, #fbbf24)" edge="#92400e" glowColor="rgba(217,119,6,0.4)" />
              </button>
              <Link href="/progress">
                <StatCard icon="📚" value={learnedCount} label={t.home.words}
                  gradient="linear-gradient(135deg, #0284c7, #38bdf8)" edge="#0369a1" glowColor="rgba(2,132,199,0.4)" />
              </Link>
            </div>
          </div>
        );
        if (sId === 'goal' && (!hideGoalLevel || (!hideWod && wod))) return (
          <div key="goal" className="grid gap-3" style={{
            gridTemplateColumns:
              !hideGoalLevel && !hideWod && wod ? '3fr 2fr 2fr' :
              !hideGoalLevel ? '3fr 2fr' : '1fr',
          }}>
            {!hideGoalLevel && (
              <div
                className="rounded-2xl p-5 flex flex-col justify-between h-full transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #5b21b6, #8b5cf6)',
                  boxShadow: '0 8px 0 #3b0764, 0 12px 28px rgba(91,33,182,0.4)',
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
                    <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="6" />
                      <circle cx="32" cy="32" r="26" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round"
                        strokeDasharray={`${Math.min(dailyProgress, 100) / 100 * 163.4} 163.4`}
                        style={{ transition: 'stroke-dasharray 0.5s ease' }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-black text-white">{dailyProgress >= 100 ? '✓' : todayCount}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                    <div className="flex items-baseline gap-1.5 mb-1.5">
                      <span className="text-2xl font-black text-white">{todayCount}</span>
                      <span className="text-sm text-white/75 font-medium">/ {settings.dailyGoal} {t.home.dailyGoal.toLowerCase()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/25 overflow-hidden mb-1.5">
                      <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${Math.min(dailyProgress, 100)}%` }} />
                    </div>
                    <p className="text-xs text-white/75">
                      {dailyProgress >= 100 ? `${t.home.goalReached} · ${todayXp} XP today` : `${todayXp} XP today · ${Math.max(0, settings.dailyGoal - todayCount)} to go`}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 bg-white/15 rounded-xl px-3 py-1.5 text-xs text-white/90" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.25)' }}>
                  <span>{streakRisk === 'at-risk' ? '⚠️' : streakRisk === 'freeze-saves' ? '⚠️' : '🧊'}</span>
                  <span>
                    {streakRisk === 'at-risk' && streak > 0 ? `${streak}-day streak at risk — study now!`
                      : streakRisk === 'freeze-saves' ? `🧊 Freeze will protect your ${streak}-day streak`
                      : freezes === 0 ? 'No freezes — earn one after 7 days'
                      : freezes === 1 ? t.home.freezeSingle : t.home.freezeMulti(freezes)}
                  </span>
                </div>
              </div>
            )}
            {!hideGoalLevel && (
              <button onClick={() => setShowXpModal(true)}
                className="rounded-2xl p-5 flex flex-col justify-between text-left transition-all duration-200 hover:-translate-y-1 w-full h-full"
                style={{ background: 'linear-gradient(135deg, #be123c, #fb7185)', boxShadow: '0 8px 0 #881337, 0 12px 28px rgba(190,18,60,0.4)', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
              >
                <div>
                  <div className="text-3xl mb-1">⭐</div>
                  <div className="text-xl font-black text-white leading-tight">{levelInfo.level}</div>
                  <div className="text-xs text-white/75 mt-0.5">{xp} XP</div>
                </div>
                <div className="mt-4">
                  <div className="h-2.5 rounded-full bg-white/25 overflow-hidden">
                    <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${levelInfo.progress}%` }} />
                  </div>
                  {levelInfo.next && <p className="text-[11px] text-white/75 mt-1.5">{levelInfo.xpToNext} XP → {levelInfo.next}</p>}
                </div>
              </button>
            )}
            {!hideWod && wod && (
              <div className="rounded-2xl p-5 flex flex-col justify-between h-full transition-all duration-200"
                style={{ background: 'linear-gradient(135deg, #a21caf, #e879f9)', boxShadow: '0 8px 0 #701a75, 0 12px 28px rgba(162,28,175,0.4)', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">{t.home.wordOfDay}</div>
                    <div className="text-xl font-black text-white leading-tight">{wod.word}</div>
                    <div className="text-xs text-white/70 mt-0.5">{wod.partOfSpeech} · {wod.pronunciation}</div>
                    <div className="text-sm font-semibold text-white/90 mt-1">{wod.translation}</div>
                  </div>
                  <button onClick={() => speak(wod.word)}
                    className="shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm hover:bg-white/30 transition-colors"
                    style={{ textShadow: 'none' }} aria-label="Listen to pronunciation">🔊</button>
                </div>
                {wodRevealed ? (
                  <div className="mt-3 space-y-1.5 animate-fade-in">
                    <p className="text-xs text-white/85 leading-snug">{wod.definition}</p>
                    <div className="bg-white/15 rounded-xl p-2">
                      <p className="text-xs italic text-white/80">&ldquo;{wod.example1}&rdquo;</p>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setWodRevealed(true)}
                    className="mt-3 text-xs font-semibold text-white bg-white/20 hover:bg-white/30 rounded-xl px-3 py-1.5 transition-colors self-start"
                    style={{ textShadow: 'none' }}>{t.home.showDefinition} →</button>
                )}
              </div>
            )}
          </div>
        );
        if (sId === 'actions' && !hideActions) return (
          <div key="actions" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <ActionCard href="/learn" icon="📖" title={t.home.learnTitle} subtitle={t.home.learnSub}
              gradient="linear-gradient(135deg, #4338ca, #818cf8)" edge="#312e81" glow="rgba(67,56,202,0.4)" />
            {!hideFlashcards && <ActionCard href="/flashcards" icon="🃏" title={t.home.flashcardsTitle} subtitle={t.home.flashcardsSub}
              gradient="linear-gradient(135deg, #b45309, #fcd34d)" edge="#78350f" glow="rgba(180,83,9,0.4)" />}
            <ActionCard href="/srs" icon="🔄" title={t.home.srsTitle}
              subtitle={dueCount > 0 ? t.home.srsDue(dueCount) : t.home.srsAllCaughtUp}
              gradient={dueCount > 0 ? 'linear-gradient(135deg, #ef4444, #f87171)' : 'linear-gradient(135deg, #1a9a50, #2ECC71)'}
              edge={dueCount > 0 ? '#b91c1c' : '#0f6634'}
              glow={dueCount > 0 ? 'rgba(239,68,68,0.4)' : 'rgba(46,204,113,0.4)'}
              badge={dueCount > 0 ? String(dueCount) : undefined} />
            {!hideQuiz && <ActionCard href="/quiz" icon="❓" title={t.home.quizTitle} subtitle={t.home.quizSub}
              gradient="linear-gradient(135deg, #4d7c0f, #a3e635)" edge="#365314" glow="rgba(77,124,15,0.4)" />}
            {!hideStarred && <ActionCard href="/starred" icon="⭐" title={t.home.starredTitle} subtitle={t.home.starredSub}
              gradient="linear-gradient(135deg, #92400e, #d97706)" edge="#451a03" glow="rgba(146,64,14,0.4)" />}

            {!hideMatch && <ActionCard href="/matching" icon="🎯" title={t.home.matchTitle} subtitle={t.home.matchSub}
              gradient="linear-gradient(135deg, #ec4899, #f472b6)" edge="#9d174d" glow="rgba(236,72,153,0.4)" />}
            {!hidePomodoro && <ActionCard href="/pomodoro" icon="🍅" title={t.home.pomodoroTitle} subtitle={t.home.pomodoroSub}
              gradient="linear-gradient(135deg, #7f1d1d, #b91c1c)" edge="#450a0a" glow="rgba(127,29,29,0.4)" />}
            {!hideLeaderboard && <ActionCard href="/leaderboard" icon="🏆" title="Leaderboard" subtitle="See top learners"
              gradient="linear-gradient(135deg, #d97706, #fbbf24)" edge="#92400e" glow="rgba(217,119,6,0.4)" />}
          </div>
        );
        if (sId === 'shortcuts' && !hideShortcuts) return (
          <div key="shortcuts" className="grid grid-cols-3 sm:grid-cols-5 gap-3">

            {!hideHardWords && <ShortcutCard href="/hard-words" icon="😓" label={t.home.hardTitle} sub={t.home.hardSub}
              gradient="linear-gradient(135deg, #dc2626, #ef4444)" edge="#991b1b" glow="rgba(220,38,38,0.35)" />}
            {!hideLists && <ShortcutCard href="/lists" icon="📋" label={t.home.listsTitle} sub={t.home.listsSub}
              gradient="linear-gradient(135deg, #7c3aed, #8b5cf6)" edge="#4c1d95" glow="rgba(124,58,237,0.35)" />}
            {!hideGrammar && <ShortcutCard href="/grammar-tips" icon="📚" label={t.home.grammarTitle} sub={t.home.grammarSub}
              gradient="linear-gradient(135deg, #1a9a50, #2ECC71)" edge="#0f6634" glow="rgba(46,204,113,0.35)" />}
            {!hideClasses && <ShortcutCard href="/classes" icon="👩‍🏫" label={t.home.classesTitle} sub={t.home.classesSub}
              gradient="linear-gradient(135deg, #0284c7, #38bdf8)" edge="#0369a1" glow="rgba(2,132,199,0.35)" />}
          </div>
        );
        return null;
      })}

      {/* Customize home modal */}
      {showCustomize && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowCustomize(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full sm:max-w-sm bg-[var(--surface)] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-3 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[var(--border)] mx-auto mb-5 sm:hidden" />
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-[var(--text)]">Customize Home</h2>
                <button
                  onClick={() => setShowCustomize(false)}
                  className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >✕</button>
              </div>
              <p className="text-xs text-[var(--text-muted)]">Reorder sections · toggle to show/hide</p>
            </div>
            <div className="overflow-y-auto flex-1 px-6">
              {sectionOrder.map((sId, i) => {
                const labels: Record<string, string> = { stats: 'Stats Row', goal: 'Daily Goal & Level', actions: 'Quick Actions', shortcuts: 'Shortcuts' };
                const icons: Record<string, string> = { stats: '📊', goal: '🎯', actions: '▶️', shortcuts: '⭐' };
                const hidden = sId === 'stats' ? hideStats : sId === 'goal' ? hideGoalLevel : sId === 'actions' ? hideActions : hideShortcuts;
                const toggle = () => {
                  if (sId === 'stats') { setHideStats(!hidden); localStorage.setItem('home_hide_stats', !hidden ? '1' : '0'); }
                  else if (sId === 'goal') { setHideGoalLevel(!hidden); localStorage.setItem('home_hide_goal_level', !hidden ? '1' : '0'); }
                  else if (sId === 'actions') { setHideActions(!hidden); localStorage.setItem('home_hide_actions', !hidden ? '1' : '0'); }
                  else { setHideShortcuts(!hidden); localStorage.setItem('home_hide_shortcuts', !hidden ? '1' : '0'); }
                };
                const moveUp = () => {
                  if (i === 0) return;
                  const next = [...sectionOrder];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  setSectionOrder(next);
                  localStorage.setItem('home_section_order', next.join(','));
                };
                const moveDown = () => {
                  if (i === sectionOrder.length - 1) return;
                  const next = [...sectionOrder];
                  [next[i], next[i + 1]] = [next[i + 1], next[i]];
                  setSectionOrder(next);
                  localStorage.setItem('home_section_order', next.join(','));
                };
                const SubToggle = ({ icon, label, value, onToggle, locked }: { icon: string; label: string; value: boolean; onToggle: () => void; locked?: boolean }) => (
                  <div className={`flex items-center gap-2 py-2 pl-10 border-b border-[var(--border)] ${locked ? 'opacity-40' : ''}`}>
                    <span className="text-sm mr-0.5">{icon}</span>
                    <span className="flex-1 text-sm text-[var(--text-muted)]">{label}</span>
                    {locked
                      ? <span className="text-[10px] text-[var(--text-muted)] font-medium">always on</span>
                      : <button onClick={onToggle}
                          className="relative w-10 h-5 rounded-full transition-colors shrink-0"
                          style={{ background: value ? 'var(--primary)' : 'var(--border)' }}
                        >
                          <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                            style={{ transform: value ? 'translateX(22px)' : 'translateX(2px)' }} />
                        </button>
                    }
                  </div>
                );
                return (
                  <div key={sId}>
                    <div className="flex items-center gap-2 py-2.5 border-b border-[var(--border)]">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={moveUp} disabled={i === 0}
                          className="w-6 h-5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-25 transition-colors text-xs leading-none">▲</button>
                        <button onClick={moveDown} disabled={i === sectionOrder.length - 1}
                          className="w-6 h-5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-25 transition-colors text-xs leading-none">▼</button>
                      </div>
                      <span className="text-base mr-0.5">{icons[sId]}</span>
                      <span className="flex-1 text-sm font-medium text-[var(--text)]">{labels[sId]}</span>
                      <button onClick={toggle}
                        className="relative w-12 h-6 rounded-full transition-colors shrink-0"
                        style={{ background: !hidden ? 'var(--primary)' : 'var(--border)' }}
                      >
                        <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                          style={{ transform: !hidden ? 'translateX(26px)' : 'translateX(2px)' }} />
                      </button>
                    </div>
                    {sId === 'goal' && <>
                      <SubToggle icon="✨" label="Word of the Day" value={!hideWod}
                        onToggle={() => { setHideWod(!hideWod); localStorage.setItem('home_hide_wod', !hideWod ? '1' : '0'); }} />
                    </>}
                    {sId === 'actions' && <>
                      <SubToggle icon="📖" label="Learn" value={true} onToggle={() => {}} locked />
                      <SubToggle icon="🃏" label="Flashcards" value={!hideFlashcards}
                        onToggle={() => { setHideFlashcards(!hideFlashcards); localStorage.setItem('home_hide_flashcards', !hideFlashcards ? '1' : '0'); }} />
                      <SubToggle icon="🔄" label="SRS Review" value={true} onToggle={() => {}} locked />
                      <SubToggle icon="❓" label="Quiz" value={!hideQuiz}
                        onToggle={() => { setHideQuiz(!hideQuiz); localStorage.setItem('home_hide_quiz', !hideQuiz ? '1' : '0'); }} />

                      <SubToggle icon="🎯" label="Match" value={!hideMatch}
                        onToggle={() => { setHideMatch(!hideMatch); localStorage.setItem('home_hide_match', !hideMatch ? '1' : '0'); }} />
                      <SubToggle icon="🍅" label="Pomodoro" value={!hidePomodoro}
                        onToggle={() => { setHidePomodoro(!hidePomodoro); localStorage.setItem('home_hide_pomodoro', !hidePomodoro ? '1' : '0'); }} />
                      <SubToggle icon="🏆" label="Leaderboard" value={!hideLeaderboard}
                        onToggle={() => { setHideLeaderboard(!hideLeaderboard); localStorage.setItem('home_hide_leaderboard', !hideLeaderboard ? '1' : '0'); }} />
                      <SubToggle icon="⭐" label="Starred Words" value={!hideStarred}
                        onToggle={() => { setHideStarred(!hideStarred); localStorage.setItem('home_hide_starred', !hideStarred ? '1' : '0'); }} />
                    </>}
                    {sId === 'shortcuts' && <>
                      <SubToggle icon="😓" label="Hard Words" value={!hideHardWords}
                        onToggle={() => { setHideHardWords(!hideHardWords); localStorage.setItem('home_hide_hard_words', !hideHardWords ? '1' : '0'); }} />
                      <SubToggle icon="📋" label="Lists" value={!hideLists}
                        onToggle={() => { setHideLists(!hideLists); localStorage.setItem('home_hide_lists', !hideLists ? '1' : '0'); }} />
                      <SubToggle icon="📚" label="Grammar Tips" value={!hideGrammar}
                        onToggle={() => { setHideGrammar(!hideGrammar); localStorage.setItem('home_hide_grammar', !hideGrammar ? '1' : '0'); }} />
                      <SubToggle icon="👩‍🏫" label="Classes" value={!hideClasses}
                        onToggle={() => { setHideClasses(!hideClasses); localStorage.setItem('home_hide_classes', !hideClasses ? '1' : '0'); }} />
                    </>}
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-4 shrink-0 flex justify-end border-t border-[var(--border)]">
              <button
                onClick={() => {
                  const def = ['stats', 'goal', 'actions', 'shortcuts'];
                  setSectionOrder(def);
                  localStorage.setItem('home_section_order', def.join(','));
                  setHideStats(false); localStorage.removeItem('home_hide_stats');
                  setHideGoalLevel(false); localStorage.removeItem('home_hide_goal_level');
                  setHideWod(false); localStorage.removeItem('home_hide_wod');
                  setHideActions(false); localStorage.removeItem('home_hide_actions');
                  setHideShortcuts(false); localStorage.removeItem('home_hide_shortcuts');
                  setHideFlashcards(false); localStorage.removeItem('home_hide_flashcards');
                  setHideQuiz(false); localStorage.removeItem('home_hide_quiz');
                  setHideMatch(false); localStorage.removeItem('home_hide_match');
                  setHidePomodoro(false); localStorage.removeItem('home_hide_pomodoro');
                  setHideLeaderboard(false); localStorage.removeItem('home_hide_leaderboard');
                  setHideStarred(false); localStorage.removeItem('home_hide_starred');
                  setHideHardWords(false); localStorage.removeItem('home_hide_hard_words');
                  setHideLists(false); localStorage.removeItem('home_hide_lists');
                  setHideGrammar(false); localStorage.removeItem('home_hide_grammar');
                  setHideClasses(false); localStorage.removeItem('home_hide_classes');
                }}
                className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >Reset to default</button>
            </div>
          </div>
        </div>
      )}

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
