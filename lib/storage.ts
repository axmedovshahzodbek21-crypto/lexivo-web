import type { SRSWord, LearnedWord, UnitProgress, UserSettings, Achievement, CustomList, WordItem, WordCollection } from './types';
import { SRS_INTERVALS, LEVEL_THRESHOLDS } from './types';

function levelForXp(xp: number): string {
  return (LEVEL_THRESHOLDS.find(t => xp >= t.min && xp <= t.max) ?? LEVEL_THRESHOLDS[0]).level;
}

const KEYS = {
  profilePic: 'lexivo_profile_pic',
  customLists: 'lexivo_custom_lists',
  learned: 'lexivo_learned_words',
  srs: 'lexivo_srs_words',
  streak: 'lexivo_streak',
  lastStudy: 'lexivo_last_study',
  totalDays: 'lexivo_total_study_days',
  xp: 'lexivo_xp',
  todayXp: 'lexivo_today_xp',
  todayXpDate: 'lexivo_today_xp_date',
  todayCount: 'lexivo_today_count',
  todayCountDate: 'lexivo_today_count_date',
  unitProgress: 'lexivo_unit_progress',
  starred: 'lexivo_starred',
  achievements: 'lexivo_achievements',
  settings: 'lexivo_settings',
  onboarded: 'lexivo_onboarded',
  freezes: 'lexivo_freezes',
  lastFreezeWeek: 'lexivo_last_freeze_week',
};

function get<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function set(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Settings ───────────────────────────────────────────────────────────────

const SETTINGS_DEFAULTS: UserSettings = {
  name: 'Learner',
  dailyGoal: 10,
  languageLevel: 'B1',
  defaultAccent: 'us',
  autoPlayOnReveal: true,
  sessionSize: 20,
  fontSize: 'normal',
  studyOrder: 'random',
  quizDirection: 'word-to-uz',
  reduceMotion: false,
  uiLanguage: 'en',
};

export function getSettings(): UserSettings {
  const stored = get<Partial<UserSettings>>(KEYS.settings, {});
  return { ...SETTINGS_DEFAULTS, ...stored };
}

export function saveSettings(s: UserSettings) {
  if (typeof window !== 'undefined') {
    console.log('[lang] saveSettings uiLanguage=', s.uiLanguage, new Error().stack?.split('\n').slice(1,3).join(' | '));
  }
  set(KEYS.settings, s);
}

export function isOnboarded(): boolean {
  return get<boolean>(KEYS.onboarded, false);
}

export function setOnboarded() {
  set(KEYS.onboarded, true);
}

export function resetOnboarded() {
  set(KEYS.onboarded, false);
}

export function getProfilePic(): string | null {
  return get<string | null>(KEYS.profilePic, null);
}

export function saveProfilePic(base64: string) {
  set(KEYS.profilePic, base64);
}

export function removeProfilePic() {
  if (typeof window !== 'undefined') localStorage.removeItem(KEYS.profilePic);
}

// ─── Learned words ───────────────────────────────────────────────────────────

export function getLearnedWords(): LearnedWord[] {
  return get<LearnedWord[]>(KEYS.learned, []);
}

export function saveLearnedWord(word: LearnedWord) {
  const words = getLearnedWords();
  if (!words.find(w => w.word === word.word && w.collectionName === word.collectionName)) {
    words.push(word);
    set(KEYS.learned, words);
  }
}

// Returns { "2024-01-15": 12, "2024-01-16": 8, ... } derived from learned words
export function getStudyHistory(): Record<string, number> {
  const history: Record<string, number> = {};
  for (const w of getLearnedWords()) {
    const date = w.learnedAt.split('T')[0];
    history[date] = (history[date] ?? 0) + 1;
  }
  return history;
}

export function getTodayLearnedCount(): number {
  const date = new Date().toISOString().split('T')[0];
  const storedDate = get<string>(KEYS.todayCountDate, '');
  if (storedDate !== date) return 0;
  return get<number>(KEYS.todayCount, 0);
}

export function incrementTodayCount() {
  const date = new Date().toISOString().split('T')[0];
  const storedDate = get<string>(KEYS.todayCountDate, '');
  const count = storedDate === date ? get<number>(KEYS.todayCount, 0) : 0;
  set(KEYS.todayCount, count + 1);
  set(KEYS.todayCountDate, date);
}

// ─── SRS ─────────────────────────────────────────────────────────────────────

export function getSRSWords(): SRSWord[] {
  return get<SRSWord[]>(KEYS.srs, []);
}

export function addSRSWord(word: SRSWord) {
  const words = getSRSWords();
  if (!words.find(w => w.id === word.id)) {
    words.push(word);
    set(KEYS.srs, words);
  }
}

export function getDueWords(): SRSWord[] {
  const today = new Date().toISOString().split('T')[0];
  return getSRSWords().filter(w => w.nextReviewDate <= today && w.reviewStage < 4);
}

export function updateSRSWord(id: string, success: boolean) {
  const words = getSRSWords();
  const idx = words.findIndex(w => w.id === id);
  if (idx === -1) return;
  const word = words[idx];
  if (success) {
    word.reviewStage = Math.min(word.reviewStage + 1, 4);
  } else {
    word.reviewStage = Math.max(word.reviewStage - 1, 0);
  }
  const daysUntilNext = SRS_INTERVALS[Math.min(word.reviewStage, SRS_INTERVALS.length - 1)] ?? 14;
  const next = new Date();
  next.setDate(next.getDate() + daysUntilNext);
  word.nextReviewDate = next.toISOString().split('T')[0];
  words[idx] = word;
  set(KEYS.srs, words);
}

export function getMasteredCount(): number {
  return getSRSWords().filter(w => w.reviewStage >= 4).length;
}

// ─── Streak ───────────────────────────────────────────────────────────────────

export function getStreak(): number {
  return get<number>(KEYS.streak, 0);
}

// ─── Streak freeze ────────────────────────────────────────────────────────────

export function getFreezes(): number {
  return get<number>(KEYS.freezes, 0);
}

function getWeekKey(): string {
  const d = new Date();
  // Use ISO week: shift so Monday = day 1
  const day = (d.getDay() + 6) % 7;
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - day + 3);
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  const week = 1 + Math.round((thursday.getTime() - jan4.getTime()) / 604800000);
  return `${thursday.getFullYear()}-W${week}`;
}

