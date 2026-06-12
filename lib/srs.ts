import type { WordItem, SRSWord } from './types';
import { SRS_INTERVALS } from './types';

export function createSRSWord(
  word: WordItem,
  collectionName: string,
  dayNumber: number,
  topic: string
): SRSWord {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + SRS_INTERVALS[0]);

  return {
    ...word,
    id: `${collectionName}::${word.word}`,
    collectionName,
    dayNumber,
    topic,
    reviewStage: 0,
    nextReviewDate: tomorrow.toISOString().split('T')[0],
    learnedDate: new Date().toISOString().split('T')[0],
  };
}

export function stageLabel(stage: number): string {
  const labels = ['New', 'Learning', 'Familiar', 'Known', 'Mastered'];
  return labels[Math.min(stage, 4)];
}

export function stageColor(stage: number): string {
  const colors = ['#9CA3AF', '#F59E0B', '#3B82F6', '#10B981', '#6C63FF'];
  return colors[Math.min(stage, 4)];
}

export function daysUntilReview(word: SRSWord): number {
  const today = new Date().toISOString().split('T')[0];
  const next = new Date(word.nextReviewDate);
  const now = new Date(today);
  const diff = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 0);
}
