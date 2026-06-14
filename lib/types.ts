export interface WordItem {
  word: string;
  partOfSpeech: string;
  pronunciation: string;
  translation: string; // Uzbek
  definition: string;
  example1: string;
  example1Situation: string; // Uzbek situation description
  example2: string;
  example2Situation: string;
  example3: string;
  example3Translation: string; // Uzbek translation of example3
  example3Situation: string;
  language?: string; // BCP-47, only set for imported words
}

export interface WordDay {
  dayNumber: number;
  topic: string;
  words: WordItem[];
}

export interface WordCollection {
  name: string;
  description: string;
  days: WordDay[];
}

export interface SRSWord extends WordItem {
  id: string; // word + collectionName
  collectionName: string;
  dayNumber: number;
  topic: string;
  reviewStage: number; // 0-4
  nextReviewDate: string; // ISO date string
  learnedDate: string;
}

export interface LearnedWord {
  word: string;
  translation: string;
  collectionName: string;
  topic: string;
  dayNumber: number;
  learnedAt: string;
}

export interface UnitProgress {
  learnDone: boolean;
  flashcardDone: boolean;
  quizDone: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

export interface UserSettings {
  name: string;
  dailyGoal: number; // words per day
  languageLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  defaultAccent: 'us' | 'uk';
  autoPlayOnReveal: boolean;
  sessionSize: number;
  fontSize: 'compact' | 'normal' | 'large';
  studyOrder: 'random' | 'in-order';
  quizDirection: 'word-to-uz' | 'uz-to-word';
  reduceMotion: boolean;
  uiLanguage: 'en' | 'uz';
}

export interface CustomList {
  id: string;
  name: string;
  createdAt: string; // ISO
  words: string[];   // word.word values
}

export interface ImportedWord {
  word: string;
  translation: string;
  definition: string;
  example1: string;
  example2: string;
  language: string; // BCP-47 e.g. 'en-US', 'ru-RU'
  addedAt: number;
}

export type QuizType = 'word_to_translation' | 'translation_to_word' | 'definition_to_word';
export type FlashcardSide = 'word' | 'translation' | 'definition';

export const SRS_INTERVALS = [1, 3, 7, 14]; // days per stage
export const XP_PER_SRS = 5;
export const XP_PER_LEARN = 2;
export const XP_PER_QUIZ = 3;

export const LEVEL_THRESHOLDS = [
  { level: 'Beginner', min: 0, max: 99 },
  { level: 'Elementary', min: 100, max: 299 },
  { level: 'Intermediate', min: 300, max: 699 },
  { level: 'Upper-Intermediate', min: 700, max: 1499 },
  { level: 'Advanced', min: 1500, max: 2999 },
  { level: 'Master', min: 3000, max: Infinity },
];
