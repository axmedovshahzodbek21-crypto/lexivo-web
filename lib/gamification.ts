import type { Achievement } from './types';
import { LEVEL_THRESHOLDS } from './types';
import { getXP, getLearnedWords, getStreak, getTotalStudyDays, unlockAchievement, getGraduatedCount, getFlashcardTotalDays, getFlashcardStreak, getQuizTotalDays, getQuizStreak } from './storage';

export function getLevelInfo(xp: number) {
  const threshold = LEVEL_THRESHOLDS.find(t => xp >= t.min && xp <= t.max) ?? LEVEL_THRESHOLDS[0];
  const next = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.indexOf(threshold) + 1];
  const progress = next
    ? ((xp - threshold.min) / (next.min - threshold.min)) * 100
    : 100;
  return {
    level: threshold.level,
    progress: Math.min(progress, 100),
    next: next?.level ?? null,
    xpToNext: next ? next.min - xp : 0,
  };
}

const M = [3, 5, 7, 10, 15, 20, 25, 30, 33, 40, 45, 50, 57, 60, 65, 68, 71, 77, 81, 86, 90, 95, 99, 100, 101, 107, 111, 118, 123];

const SD: Record<number, string> = { 3: 'First Steps', 7: 'One Week', 10: 'Double Digits', 30: 'One Month', 50: 'Half Century', 90: 'Three Months', 100: 'Century', 111: 'Triple One', 123: 'One-Two-Three' };
const SS: Record<number, string> = { 3: 'On Fire', 7: 'Week Warrior', 10: 'Unstoppable', 30: 'Monthly Flame', 50: 'Inferno', 90: 'Eternal Flame', 100: 'Century Streak', 111: 'Triple Streak', 123: 'Endless Fire' };
const FD: Record<number, string> = { 3: 'Card Curious', 7: 'Card Week', 10: 'Card Habit', 30: 'Card Month', 50: 'Card Addict', 100: 'Card Century', 111: 'Card Triple', 123: 'Card Master' };
const FS: Record<number, string> = { 3: 'Flash Spark', 7: 'Flash Week', 10: 'Flash Habit', 30: 'Flash Month', 50: 'Flash Inferno', 100: 'Flash Century', 111: 'Flash Triple', 123: 'Flash Legend' };
const QD: Record<number, string> = { 3: 'Quiz Curious', 7: 'Quiz Week', 10: 'Quiz Habit', 30: 'Quiz Month', 50: 'Quiz Addict', 100: 'Quiz Century', 111: 'Quiz Triple', 123: 'Quiz Master' };
const QS: Record<number, string> = { 3: 'Quiz Spark', 7: 'Quiz Warrior', 10: 'Quiz Machine', 30: 'Quiz Marathoner', 50: 'Quiz Inferno', 100: 'Quiz Legend', 111: 'Quiz Triple', 123: 'Quiz God' };

function icon(n: number, base: string): string {
  if (n >= 100) return '🏆';
  if (n >= 50) return '🌟';
  if (n >= 20) return '⭐';
  return base;
}

function milestoneXp(n: number): number {
  if (n >= 107) return 25;
  if (n >= 99)  return 20;
  if (n >= 57)  return 15;
  if (n >= 30)  return 10;
  if (n >= 10)  return 5;
  return 3;
}

function gen(prefix: string, cat: string, baseIcon: string, names: Record<number, string>, descFn: (n: number) => string): Achievement[] {
  return M.map(n => ({
    id: `${prefix}_${n}`,
    title: names[n] ?? `${n}`,
    description: descFn(n),
    icon: icon(n, baseIcon),
    category: cat,
    xp: milestoneXp(n),
  }));
}

const studyDayAchs   = gen('sd', 'study_days',    '📅', SD, n => `Study on ${n} different days`);
const studyStreakAchs = gen('ss', 'study_streak',  '🔥', SS, n => `Study ${n} days in a row`);
const flashDayAchs   = gen('fd', 'flash_days',    '🃏', FD, n => `Do flashcards on ${n} different days`);
const flashStreakAchs = gen('fs', 'flash_streak',  '⚡', FS, n => `Do flashcards ${n} days in a row`);
const quizDayAchs    = gen('qd', 'quiz_days',     '❓', QD, n => `Do a quiz on ${n} different days`);
const quizStreakAchs  = gen('qs', 'quiz_streak',   '🧠', QS, n => `Do a quiz ${n} days in a row`);

