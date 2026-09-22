import type { Achievement } from './types';
import { LEVEL_THRESHOLDS } from './types';
import type { Translations } from './i18n';
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

// Language-independent achievement metadata (id/icon/category/xp) — the
// title and description come from t.achievements at display time, via
// achievementTitle/achievementDescription below.
interface AchievementMeta { id: string; icon: string; category: string; xp: number }

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

function genMeta(prefix: string, cat: string, baseIcon: string): AchievementMeta[] {
  return M.map(n => ({ id: `${prefix}_${n}`, icon: icon(n, baseIcon), category: cat, xp: milestoneXp(n) }));
}

const studyDayMeta    = genMeta('sd', 'study_days',    '📅');
const studyStreakMeta = genMeta('ss', 'study_streak',  '🔥');
const flashDayMeta    = genMeta('fd', 'flash_days',    '🃏');
const flashStreakMeta = genMeta('fs', 'flash_streak',  '⚡');
const quizDayMeta     = genMeta('qd', 'quiz_days',     '❓');
const quizStreakMeta  = genMeta('qs', 'quiz_streak',   '🧠');

export const ACHIEVEMENT_META: AchievementMeta[] = [
  { id: 'first_word',       icon: '🌱', category: 'words',      xp: 2  },
  { id: 'words_10',         icon: '📚', category: 'words',      xp: 5  },
  { id: 'words_50',         icon: '📖', category: 'words',      xp: 10 },
  { id: 'words_100',        icon: '💯', category: 'words',      xp: 15 },
  { id: 'words_250',        icon: '🏆', category: 'words',      xp: 25 },
  { id: 'words_500',        icon: '👑', category: 'words',      xp: 40 },
  { id: 'words_1000',       icon: '🌍', category: 'words',      xp: 75 },
  { id: 'xp_100',           icon: '✨', category: 'xp',         xp: 5  },
  { id: 'xp_500',           icon: '💎', category: 'xp',         xp: 10 },
  { id: 'xp_1000',          icon: '🚀', category: 'xp',         xp: 20 },
  { id: 'xp_2000',          icon: '🏆', category: 'xp',         xp: 35 },
  { id: 'srs_first',        icon: '🔄', category: 'srs',        xp: 5  },
  { id: 'srs_mastered_10',  icon: '🧠', category: 'srs',        xp: 10 },
  { id: 'flashcard_first',  icon: '🃏', category: 'milestones', xp: 3  },
  { id: 'quiz_first',       icon: '❓', category: 'milestones', xp: 3  },
  { id: 'quiz_perfect',     icon: '🎯', category: 'milestones', xp: 10 },
  ...studyDayMeta,
  ...studyStreakMeta,
  ...flashDayMeta,
  ...flashStreakMeta,
  ...quizDayMeta,
  ...quizStreakMeta,
];

function parseMilestone(id: string): { prefix: string; n: number } | null {
  const m = id.match(/^(sd|ss|fd|fs|qd|qs)_(\d+)$/);
  return m ? { prefix: m[1], n: +m[2] } : null;
}

export function achievementTitle(t: Translations, id: string): string {
  const fixed = t.achievements.items[id];
  if (fixed) return fixed.title;
  const ms = parseMilestone(id);
  if (!ms) return id;
  const names = {
    sd: t.achievements.studyDayNames, ss: t.achievements.studyStreakNames,
    fd: t.achievements.flashDayNames, fs: t.achievements.flashStreakNames,
    qd: t.achievements.quizDayNames,  qs: t.achievements.quizStreakNames,
  }[ms.prefix as 'sd' | 'ss' | 'fd' | 'fs' | 'qd' | 'qs'];
  return names[ms.n] ?? `${ms.n}`;
}

export function achievementDescription(t: Translations, id: string): string {
  const fixed = t.achievements.items[id];
  if (fixed) return fixed.description;
  const ms = parseMilestone(id);
  if (!ms) return '';
  const descFn = {
    sd: t.achievements.studyDayDesc, ss: t.achievements.studyStreakDesc,
    fd: t.achievements.flashDayDesc, fs: t.achievements.flashStreakDesc,
    qd: t.achievements.quizDayDesc,  qs: t.achievements.quizStreakDesc,
  }[ms.prefix as 'sd' | 'ss' | 'fd' | 'fs' | 'qd' | 'qs'];
  return descFn(ms.n);
}

