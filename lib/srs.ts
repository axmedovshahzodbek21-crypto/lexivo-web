import type { WordItem, SRSWord } from './types';
import { ACCENT } from './colors';
import { localDateStr } from './storage';

export function createSRSWord(
  word: WordItem,
  collectionName: string,
  dayNumber: number,
  topic: string
): SRSWord {
  return {
    ...word,
    id: `${collectionName}::${word.word}`,
    collectionName,
    dayNumber,
    topic,
    learnedAt: localDateStr(),
  };
}

// completedCount = number of intervals done (0–5); 5 = graduated
export function stageLabel(completedCount: number): string {
  const labels = ['New', '+1 done', '+3 done', '+7 done', '+14 done', 'Graduated'];
  return labels[Math.min(completedCount, 5)];
}

export function stageColor(completedCount: number): string {
  const colors = ['#9CA3AF', ACCENT.quiz, ACCENT.srs, ACCENT.grammar, ACCENT.learn, '#10B981'];
  return colors[Math.min(completedCount, 5)];
}