export const ALL_ACHIEVEMENTS: Achievement[] = [
  // Words
  { id: 'first_word',   title: 'First Step',         description: 'Learn your first word',   icon: '🌱', category: 'words',      xp: 2  },
  { id: 'words_10',     title: 'Getting Started',    description: 'Learn 10 words',           icon: '📚', category: 'words',      xp: 5  },
  { id: 'words_50',     title: 'Word Collector',     description: 'Learn 50 words',           icon: '📖', category: 'words',      xp: 10 },
  { id: 'words_100',    title: 'Centurion',          description: 'Learn 100 words',          icon: '💯', category: 'words',      xp: 15 },
  { id: 'words_250',    title: 'Word Master',        description: 'Learn 250 words',          icon: '🏆', category: 'words',      xp: 25 },
  { id: 'words_500',    title: 'Lexicon Master',     description: 'Learn 500 words',          icon: '👑', category: 'words',      xp: 40 },
  { id: 'words_1000',   title: 'Lexivo Legend',      description: 'Learn 1000 words',         icon: '🌍', category: 'words',      xp: 75 },
  // XP
  { id: 'xp_100',       title: 'XP Earner',          description: 'Earn 100 XP',              icon: '✨', category: 'xp',         xp: 5  },
  { id: 'xp_500',       title: 'XP Hunter',          description: 'Earn 500 XP',              icon: '💎', category: 'xp',         xp: 10 },
  { id: 'xp_1000',      title: 'XP Legend',          description: 'Earn 1000 XP',             icon: '🚀', category: 'xp',         xp: 20 },
  { id: 'xp_2000',      title: 'XP Master',          description: 'Earn 2000 XP',             icon: '🏆', category: 'xp',         xp: 35 },
  // SRS
  { id: 'srs_first',        title: 'Reviewer',        description: 'Complete your first SRS review', icon: '🔄', category: 'srs', xp: 5  },
  { id: 'srs_mastered_10',  title: 'Memory Champion', description: 'Master 10 words in SRS',         icon: '🧠', category: 'srs', xp: 10 },
  // Milestones
  { id: 'flashcard_first',  title: 'Flashcard Fan',   description: 'Complete a flashcard session',   icon: '🃏', category: 'milestones', xp: 3  },
  { id: 'quiz_first',       title: 'Quiz Taker',      description: 'Complete a quiz',                icon: '❓', category: 'milestones', xp: 3  },
  { id: 'quiz_perfect',     title: 'Perfect Score',   description: 'Score 100% on a quiz',           icon: '🎯', category: 'milestones', xp: 10 },
  // Milestone categories
  ...studyDayAchs,
  ...studyStreakAchs,
  ...flashDayAchs,
  ...flashStreakAchs,
  ...quizDayAchs,
  ...quizStreakAchs,
];

export const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  words:         { label: 'Words Learned',     icon: '📚' },
  xp:            { label: 'XP Earned',         icon: '✨' },
  study_days:    { label: 'Study Days',        icon: '📅' },
  study_streak:  { label: 'Study Streak',      icon: '🔥' },
  flash_days:    { label: 'Flashcard Days',    icon: '🃏' },
  flash_streak:  { label: 'Flashcard Streak',  icon: '⚡' },
  quiz_days:     { label: 'Quiz Days',         icon: '❓' },
  quiz_streak:   { label: 'Quiz Streak',       icon: '🧠' },
  srs:           { label: 'SRS & Memory',      icon: '🔄' },
  milestones:    { label: 'Milestones',        icon: '🏆' },
};

export const CATEGORY_ORDER = ['words', 'xp', 'study_days', 'study_streak', 'flash_days', 'flash_streak', 'quiz_days', 'quiz_streak', 'srs', 'milestones'];

// Shared by app/achievements/page.tsx and the achievements tab in
// app/progress/page.tsx — both independently grouped ALL_ACHIEVEMENTS by
// category and summed unlocked/total XP the same way, just with different
// card layouts (a dedicated full page vs. a compact in-tab summary).
export function groupAchievementsByCategory(): Record<string, Achievement[]> {
  const byCategory: Record<string, Achievement[]> = {};
  for (const a of ALL_ACHIEVEMENTS) (byCategory[a.category] ??= []).push(a);
  return byCategory;
}

