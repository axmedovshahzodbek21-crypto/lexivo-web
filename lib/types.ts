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
  learnedAt: string; // "YYYY-MM-DD" — date added to SRS
}

export interface DueSRSWord extends SRSWord {
  dueInterval: number; // which interval is being reviewed today (1|3|7|14|30)
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
  completedAt?: string;
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
  example3?: string;
  example3Translation?: string;
  example4?: string;
  example4Translation?: string;
  example5?: string;
  example5Translation?: string;
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

export const SRS_INTERVALS = [1, 3, 7, 14, 30]; // fixed review intervals in days

// ×10 integer XP storage: displayed value = stored ÷ 10
export const REVIEW_XP: Record<number, number> = { 1: 2, 3: 4, 7: 7, 14: 10, 30: 14 };
export const LEARN_XP_TIERS = [
  { maxWords: 100,      xp: 10 }, // words   1-100  → 1.0 XP displayed
  { maxWords: 500,      xp: 5  }, // words 101-500  → 0.5 XP displayed
  { maxWords: Infinity, xp: 3  }, // words 501+     → 0.3 XP displayed
];
export const STREAK_BONUS_7  = 30; // 3.0 XP displayed at 7-day streak
export const STREAK_BONUS_30 = 70; // 7.0 XP displayed at 30-day streak

// Stored ×10 integers (displayed = min ÷ 10)
export const LEVEL_THRESHOLDS = [
  { level: 'Starter',            min: 0,      max: 1499   },
  { level: 'Beginner',           min: 1500,   max: 3999   },
  { level: 'Elementary',         min: 4000,   max: 7999   },
  { level: 'Pre-Intermediate',   min: 8000,   max: 13999  },
  { level: 'Intermediate',       min: 14000,  max: 24999  },
  { level: 'Upper-Intermediate', min: 25000,  max: 39999  },
  { level: 'Advanced',           min: 40000,  max: 59999  },
  { level: 'Expert',             min: 60000,  max: 84999  },
  { level: 'Master',             min: 85000,  max: 99999  },
  { level: 'Legend',             min: 100000, max: Infinity },
];