// Grants 1 freeze per calendar week (max held: 2, only while streak > 0).
// Returns true if a freeze was granted.
export function checkAndGrantWeeklyFreeze(): boolean {
  if (typeof window === 'undefined') return false;
  const streak = get<number>(KEYS.streak, 0);
  if (streak <= 0) return false;

  const currentWeek = getWeekKey();
  if (get<string>(KEYS.lastFreezeWeek, '') === currentWeek) return false;

  set(KEYS.lastFreezeWeek, currentWeek);
  const held = get<number>(KEYS.freezes, 0);
  if (held < 2) {
    set(KEYS.freezes, held + 1);
    return true;
  }
  return false;
}

export function recordStudySession(): { freezeUsed: boolean } {
  const today = new Date().toISOString().split('T')[0];
  const last  = get<string>(KEYS.lastStudy, '');
  if (last === today) return { freezeUsed: false };

  checkAndGrantWeeklyFreeze();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const tdStr = twoDaysAgo.toISOString().split('T')[0];

  let streak = get<number>(KEYS.streak, 0);
  let freezeUsed = false;

  if (last === yStr) {
    streak += 1;
  } else if (last === tdStr && get<number>(KEYS.freezes, 0) > 0) {
    // Auto-apply freeze — covers yesterday, today continues the streak
    set(KEYS.freezes, get<number>(KEYS.freezes, 0) - 1);
    streak += 1;
    freezeUsed = true;
  } else if (last === '') {
    streak = 1;
  } else {
    streak = 1;
  }

  set(KEYS.streak, streak);
  set(KEYS.lastStudy, today);
  set(KEYS.totalDays, get<number>(KEYS.totalDays, 0) + 1);

  return { freezeUsed };
}

export function getTotalStudyDays(): number {
  return get<number>(KEYS.totalDays, 0);
}

// ─── XP ──────────────────────────────────────────────────────────────────────

export function getXP(): number {
  return get<number>(KEYS.xp, 0);
}

export function getTodayXP(): number {
  const date = new Date().toISOString().split('T')[0];
  const storedDate = get<string>(KEYS.todayXpDate, '');
  if (storedDate !== date) return 0;
  return get<number>(KEYS.todayXp, 0);
}

export function addXP(amount: number): { leveledUp: boolean; newLevel: string; newXp: number } {
  const oldXp = get<number>(KEYS.xp, 0);
  const newXp = oldXp + amount;
  set(KEYS.xp, newXp);

  const date = new Date().toISOString().split('T')[0];
  const storedDate = get<string>(KEYS.todayXpDate, '');
  const todayXp = storedDate === date ? get<number>(KEYS.todayXp, 0) : 0;
  set(KEYS.todayXp, todayXp + amount);
  set(KEYS.todayXpDate, date);

  const oldLevel = levelForXp(oldXp);
  const newLevel = levelForXp(newXp);
  return { leveledUp: oldLevel !== newLevel, newLevel, newXp };
}

// ─── Unit Progress ───────────────────────────────────────────────────────────

export function getUnitProgress(collectionName: string, dayNumber: number): UnitProgress {
  const key = `${KEYS.unitProgress}_${collectionName}_${dayNumber}`;
  return get<UnitProgress>(key, { learnDone: false, flashcardDone: false, quizDone: false });
}

export function markLearningComplete(collectionName: string, dayNumber: number) {
  const key = `${KEYS.unitProgress}_${collectionName}_${dayNumber}`;
  const p = getUnitProgress(collectionName, dayNumber);
  set(key, { ...p, learnDone: true });
}

export function markFlashcardComplete(collectionName: string, dayNumber: number) {
  const key = `${KEYS.unitProgress}_${collectionName}_${dayNumber}`;
  const p = getUnitProgress(collectionName, dayNumber);
  set(key, { ...p, flashcardDone: true });
}