export function computeAchievementXp(unlockedIds: string[]): { earned: number; total: number } {
  const earned = ALL_ACHIEVEMENTS.filter(a => unlockedIds.includes(a.id)).reduce((s, a) => s + a.xp, 0);
  const total = ALL_ACHIEVEMENTS.reduce((s, a) => s + a.xp, 0);
  return { earned, total };
}

export function checkAchievements(): Achievement[] {
  const newlyUnlocked: Achievement[] = [];
  const xp            = getXP();
  const learnedCount  = getLearnedWords().length;
  const streak        = getStreak();
  const totalDays     = getTotalStudyDays();
  const masteredCount = getGraduatedCount();
  const flashDays     = getFlashcardTotalDays();
  const flashStreak   = getFlashcardStreak();
  const quizDays      = getQuizTotalDays();
  const quizStreak    = getQuizStreak();

  const checks: Array<[string, boolean]> = [
    ['first_word',        learnedCount >= 1],
    ['words_10',          learnedCount >= 10],
    ['words_50',          learnedCount >= 50],
    ['words_100',         learnedCount >= 100],
    ['words_250',         learnedCount >= 250],
    ['words_500',         learnedCount >= 500],
    ['words_1000',        learnedCount >= 1000],
    ['xp_100',            xp >= 1000],
    ['xp_500',            xp >= 5000],
    ['xp_1000',           xp >= 10000],
    ['xp_2000',           xp >= 20000],
    ['srs_mastered_10',   masteredCount >= 10],
    ['flashcard_first',   flashDays     >= 1],
    ...M.map(n => [`sd_${n}`, totalDays   >= n] as [string, boolean]),
    ...M.map(n => [`ss_${n}`, streak      >= n] as [string, boolean]),
    ...M.map(n => [`fd_${n}`, flashDays   >= n] as [string, boolean]),
    ...M.map(n => [`fs_${n}`, flashStreak >= n] as [string, boolean]),
    ...M.map(n => [`qd_${n}`, quizDays    >= n] as [string, boolean]),
    ...M.map(n => [`qs_${n}`, quizStreak  >= n] as [string, boolean]),
  ];

  for (const [id, condition] of checks) {
    if (condition) {
      const achievement = ALL_ACHIEVEMENTS.find(a => a.id === id);
      const justUnlocked = unlockAchievement(id, (achievement?.xp ?? 0) * 10);
      if (justUnlocked && achievement) newlyUnlocked.push(achievement);
    }
  }

  return newlyUnlocked;
}

export function getAchievementProgress(id: string, stats: {
  learnedCount: number; streak: number; totalDays: number; xp: number;
  masteredCount: number; flashDays: number; flashStreak: number; quizDays: number; quizStreak: number;
}): { current: number; target: number; label: string } | null {
  if (id === 'first_word')     return { current: Math.min(stats.learnedCount, 1), target: 1, label: 'words' };
  if (id.startsWith('words_')) { const t = parseInt(id.split('_')[1]); return { current: Math.min(stats.learnedCount, t), target: t, label: 'words' }; }
  if (id.startsWith('xp_'))    { const t = parseInt(id.split('_')[1]) * 10; return { current: Math.min(stats.xp, t), target: t, label: 'XP' }; }
  if (id === 'srs_mastered_10') return { current: Math.min(stats.masteredCount, 10), target: 10, label: 'mastered' };
  const sdm = id.match(/^sd_(\d+)$/); if (sdm) { const t = +sdm[1]; return { current: Math.min(stats.totalDays, t), target: t, label: 'days' }; }
  const ssm = id.match(/^ss_(\d+)$/); if (ssm) { const t = +ssm[1]; return { current: Math.min(stats.streak, t), target: t, label: 'days' }; }
  const fdm = id.match(/^fd_(\d+)$/); if (fdm) { const t = +fdm[1]; return { current: Math.min(stats.flashDays, t), target: t, label: 'days' }; }
  const fsm = id.match(/^fs_(\d+)$/); if (fsm) { const t = +fsm[1]; return { current: Math.min(stats.flashStreak, t), target: t, label: 'days' }; }
  const qdm = id.match(/^qd_(\d+)$/); if (qdm) { const t = +qdm[1]; return { current: Math.min(stats.quizDays, t), target: t, label: 'days' }; }
  const qsm = id.match(/^qs_(\d+)$/); if (qsm) { const t = +qsm[1]; return { current: Math.min(stats.quizStreak, t), target: t, label: 'days' }; }
  return null;
}
