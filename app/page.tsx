'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { useAppStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { getWordOfDay } from '@/lib/data';
import { getStreak, getXP, getTodayXP, getTodayLearnedCount, getDueWords, getLearnedWords, getSettings, isOnboarded, getFreezes, checkAndGrantWeeklyFreeze, getImportedWords, getLastStudyDate, localDateStr, displayXP } from '@/lib/storage';
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
  const [hideCollections, setHideCollections] = useState(false);
  const [hideReading, setHideReading] = useState(false);
  const [hideDayStreak, setHideDayStreak] = useState(false);
  const [hideTotalXp, setHideTotalXp] = useState(false);
  const [hideWords, setHideWords] = useState(false);
  const [hideDailyGoal, setHideDailyGoal] = useState(false);
  const [hideLevel, setHideLevel] = useState(false);
  const [hideWod, setHideWod] = useState(false);
  const [hideLearn, setHideLearn] = useState(false);
  const [hideSrs, setHideSrs] = useState(false);
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
  const [hideMode, setHideMode] = useState(false);
  const [hideSelection, setHideSelection] = useState<Set<string>>(new Set());
  const [unhideMode, setUnhideMode] = useState(false);
  const [unhideSelection, setUnhideSelection] = useState<Set<string>>(new Set());
  const [switchMode, setSwitchMode] = useState(false);
  const [workingOrder, setWorkingOrder] = useState<string[]>([]);
  const [switchFirst, setSwitchFirst] = useState<string | null>(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const [sectionOrder, setSectionOrder] = useState([
    'collections', 'reading', 'day_streak', 'total_xp', 'words',
    'daily_goal', 'level', 'wod',
    'learn', 'flashcards', 'srs', 'quiz',
    'starred', 'match', 'pomodoro', 'leaderboard',
    'hard_words', 'lists', 'grammar', 'classes',
  ]);

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
    setHideCollections(localStorage.getItem('home_hide_collections') === '1');
    setHideReading(localStorage.getItem('home_hide_reading') === '1');
    setHideDayStreak(localStorage.getItem('home_hide_day_streak') === '1');
    setHideTotalXp(localStorage.getItem('home_hide_total_xp') === '1');
    setHideWords(localStorage.getItem('home_hide_words') === '1');
    setHideDailyGoal(localStorage.getItem('home_hide_daily_goal') === '1');
    setHideLevel(localStorage.getItem('home_hide_level') === '1');
    setHideWod(localStorage.getItem('home_hide_wod') === '1');
    setHideLearn(localStorage.getItem('home_hide_learn') === '1');
    setHideSrs(localStorage.getItem('home_hide_srs') === '1');
    const DEFAULT_ORDER = [
      'collections', 'reading', 'day_streak', 'total_xp', 'words',
      'daily_goal', 'level', 'wod',
      'learn', 'flashcards', 'srs', 'quiz',
      'starred', 'match', 'pomodoro', 'leaderboard',
      'hard_words', 'lists', 'grammar', 'classes',
    ];
    const ALL_IDS = new Set(DEFAULT_ORDER);
    const savedOrder = localStorage.getItem('home_section_order');
    let order = savedOrder ? savedOrder.split(',') : DEFAULT_ORDER;
    if (order.includes('stats')) {
      const idx = order.indexOf('stats');
      order = [...order.slice(0, idx), 'collections', 'reading', 'day_streak', 'total_xp', 'words', ...order.slice(idx + 1)];
    }
    if (order.includes('goal')) {
      const idx = order.indexOf('goal');
      order = [...order.slice(0, idx), 'daily_goal', 'level', ...order.slice(idx + 1)];
    }
    if (order.includes('actions')) {
      const idx = order.indexOf('actions');
      order = [...order.slice(0, idx), 'learn', 'srs', 'flashcards', 'quiz', 'match', 'pomodoro', 'leaderboard', 'starred', 'hard_words', 'lists', 'grammar', 'classes', ...order.slice(idx + 1)];
    }
    order = order.filter(s => s !== 'shortcuts');
    const missing = DEFAULT_ORDER.filter(id => !order.includes(id));
    setSectionOrder([...order.filter(id => ALL_IDS.has(id)), ...missing]);
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


  const t = useTranslation();
  const levelInfo = getLevelInfo(xp);
  const dailyProgress = Math.min((todayCount / settings.dailyGoal) * 100, 100);
  const mainCollections = collections.filter(c => !LEVELED_NAMES.has(c.name));

  const handleHideSave = () => {
    const LS: Record<string, string> = {
      collections: 'home_hide_collections', reading: 'home_hide_reading',
      day_streak: 'home_hide_day_streak',   total_xp: 'home_hide_total_xp',
      words: 'home_hide_words',             daily_goal: 'home_hide_daily_goal',
      level: 'home_hide_level',             wod: 'home_hide_wod',
      learn: 'home_hide_learn',             srs: 'home_hide_srs',
      flashcards: 'home_hide_flashcards',   quiz: 'home_hide_quiz',
      match: 'home_hide_match',             pomodoro: 'home_hide_pomodoro',
      leaderboard: 'home_hide_leaderboard', starred: 'home_hide_starred',
      hard_words: 'home_hide_hard_words',   lists: 'home_hide_lists',
      grammar: 'home_hide_grammar',         classes: 'home_hide_classes',
    };
    hideSelection.forEach(sId => {
      if (LS[sId]) localStorage.setItem(LS[sId], '1');
      if (sId === 'collections')  setHideCollections(true);
      else if (sId === 'reading')      setHideReading(true);
      else if (sId === 'day_streak')   setHideDayStreak(true);
      else if (sId === 'total_xp')     setHideTotalXp(true);
      else if (sId === 'words')        setHideWords(true);
      else if (sId === 'daily_goal')   setHideDailyGoal(true);
      else if (sId === 'level')        setHideLevel(true);
      else if (sId === 'wod')          setHideWod(true);
      else if (sId === 'learn')        setHideLearn(true);
      else if (sId === 'srs')          setHideSrs(true);
      else if (sId === 'flashcards')   setHideFlashcards(true);
      else if (sId === 'quiz')         setHideQuiz(true);
      else if (sId === 'match')        setHideMatch(true);
      else if (sId === 'pomodoro')     setHidePomodoro(true);
      else if (sId === 'leaderboard')  setHideLeaderboard(true);
      else if (sId === 'starred')      setHideStarred(true);
      else if (sId === 'hard_words')   setHideHardWords(true);
      else if (sId === 'lists')        setHideLists(true);
      else if (sId === 'grammar')      setHideGrammar(true);
      else if (sId === 'classes')      setHideClasses(true);
    });
    setHideMode(false);
    setHideSelection(new Set());
  };

  const handleUnhideSave = () => {
    const LS: Record<string, string> = {
      collections: 'home_hide_collections', reading: 'home_hide_reading',
      day_streak: 'home_hide_day_streak',   total_xp: 'home_hide_total_xp',
      words: 'home_hide_words',             daily_goal: 'home_hide_daily_goal',
      level: 'home_hide_level',             wod: 'home_hide_wod',
      learn: 'home_hide_learn',             srs: 'home_hide_srs',
      flashcards: 'home_hide_flashcards',   quiz: 'home_hide_quiz',
      match: 'home_hide_match',             pomodoro: 'home_hide_pomodoro',
      leaderboard: 'home_hide_leaderboard', starred: 'home_hide_starred',
      hard_words: 'home_hide_hard_words',   lists: 'home_hide_lists',
      grammar: 'home_hide_grammar',         classes: 'home_hide_classes',
    };
    unhideSelection.forEach(sId => {
      if (LS[sId]) localStorage.removeItem(LS[sId]);
      if (sId === 'collections')  setHideCollections(false);
      else if (sId === 'reading')      setHideReading(false);
      else if (sId === 'day_streak')   setHideDayStreak(false);
      else if (sId === 'total_xp')     setHideTotalXp(false);
      else if (sId === 'words')        setHideWords(false);
      else if (sId === 'daily_goal')   setHideDailyGoal(false);
      else if (sId === 'level')        setHideLevel(false);
      else if (sId === 'wod')          setHideWod(false);
      else if (sId === 'learn')        setHideLearn(false);
      else if (sId === 'srs')          setHideSrs(false);
      else if (sId === 'flashcards')   setHideFlashcards(false);
      else if (sId === 'quiz')         setHideQuiz(false);
      else if (sId === 'match')        setHideMatch(false);
      else if (sId === 'pomodoro')     setHidePomodoro(false);
      else if (sId === 'leaderboard')  setHideLeaderboard(false);
      else if (sId === 'starred')      setHideStarred(false);
      else if (sId === 'hard_words')   setHideHardWords(false);
      else if (sId === 'lists')        setHideLists(false);
      else if (sId === 'grammar')      setHideGrammar(false);
      else if (sId === 'classes')      setHideClasses(false);
    });
    setUnhideMode(false);
    setUnhideSelection(new Set());
  };

  const handleSwitchSave = () => {
    setSectionOrder(workingOrder);
    localStorage.setItem('home_section_order', workingOrder.join(','));
    setSwitchMode(false);
    setSwitchFirst(null);
    setWorkingOrder([]);
  };

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

      {(() => {
        const FRAME_SLOTS = [
          { gridColumn: '1',     gridRow: '1'     },
          { gridColumn: '1',     gridRow: '2'     },
          { gridColumn: '2 / 5', gridRow: '1 / 3' },
          { gridColumn: '5',     gridRow: '1'     },
          { gridColumn: '5',     gridRow: '2'     },
          { gridColumn: '1', gridRow: '3' }, { gridColumn: '2', gridRow: '3' }, { gridColumn: '3', gridRow: '3' }, { gridColumn: '4', gridRow: '3' }, { gridColumn: '5', gridRow: '3' },
          { gridColumn: '1', gridRow: '4' }, { gridColumn: '2', gridRow: '4' }, { gridColumn: '3', gridRow: '4' }, { gridColumn: '4', gridRow: '4' }, { gridColumn: '5', gridRow: '4' },
          { gridColumn: '1', gridRow: '5' }, { gridColumn: '2', gridRow: '5' }, { gridColumn: '3', gridRow: '5' }, { gridColumn: '4', gridRow: '5' }, { gridColumn: '5', gridRow: '5' },
        ];
        const HIDE_MAP: Record<string, boolean> = {
          collections: hideCollections, reading: hideReading, day_streak: hideDayStreak,
          total_xp: hideTotalXp, words: hideWords, daily_goal: hideDailyGoal,
          level: hideLevel, wod: hideWod, learn: hideLearn, srs: hideSrs,
          flashcards: hideFlashcards, quiz: hideQuiz, match: hideMatch,
          pomodoro: hidePomodoro, leaderboard: hideLeaderboard, starred: hideStarred,
          hard_words: hideHardWords, lists: hideLists, grammar: hideGrammar, classes: hideClasses,
        };
        const visible = sectionOrder.filter(sId => !HIDE_MAP[sId]);
        const displaySections = unhideMode
          ? sectionOrder
          : switchMode
          ? workingOrder.filter(sId => !HIDE_MAP[sId])
          : visible;

        type ActionDef = { href: string; icon: string; title: string; subtitle: string; gradient: string; edge: string; glow: string; badge?: string };
        const ACTION_MAP: Record<string, ActionDef> = {
          learn:       { href: '/learn',        icon: '📖', title: t.home.learnTitle,     subtitle: t.home.learnSub,       gradient: 'linear-gradient(135deg, #4338ca, #818cf8)', edge: '#312e81', glow: 'rgba(67,56,202,0.4)' },
          srs:         { href: dueCount > 0 ? '/srs' : '/free-time', icon: '🔄', title: t.home.srsTitle, subtitle: dueCount > 0 ? t.home.srsDue(dueCount) : t.home.srsAllCaughtUp, gradient: dueCount > 0 ? 'linear-gradient(135deg, #ef4444, #f87171)' : 'linear-gradient(135deg, #1a9a50, #2ECC71)', edge: dueCount > 0 ? '#b91c1c' : '#0f6634', glow: dueCount > 0 ? 'rgba(239,68,68,0.4)' : 'rgba(46,204,113,0.4)', badge: dueCount > 0 ? String(dueCount) : undefined },
          flashcards:  { href: '/flashcards',   icon: '🃏', title: t.home.flashcardsTitle, subtitle: t.home.flashcardsSub,  gradient: 'linear-gradient(135deg, #b45309, #fcd34d)', edge: '#78350f', glow: 'rgba(180,83,9,0.4)' },
          quiz:        { href: '/quiz',         icon: '❓', title: t.home.quizTitle,       subtitle: t.home.quizSub,        gradient: 'linear-gradient(135deg, #4d7c0f, #a3e635)', edge: '#365314', glow: 'rgba(77,124,15,0.4)' },
          match:       { href: '/matching',     icon: '🎯', title: t.home.matchTitle,      subtitle: t.home.matchSub,       gradient: 'linear-gradient(135deg, #ec4899, #f472b6)', edge: '#9d174d', glow: 'rgba(236,72,153,0.4)' },
          pomodoro:    { href: '/pomodoro',     icon: '🍅', title: t.home.pomodoroTitle,   subtitle: t.home.pomodoroSub,    gradient: 'linear-gradient(135deg, #7f1d1d, #b91c1c)', edge: '#450a0a', glow: 'rgba(127,29,29,0.4)' },
          leaderboard: { href: '/leaderboard',  icon: '🏆', title: 'Leaderboard',          subtitle: 'See top learners',    gradient: 'linear-gradient(135deg, #d97706, #fbbf24)', edge: '#92400e', glow: 'rgba(217,119,6,0.4)' },
          starred:     { href: '/starred',      icon: '⭐', title: t.home.starredTitle,    subtitle: t.home.starredSub,     gradient: 'linear-gradient(135deg, #92400e, #d97706)', edge: '#451a03', glow: 'rgba(146,64,14,0.4)' },
          hard_words:  { href: '/hard-words',   icon: '😓', title: t.home.hardTitle,       subtitle: t.home.hardSub,        gradient: 'linear-gradient(135deg, #dc2626, #ef4444)', edge: '#991b1b', glow: 'rgba(220,38,38,0.4)' },
          lists:       { href: '/lists',        icon: '📋', title: t.home.listsTitle,      subtitle: t.home.listsSub,       gradient: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', edge: '#4c1d95', glow: 'rgba(124,58,237,0.4)' },
          grammar:     { href: '/grammar-tips', icon: '📚', title: t.home.grammarTitle,    subtitle: t.home.grammarSub,     gradient: 'linear-gradient(135deg, #1a9a50, #2ECC71)', edge: '#0f6634', glow: 'rgba(46,204,113,0.4)' },
          classes:     { href: '/classes',      icon: '👩‍🏫', title: t.home.classesTitle,  subtitle: t.home.classesSub,     gradient: 'linear-gradient(135deg, #0284c7, #38bdf8)', edge: '#0369a1', glow: 'rgba(2,132,199,0.4)' },
        };

        const renderCard = (sId: string, isLarge: boolean) => {
          if (sId === 'collections') return (
            <Link href="/collections" className="block h-full">
              <StatCard icon="🗂️" value={mainCollections.length + 2} label={t.home.collections}
                gradient="linear-gradient(135deg, #1d4ed8, #60a5fa)" edge="#1e3a8a" glowColor="rgba(29,78,216,0.4)" />
            </Link>
          );
          if (sId === 'reading') return (
            <Link href="/reading" className="block h-full">
              <StatCard icon="📰" value="→" label="Reading"
                gradient="linear-gradient(135deg, #047857, #34d399)" edge="#064e3b" glowColor="rgba(4,120,87,0.4)" />
            </Link>
          );
          if (sId === 'day_streak') return (
            <Link href="/progress?tab=calendar" className="block h-full">
              <div className="rounded-2xl h-full flex flex-col items-center justify-center text-center gap-3 hover:-translate-y-1 transition-all duration-200 animate-heartbeat"
                style={{ background: 'linear-gradient(135deg, #FF6B35, #ff9f7f)', boxShadow: '0 10px 0 #b84a1a, 0 16px 36px rgba(255,107,53,0.45)', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                <div className={isLarge ? 'text-7xl' : 'text-4xl'}>🔥</div>
                <div className={isLarge ? 'text-6xl font-black text-white' : 'text-3xl font-black text-white'}>{streak}</div>
                <div className={isLarge ? 'text-base text-white/85 font-semibold' : 'text-xs text-white/85 font-semibold'}>{t.home.dayStreak}</div>
              </div>
            </Link>
          );
          if (sId === 'total_xp') return (
            <button onClick={() => setShowXpModal(true)} className="block h-full w-full">
              <StatCard icon="⚡" value={displayXP(xp)} label={t.home.totalXp}
                gradient="linear-gradient(135deg, #d97706, #fbbf24)" edge="#92400e" glowColor="rgba(217,119,6,0.4)" />
            </button>
          );
          if (sId === 'words') return (
            <Link href="/progress" className="block h-full">
              <StatCard icon="📚" value={learnedCount} label={t.home.words}
                gradient="linear-gradient(135deg, #0284c7, #38bdf8)" edge="#0369a1" glowColor="rgba(2,132,199,0.4)" />
            </Link>
          );
          if (sId === 'daily_goal') return (
            <div className="rounded-2xl h-full p-4 flex flex-col justify-between animate-heartbeat"
              style={{ background: 'linear-gradient(135deg, #5b21b6, #8b5cf6)', boxShadow: '0 8px 0 #3b0764, 0 12px 28px rgba(91,33,182,0.4)' }}>
              <div className="flex items-center gap-3">
                <div className="relative shrink-0" style={{ width: 50, height: 50 }}>
                  <svg width="50" height="50" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
                    <circle cx="25" cy="25" r="20" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round"
                      strokeDasharray={`${Math.min(dailyProgress, 100) / 100 * 125.7} 125.7`}
                      style={{ transition: 'stroke-dasharray 0.5s ease' }} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{dailyProgress >= 100 ? '✓' : todayCount}</span>
                  </div>
                </div>
                <div style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                  <div className="text-sm font-black text-white">{todayCount} / {settings.dailyGoal}</div>
                  <div className="text-xs text-white/75">{t.home.dailyGoal}</div>
                </div>
              </div>
              <div>
                <div className="h-1.5 rounded-full bg-white/25 overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${Math.min(dailyProgress, 100)}%` }} />
                </div>
                <p className="text-[10px] text-white/75" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                  {dailyProgress >= 100 ? t.home.goalReached : `${displayXP(todayXp)} XP · ${Math.max(0, settings.dailyGoal - todayCount)} to go`}
                </p>
              </div>
            </div>
          );
          if (sId === 'level') return (
            <button onClick={() => setShowXpModal(true)} className="block h-full w-full text-left">
              <div className="rounded-2xl h-full p-4 flex flex-col justify-between animate-heartbeat"
                style={{ background: 'linear-gradient(135deg, #be123c, #fb7185)', boxShadow: '0 8px 0 #881337, 0 12px 28px rgba(190,18,60,0.4)', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                <div>
                  <div className="text-2xl mb-1">⭐</div>
                  <div className="text-sm font-black text-white leading-tight">{levelInfo.level}</div>
                  <div className="text-xs text-white/75 mt-0.5">{displayXP(xp)} XP</div>
                </div>
                <div>
                  <div className="h-2 rounded-full bg-white/25 overflow-hidden mb-1">
                    <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${levelInfo.progress}%` }} />
                  </div>
                  {levelInfo.next && <p className="text-[10px] text-white/75">{displayXP(levelInfo.xpToNext)} → {levelInfo.next}</p>}
                </div>
              </div>
            </button>
          );
          if (sId === 'wod') return wod ? (
            <div className="rounded-2xl h-full p-4 flex flex-col justify-between animate-heartbeat"
              style={{ background: 'linear-gradient(135deg, #a21caf, #e879f9)', boxShadow: '0 8px 0 #701a75, 0 12px 28px rgba(162,28,175,0.4)', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-bold text-white/60 uppercase tracking-wider mb-1">{t.home.wordOfDay}</div>
                  <div className="text-sm font-black text-white leading-tight">{wod.word}</div>
                  <div className="text-[10px] text-white/70 mt-0.5">{wod.partOfSpeech}</div>
                  <div className="text-xs font-semibold text-white/90 mt-1">{wod.translation}</div>
                </div>
                <button onClick={() => speak(wod.word)}
                  className="shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs hover:bg-white/30 transition-colors"
                  style={{ textShadow: 'none' }} aria-label="Pronounce">🔊</button>
              </div>
              {wodRevealed ? (
                <p className="text-[10px] text-white/85 leading-snug mt-2">{wod.definition}</p>
              ) : (
                <button onClick={() => setWodRevealed(true)}
                  className="mt-auto text-[10px] font-semibold text-white bg-white/20 hover:bg-white/30 rounded-xl px-2 py-1 transition-colors self-start"
                  style={{ textShadow: 'none' }}>{t.home.showDefinition}</button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl h-full animate-pulse" style={{ background: 'rgba(162,28,175,0.2)' }} />
          );
          if (sId in ACTION_MAP) {
            const a = ACTION_MAP[sId];
            return (
              <div className="relative h-full">
                {a.badge && (
                  <div className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] rounded-full bg-white text-[var(--danger)] text-[10px] flex items-center justify-center font-black z-10 shadow px-1">
                    {a.badge}
                  </div>
                )}
                <Link href={a.href} className="block h-full">
                  <div className="rounded-2xl h-full p-4 flex flex-col items-center justify-center text-center gap-2 hover:-translate-y-1 transition-all duration-200 animate-heartbeat"
                    style={{ background: a.gradient, boxShadow: `0 7px 0 ${a.edge}, 0 10px 24px ${a.glow}`, textShadow: '0 1px 3px rgba(0,0,0,0.35)' }}>
                    <div className="text-3xl">{a.icon}</div>
                    <div className="font-bold text-sm text-white leading-tight">{a.title}</div>
                    <div className="text-[10px] text-white/70">{a.subtitle}</div>
                  </div>
                </Link>
              </div>
            );
          }
          return null;
        };

        return (
          <>
            {hideMode && (
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
                <div>
                  <p className="text-sm font-bold text-[var(--text)]">Tap cards to hide</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {hideSelection.size === 0 ? 'None selected yet' : `${hideSelection.size} selected`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setHideMode(false); setHideSelection(new Set()); }}
                    className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                  >Discard</button>
                  <button
                    onClick={handleHideSave}
                    disabled={hideSelection.size === 0}
                    className="px-3 py-1.5 rounded-xl text-sm font-bold bg-[var(--danger)] text-white disabled:opacity-40 transition-opacity"
                  >{hideSelection.size > 0 ? `Hide (${hideSelection.size})` : 'Hide'}</button>
                </div>
              </div>
            )}
            {unhideMode && (
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
                <div>
                  <p className="text-sm font-bold text-[var(--text)]">Tap ghost cards to unhide</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {unhideSelection.size === 0 ? 'None selected yet' : `${unhideSelection.size} selected`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setUnhideMode(false); setUnhideSelection(new Set()); }}
                    className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                  >Discard</button>
                  <button
                    onClick={handleUnhideSave}
                    disabled={unhideSelection.size === 0}
                    className="px-3 py-1.5 rounded-xl text-sm font-bold bg-green-500 text-white disabled:opacity-40 transition-opacity"
                  >{unhideSelection.size > 0 ? `Unhide (${unhideSelection.size})` : 'Unhide'}</button>
                </div>
              </div>
            )}
            {switchMode && (
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
                <div>
                  <p className="text-sm font-bold text-[var(--text)]">
                    {switchFirst
                      ? `Swap "${switchFirst.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}" with…`
                      : 'Tap a card to select it'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {switchFirst ? 'Tap another card to swap, or same card to deselect' : 'Then tap another card to swap positions'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSwitchMode(false); setSwitchFirst(null); setWorkingOrder([]); }}
                    className="px-3 py-1.5 rounded-xl text-sm font-semibold bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                  >Discard</button>
                  <button
                    onClick={handleSwitchSave}
                    className="px-3 py-1.5 rounded-xl text-sm font-bold bg-[var(--primary)] text-white"
                  >Save</button>
                </div>
              </div>
            )}
            <div className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: '140px 140px', gridAutoRows: '130px' }}>
              {displaySections.map((sId, idx) => {
                const slot = FRAME_SLOTS[idx];
                if (!slot) return null;
                const isHidden = HIDE_MAP[sId];
                const isHideSelected = hideSelection.has(sId);
                const toggleHideSelect = () => setHideSelection(prev => {
                  const next = new Set(prev); if (next.has(sId)) next.delete(sId); else next.add(sId); return next;
                });
                const isUnhideSelected = unhideSelection.has(sId);
                const toggleUnhideSelect = () => {
                  if (!isHidden) return;
                  setUnhideSelection(prev => {
                    const next = new Set(prev); if (next.has(sId)) next.delete(sId); else next.add(sId); return next;
                  });
                };
                const isInteractive = hideMode || (unhideMode && isHidden) || switchMode;
                const handleSwitchTap = () => {
                  if (switchFirst === null) {
                    setSwitchFirst(sId);
                  } else if (switchFirst === sId) {
                    setSwitchFirst(null);
                  } else {
                    const newOrder = [...workingOrder];
                    const aIdx = newOrder.indexOf(switchFirst);
                    const bIdx = newOrder.indexOf(sId);
                    if (aIdx !== -1 && bIdx !== -1) {
                      [newOrder[aIdx], newOrder[bIdx]] = [newOrder[bIdx], newOrder[aIdx]];
                      setWorkingOrder(newOrder);
                    }
                    setSwitchFirst(null);
                  }
                };
                return (
                  <div
                    key={sId}
                    style={slot}
                    className={`h-full relative group ${isInteractive ? 'cursor-pointer' : ''}`}
                    onClick={switchMode ? handleSwitchTap : (hideMode ? toggleHideSelect : (unhideMode ? toggleUnhideSelect : undefined))}
                  >
                    <div className={`h-full transition-opacity duration-150
                      ${hideMode || switchMode || (unhideMode && !isHidden) ? 'pointer-events-none' : ''}
                      ${unhideMode && isHidden ? (isUnhideSelected ? 'opacity-65 pointer-events-none' : 'opacity-25 pointer-events-none') : ''}`}>
                      {renderCard(sId, idx === 2)}
                    </div>

                    {/* Hide mode overlay */}
                    {hideMode && (
                      <div className={`absolute inset-0 rounded-2xl flex items-center justify-center transition-all duration-150
                        ${isHideSelected ? 'bg-black/55' : 'bg-transparent hover:bg-black/15'}`}>
                        {isHideSelected ? (
                          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center text-xl shadow-lg">✕</div>
                        ) : (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full border-2 border-white/70 bg-black/10" />
                        )}
                      </div>
                    )}

                    {/* Unhide mode overlay — only on ghost (hidden) cards */}
                    {unhideMode && isHidden && (
                      <div className={`absolute inset-0 rounded-2xl flex items-center justify-center transition-all duration-150
                        ${isUnhideSelected ? 'ring-2 ring-inset ring-green-400' : 'hover:bg-white/10'}`}>
                        {isUnhideSelected ? (
                          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white text-xl shadow-lg">✓</div>
                        ) : (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full border-2 border-white/50 bg-black/20 flex items-center justify-center">
                            <span className="text-white/70 text-[10px] font-bold leading-none">+</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Switch mode overlay */}
                    {switchMode && (
                      <div className={`absolute inset-0 rounded-2xl pointer-events-none transition-all duration-150
                        ${sId === switchFirst ? 'ring-2 ring-inset ring-white bg-white/20' : 'group-hover:bg-white/10'}`}>
                        {sId === switchFirst ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center text-xl shadow-lg">⇄</div>
                          </div>
                        ) : (
                          <div className="absolute top-2 right-2 text-white/40 text-xs font-black">⇄</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* Customize home modal */}
      {showCustomize && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowCustomize(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full sm:max-w-sm bg-[var(--surface)] rounded-t-3xl sm:rounded-3xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4">
              <div className="w-10 h-1 rounded-full bg-[var(--border)] mx-auto mb-5 sm:hidden" />
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-[var(--text)]">Customize Home</h2>
                <button onClick={() => setShowCustomize(false)}
                  className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">✕</button>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <button
                  onClick={() => { setShowCustomize(false); setHideMode(true); setHideSelection(new Set()); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)] hover:bg-red-500/5 transition-all"
                ><span className="text-2xl">🙈</span><span className="text-xs font-semibold">Hide</span></button>
                <button
                  onClick={() => { setShowCustomize(false); setUnhideMode(true); setUnhideSelection(new Set()); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-[var(--border)] text-[var(--text-muted)] hover:border-green-500 hover:text-green-500 hover:bg-green-500/5 transition-all"
                ><span className="text-2xl">👁</span><span className="text-xs font-semibold">Unhide</span></button>
                <button
                  onClick={() => { setShowCustomize(false); setSwitchMode(true); setWorkingOrder([...sectionOrder]); setSwitchFirst(null); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--primary-bg)] transition-all"
                ><span className="text-2xl">⇄</span><span className="text-xs font-semibold">Switch</span></button>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end">
              <button
                onClick={() => {
                  const def = [
                    'collections', 'reading', 'day_streak', 'total_xp', 'words',
                    'daily_goal', 'level', 'wod',
                    'learn', 'flashcards', 'srs', 'quiz',
                    'starred', 'match', 'pomodoro', 'leaderboard',
                    'hard_words', 'lists', 'grammar', 'classes',
                  ];
                  setSectionOrder(def); localStorage.setItem('home_section_order', def.join(','));
                  setHideCollections(false);  localStorage.removeItem('home_hide_collections');
                  setHideReading(false);      localStorage.removeItem('home_hide_reading');
                  setHideDayStreak(false);    localStorage.removeItem('home_hide_day_streak');
                  setHideTotalXp(false);      localStorage.removeItem('home_hide_total_xp');
                  setHideWords(false);        localStorage.removeItem('home_hide_words');
                  setHideDailyGoal(false);    localStorage.removeItem('home_hide_daily_goal');
                  setHideLevel(false);        localStorage.removeItem('home_hide_level');
                  setHideWod(false);          localStorage.removeItem('home_hide_wod');
                  setHideLearn(false);        localStorage.removeItem('home_hide_learn');
                  setHideSrs(false);          localStorage.removeItem('home_hide_srs');
                  setHideFlashcards(false);   localStorage.removeItem('home_hide_flashcards');
                  setHideQuiz(false);         localStorage.removeItem('home_hide_quiz');
                  setHideMatch(false);        localStorage.removeItem('home_hide_match');
                  setHidePomodoro(false);     localStorage.removeItem('home_hide_pomodoro');
                  setHideLeaderboard(false);  localStorage.removeItem('home_hide_leaderboard');
                  setHideStarred(false);      localStorage.removeItem('home_hide_starred');
                  setHideHardWords(false);    localStorage.removeItem('home_hide_hard_words');
                  setHideLists(false);        localStorage.removeItem('home_hide_lists');
                  setHideGrammar(false);      localStorage.removeItem('home_hide_grammar');
                  setHideClasses(false);      localStorage.removeItem('home_hide_classes');
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
      className="rounded-2xl p-4 flex flex-col items-center text-center gap-1 transition-all duration-200 hover:-translate-y-1 w-full h-full animate-heartbeat"
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
