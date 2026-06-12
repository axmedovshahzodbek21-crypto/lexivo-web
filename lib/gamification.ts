import type { Achievement } from './types';
import { LEVEL_THRESHOLDS } from './types';
import { getXP, getLearnedWords, getStreak, getUnlockedAchievements, unlockAchievement, getSRSWords } from './storage';

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

export const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_word', title: 'First Step', description: 'Learn your first word', icon: '🌱' },
  { id: 'words_10', title: 'Getting Started', description: 'Learn 10 words', icon: '📚' },
  { id: 'words_50', title: 'Word Collector', description: 'Learn 50 words', icon: '📖' },
  { id: 'words_100', title: 'Centurion', description: 'Learn 100 words', icon: '💯' },
  { id: 'words_250', title: 'Word Master', description: 'Learn 250 words', icon: '🏆' },
  { id: 'words_500', title: 'Lexicon Master', description: 'Learn 500 words', icon: '👑' },
  { id: 'streak_3', title: '3-Day Streak', description: 'Study 3 days in a row', icon: '🔥' },
  { id: 'streak_7', title: 'Week Warrior', description: 'Study 7 days in a row', icon: '⚡' },
  { id: 'streak_30', title: 'Monthly Master', description: 'Study 30 days in a row', icon: '🌟' },
  { id: 'xp_100', title: 'XP Earner', description: 'Earn 100 XP', icon: '✨' },
  { id: 'xp_500', title: 'XP Hunter', description: 'Earn 500 XP', icon: '💎' },
  { id: 'xp_1000', title: 'XP Legend', description: 'Earn 1000 XP', icon: '🚀' },
  { id: 'srs_first', title: 'Reviewer', description: 'Complete your first SRS review', icon: '🔄' },
  { id: 'srs_mastered_10', title: 'Memory Champion', description: 'Master 10 words in SRS', icon: '🧠' },
  { id: 'flashcard_first', title: 'Flashcard Fan', description: 'Complete a flashcard session', icon: '🃏' },
  { id: 'quiz_first', title: 'Quiz Taker', description: 'Complete a quiz', icon: '❓' },
  { id: 'quiz_perfect', title: 'Perfect Score', description: 'Score 100% on a quiz', icon: '🎯' },
];

export function checkAchievements(): Achievement[] {
  const newlyUnlocked: Achievement[] = [];
  const xp = getXP();
  const learnedCount = getLearnedWords().length;
  const streak = getStreak();
  const masteredCount = getSRSWords().filter(w => w.reviewStage >= 4).length;

  const checks: Array<[string, boolean]> = [
    ['first_word', learnedCount >= 1],
    ['words_10', learnedCount >= 10],
    ['words_50', learnedCount >= 50],
    ['words_100', learnedCount >= 100],
    ['words_250', learnedCount >= 250],
    ['words_500', learnedCount >= 500],
    ['streak_3', streak >= 3],
    ['streak_7', streak >= 7],
    ['streak_30', streak >= 30],
    ['xp_100', xp >= 100],
    ['xp_500', xp >= 500],
    ['xp_1000', xp >= 1000],
    ['srs_mastered_10', masteredCount >= 10],
  ];

  for (const [id, condition] of checks) {
    if (condition) {
      const justUnlocked = unlockAchievement(id);
      if (justUnlocked) {
        const achievement = ALL_ACHIEVEMENTS.find(a => a.id === id);
        if (achievement) newlyUnlocked.push(achievement);
      }
    }
  }

  return newlyUnlocked;
}
