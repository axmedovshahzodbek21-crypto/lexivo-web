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

// Shared by both this file's own stageLabel/stageColor and class-srs.ts's
// stageColor — the personal and class SRS screens use genuinely different
// color palettes (kept as-is below; unifying them would visibly change
// either screen's existing stage colors), but both were duplicating the
// identical "clamp to 5, index into the array" logic around their own array.
export function pickByStage<T>(stage: number, values: T[]): T {
  return values[Math.min(stage, 5)];
}

// completedCount = number of intervals done (0–5); 5 = graduated.
// Re-exported as-is from class-srs.ts, which uses the exact same labels for
// class SRS review — unlike stageColor below, there's no reason for these
// two surfaces to disagree on wording.
export function stageLabel(completedCount: number): string {
  return pickByStage(completedCount, ['New', '+1 done', '+3 done', '+7 done', '+14 done', 'Graduated']);
}

export function stageColor(completedCount: number): string {
  return pickByStage(completedCount, ['#9CA3AF', ACCENT.quiz, ACCENT.srs, ACCENT.grammar, ACCENT.learn, '#10B981']);
}