export function markQuizComplete(collectionName: string, dayNumber: number) {
  const key = `${KEYS.unitProgress}_${collectionName}_${dayNumber}`;
  const p = getUnitProgress(collectionName, dayNumber);
  set(key, { ...p, quizDone: true });
}

// ─── Starred words ───────────────────────────────────────────────────────────

export function getStarredWords(): string[] {
  return get<string[]>(KEYS.starred, []);
}

export function toggleStarred(word: string): boolean {
  const starred = getStarredWords();
  const idx = starred.indexOf(word);
  if (idx === -1) {
    starred.push(word);
    set(KEYS.starred, starred);
    return true;
  } else {
    starred.splice(idx, 1);
    set(KEYS.starred, starred);
    return false;
  }
}

export function isStarred(word: string): boolean {
  return getStarredWords().includes(word);
}

// ─── Achievements ────────────────────────────────────────────────────────────

export function getUnlockedAchievements(): string[] {
  return get<string[]>(KEYS.achievements, []);
}

export function unlockAchievement(id: string): boolean {
  const unlocked = getUnlockedAchievements();
  if (unlocked.includes(id)) return false;
  unlocked.push(id);
  set(KEYS.achievements, unlocked);
  return true;
}

// ─── Hard words (too hard) ───────────────────────────────────────────────────

export function getHardWords(): string[] {
  return get<string[]>('lexivo_hard_words', []);
}

export function addHardWord(word: string) {
  const hard = getHardWords();
  if (!hard.includes(word)) {
    hard.push(word);
    set('lexivo_hard_words', hard);
  }
}

export function removeHardWord(word: string) {
  const hard = getHardWords().filter(w => w !== word);
  set('lexivo_hard_words', hard);
}

// ─── Custom lists ────────────────────────────────────────────────────────────

export function getCustomLists(): CustomList[] {
  return get<CustomList[]>(KEYS.customLists, []);
}

export function saveCustomList(list: CustomList) {
  const lists = getCustomLists();
  const idx = lists.findIndex(l => l.id === list.id);
  if (idx === -1) lists.push(list);
  else lists[idx] = list;
  set(KEYS.customLists, lists);
}

export function deleteCustomList(id: string) {
  set(KEYS.customLists, getCustomLists().filter(l => l.id !== id));
}

export function addWordToList(listId: string, word: string) {
  const lists = getCustomLists();
  const list = lists.find(l => l.id === listId);
  if (!list || list.words.includes(word)) return;
  list.words.push(word);
  set(KEYS.customLists, lists);
}

export function removeWordFromList(listId: string, word: string) {
  const lists = getCustomLists();
  const list = lists.find(l => l.id === listId);
  if (!list) return;
  list.words = list.words.filter(w => w !== word);
  set(KEYS.customLists, lists);
}

export function getCustomListWords(
  listId: string,
  collections: WordCollection[],
): Array<WordItem & { collectionName: string; topic: string; dayNumber: number }> {
  const list = getCustomLists().find(l => l.id === listId);
  if (!list) return [];
  const wordSet = new Set(list.words);
  const result: Array<WordItem & { collectionName: string; topic: string; dayNumber: number }> = [];
  const seen = new Set<string>();
  for (const col of collections) {
    for (const day of col.days) {
      for (const w of day.words) {
        if (wordSet.has(w.word) && !seen.has(w.word)) {
          result.push({ ...w, collectionName: col.name, topic: day.topic, dayNumber: day.dayNumber });
          seen.add(w.word);
        }
      }
    }
  }
  return result;
}

export function isWordInList(listId: string, word: string): boolean {
  return getCustomLists().find(l => l.id === listId)?.words.includes(word) ?? false;
}

// ─── Learn Progress ───────────────────────────────────────────────────────────

export function saveLearnProgress(collectionName: string, dayNumber: number, wordIndex: number): void {
  set(`lexivo_learn_progress_${collectionName}_${dayNumber}`, wordIndex);
}

export function getLearnProgress(collectionName: string, dayNumber: number): number | null {
  return get<number | null>(`lexivo_learn_progress_${collectionName}_${dayNumber}`, null);
}

export function clearLearnProgress(collectionName: string, dayNumber: number): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`lexivo_learn_progress_${collectionName}_${dayNumber}`);
}

export function getHardWordCount(collectionName: string, dayNumber: number): number {
  return getSRSWords().filter(
    w => w.collectionName === collectionName && w.dayNumber === dayNumber && w.reviewStage < 4
  ).length;
}

export function saveFlashcardProgress(collectionName: string, dayNumber: number, remainingWordIds: string[]): void {
  set(`lexivo_flashcard_progress_${collectionName}_${dayNumber}`, remainingWordIds);
}

export function getFlashcardProgress(collectionName: string, dayNumber: number): string[] | null {
  return get<string[] | null>(`lexivo_flashcard_progress_${collectionName}_${dayNumber}`, null);
}

export function clearFlashcardProgress(collectionName: string, dayNumber: number): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`lexivo_flashcard_progress_${collectionName}_${dayNumber}`);
}
