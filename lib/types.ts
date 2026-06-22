export interface WordItem {
  word: string;
  partOfSpeech: string;
  pronunciation: string;
  translation: string; // Uzbek
  definition: string;
  definitionUz?: string;
  example1: string;
  example1Situation: string; // kept for backward compat
  example1Translation?: string;
  example2: string;
  example2Situation: string; // kept for backward compat
  example2Translation?: string;
  example3: string;
  example3Translation: string;
  example3Situation: string; // kept for backward compat
  extraExamples?: string[];
  extraExampleTranslations?: string[];
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
  showOnLeaderboard: boolean;
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
  example1Translation?: string;
  example2: string;
  example2Translation?: string;
  language: string; // BCP-47 e.g. 'en-US', 'ru-RU'
  addedAt: number;
  collectionName?: string; // optional for backward compat; defaults to 'My Words'
  folderName?: string;     // optional; if set, collection lives inside this folder
}

export interface ImportedCollection {
  name: string;
  count: number;
  addedAt: number;
  folderName?: string; // undefined = root-level collection
}

export interface ImportedFolder {
  name: string;
  collectionCount: number;
  wordCount: number;
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