function localize(t: Translations, meta: AchievementMeta): Achievement {
  return { id: meta.id, icon: meta.icon, category: meta.category, xp: meta.xp,
    title: achievementTitle(t, meta.id), description: achievementDescription(t, meta.id) };
}

export function getAllAchievements(t: Translations): Achievement[] {
  return ACHIEVEMENT_META.map(m => localize(t, m));
}

export function getCategoryMeta(t: Translations): Record<string, { label: string; icon: string }> {
  const icons: Record<string, string> = {
    words: '📚', xp: '✨', study_days: '📅', study_streak: '🔥',
    flash_days: '🃏', flash_streak: '⚡', quiz_days: '❓', quiz_streak: '🧠',
    srs: '🔄', milestones: '🏆',
  };
  const labels = t.achievements.categoryLabels;
  return Object.fromEntries(Object.keys(icons).map(cat => [cat, { label: labels[cat], icon: icons[cat] }]));
}

export const CATEGORY_ORDER = ['words', 'xp', 'study_days', 'study_streak', 'flash_days', 'flash_streak', 'quiz_days', 'quiz_streak', 'srs', 'milestones'];

// Shared by app/achievements/page.tsx and the achievements tab in
// app/progress/page.tsx — both independently grouped achievements by
// category and summed unlocked/total XP the same way, just with different
// card layouts (a dedicated full page vs. a compact in-tab summary).
export function groupAchievementsByCategory(t: Translations): Record<string, Achievement[]> {
  const byCategory: Record<string, Achievement[]> = {};
  for (const a of getAllAchievements(t)) (byCategory[a.category] ??= []).push(a);
  return byCategory;
}

export function computeAchievementXp(unlockedIds: string[]): { earned: number; total: number } {
  const earned = ACHIEVEMENT_META.filter(a => unlockedIds.includes(a.id)).reduce((s, a) => s + a.xp, 0);
  const total = ACHIEVEMENT_META.reduce((s, a) => s + a.xp, 0);
  return { earned, total };
}

export function achievementCount(): number {
  return ACHIEVEMENT_META.length;
}

export function checkAchievements(t: Translations): Achievement[] {
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
      const meta = ACHIEVEMENT_META.find(a => a.id === id);
      const justUnlocked = unlockAchievement(id, (meta?.xp ?? 0) * 10);
      if (justUnlocked && meta) newlyUnlocked.push(localize(t, meta));
    }
  }

  return newlyUnlocked;
}

export function getAchievementProgress(id: string, stats: {
  learnedCount: number; streak: number; totalDays: number; xp: number;
  masteredCount: number; flashDays: number; flashStreak: number; quizDays: number; quizStreak: number;
}, t: Translations): { current: number; target: number; label: string } | null {
  const L = t.achievements.progressLabels;
  if (id === 'first_word')     return { current: Math.min(stats.learnedCount, 1), target: 1, label: L.words };
  if (id.startsWith('words_')) { const tgt = parseInt(id.split('_')[1]); return { current: Math.min(stats.learnedCount, tgt), target: tgt, label: L.words }; }
  if (id.startsWith('xp_'))    { const tgt = parseInt(id.split('_')[1]) * 10; return { current: Math.min(stats.xp, tgt), target: tgt, label: L.xp }; }
  if (id === 'srs_mastered_10') return { current: Math.min(stats.masteredCount, 10), target: 10, label: L.mastered };
  const sdm = id.match(/^sd_(\d+)$/); if (sdm) { const tgt = +sdm[1]; return { current: Math.min(stats.totalDays, tgt), target: tgt, label: L.days }; }
  const ssm = id.match(/^ss_(\d+)$/); if (ssm) { const tgt = +ssm[1]; return { current: Math.min(stats.streak, tgt), target: tgt, label: L.days }; }
  const fdm = id.match(/^fd_(\d+)$/); if (fdm) { const tgt = +fdm[1]; return { current: Math.min(stats.flashDays, tgt), target: tgt, label: L.days }; }
  const fsm = id.match(/^fs_(\d+)$/); if (fsm) { const tgt = +fsm[1]; return { current: Math.min(stats.flashStreak, tgt), target: tgt, label: L.days }; }
  const qdm = id.match(/^qd_(\d+)$/); if (qdm) { const tgt = +qdm[1]; return { current: Math.min(stats.quizDays, tgt), target: tgt, label: L.days }; }
  const qsm = id.match(/^qs_(\d+)$/); if (qsm) { const tgt = +qsm[1]; return { current: Math.min(stats.quizStreak, tgt), target: tgt, label: L.days }; }
  return null;
}
