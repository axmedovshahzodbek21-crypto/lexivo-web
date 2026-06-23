import type { SRSWord, LearnedWord, UnitProgress, UserSettings, Achievement, CustomList, WordItem, WordCollection, ImportedWord, ImportedCollection, ImportedFolder } from './types';
import { SRS_INTERVALS, LEVEL_THRESHOLDS } from './types';

function levelForXp(xp: number): string {
  return (LEVEL_THRESHOLDS.find(t => xp >= t.min && xp <= t.max) ?? LEVEL_THRESHOLDS[0]).level;
}

const KEYS = {
  profilePic: 'lexivo_profile_pic',
  profilePicUrl: 'lexivo_profile_pic_url',
  nameUpdatedAt: 'lexivo_name_updated_at',
  levelUpdatedAt: 'lexivo_level_updated_at',
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
  uiLang: 'lexivo_ui_lang',
  onboarded: 'lexivo_onboarded',
  freezes: 'lexivo_freezes',
  lastFreezeWeek: 'lexivo_last_freeze_week',
  studyDays: 'lexivo_study_days',
  xpHistory: 'lexivo_xp_history',
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
  showOnLeaderboard: true,
};

// uiLanguage lives in its own key so pullAll's saveSettings call never overwrites it
export function getUILanguage(): 'en' | 'uz' {
  if (typeof window === 'undefined') return 'en';
  const v = localStorage.getItem(KEYS.uiLang);
  if (v === 'uz' || v === 'en') return v;
  // Migrate: fall back to value inside the settings object
  try {
    const raw = localStorage.getItem(KEYS.settings);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserSettings>;
      if (parsed.uiLanguage === 'uz' || parsed.uiLanguage === 'en') return parsed.uiLanguage;
    }
  } catch { /* ignore */ }
  return 'en';
}

export function setUILanguage(lang: 'en' | 'uz') {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.uiLang, lang);
}

export function getSettings(): UserSettings {
  const stored = get<Partial<UserSettings>>(KEYS.settings, {});
  return { ...SETTINGS_DEFAULTS, ...stored, uiLanguage: getUILanguage() };
}

export function saveSettings(s: UserSettings) {
  setUILanguage(s.uiLanguage);
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

export function getProfilePicUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEYS.profilePicUrl) ?? null;
}

export function saveProfilePicUrl(url: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.profilePicUrl, url);
}

export function removeProfilePicUrl() {
  if (typeof window !== 'undefined') localStorage.removeItem(KEYS.profilePicUrl);
}

export function getNameUpdatedAt(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEYS.nameUpdatedAt) ?? null;
}

export function saveNameUpdatedAt(ts: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.nameUpdatedAt, ts);
}

export function getLevelUpdatedAt(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEYS.levelUpdatedAt) ?? null;
}

export function saveLevelUpdatedAt(ts: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.levelUpdatedAt, ts);
}

// ─── Learned words ───────────────────────────────────────────────────────────

export function getLearnedWords(): LearnedWord[] {
  return get<LearnedWord[]>(KEYS.learned, []);
}

export function saveLearnedWord(word: LearnedWord): boolean {
  const words = getLearnedWords();
  if (!words.find(w => w.word === word.word && w.collectionName === word.collectionName)) {
    words.push(word);
    set(KEYS.learned, words);
    return true;
  }
  return false;
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
  const date = localDateStr();
  const storedDate = get<string>(KEYS.todayCountDate, '');
  if (storedDate !== date) return 0;
  return get<number>(KEYS.todayCount, 0);
}

export function incrementTodayCount() {
  const date = localDateStr();
  const storedDate = get<string>(KEYS.todayCountDate, '');
  const count = storedDate === date ? get<number>(KEYS.todayCount, 0) : 0;
  set(KEYS.todayCount, count + 1);
  set(KEYS.todayCountDate, date);
}

// ─── SRS ─────────────────────────────────────────────────────────────────────

export function getSRSWords(): SRSWord[] {
  const words = get<SRSWord[]>(KEYS.srs, []);
  // One-time migration: backfill id for words synced from Flutter before it was included in the data blob
  if (words.some(w => !w.id)) {
    const fixed = words.map(w => w.id ? w : { ...w, id: `${w.collectionName}::${w.word}` });
    set(KEYS.srs, fixed);
    return fixed;
  }
  return words;
}

export function addSRSWord(word: SRSWord) {
  const words = getSRSWords();
  if (!words.find(w => w.id === word.id)) {
    words.push(word);
    set(KEYS.srs, words);
  }
}

export function localDateStr(d = new Date()): string {
  return d.toLocaleDateString('en-CA'); // yields YYYY-MM-DD in the user's local timezone
}

export function getDueWords(): SRSWord[] {
  const today = localDateStr();
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
  word.nextReviewDate = localDateStr(next);
  words[idx] = word;
  set(KEYS.srs, words);
}

export function getMasteredCount(): number {
  return getSRSWords().filter(w => w.reviewStage >= 4).length;
}

export function removeSRSWord(id: string) {
  set(KEYS.srs, getSRSWords().filter(w => w.id !== id));
}

export function resetSRSWord(id: string) {
  const words = getSRSWords();
  const idx = words.findIndex(w => w.id === id);
  if (idx === -1) return;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  words[idx] = { ...words[idx], reviewStage: 0, nextReviewDate: localDateStr(tomorrow) };
  set(KEYS.srs, words);
}

// ─── Streak ───────────────────────────────────────────────────────────────────

export function getStreak(): number {
  return get<number>(KEYS.streak, 0);
}

// ─── Streak freeze ────────────────────────────────────────────────────────────

export function getFreezes(): number {
  return get<number>(KEYS.freezes, 0);
}

export function getLastStudyDate(): string {
  return get<string>(KEYS.lastStudy, '');
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

export function getStudyDays(): string[] {
  return get<string[]>(KEYS.studyDays, []);
}

export function saveStudyDays(days: string[]) {
  set(KEYS.studyDays, days);
}

export function recordStudySession(): { freezeUsed: boolean } {
  const today = localDateStr();
  const last  = get<string>(KEYS.lastStudy, '');

  // Always record today in the study days list (idempotent)
  const days = getStudyDays();
  if (!days.includes(today)) {
    days.push(today);
    set(KEYS.studyDays, days);
  }

  if (last === today) return { freezeUsed: false };

  checkAndGrantWeeklyFreeze();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = localDateStr(yesterday);

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const tdStr = localDateStr(twoDaysAgo);

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
  const date = localDateStr();
  const storedDate = get<string>(KEYS.todayXpDate, '');
  if (storedDate !== date) return 0;
  return get<number>(KEYS.todayXp, 0);
}

export interface XpEntry {
  amount: number;
  reason: string;
  timestamp: number;
}

export function addXP(amount: number, reason = 'Study'): { leveledUp: boolean; newLevel: string; newXp: number } {
  const oldXp = get<number>(KEYS.xp, 0);
  const newXp = oldXp + amount;
  set(KEYS.xp, newXp);

  const date = localDateStr();
  const storedDate = get<string>(KEYS.todayXpDate, '');
  const todayXp = storedDate === date ? get<number>(KEYS.todayXp, 0) : 0;
  set(KEYS.todayXp, todayXp + amount);
  set(KEYS.todayXpDate, date);

  const history = get<XpEntry[]>(KEYS.xpHistory, []);
  history.push({ amount, reason, timestamp: Date.now() });
  if (history.length > 200) history.splice(0, history.length - 200);
  set(KEYS.xpHistory, history);

  const oldLevel = levelForXp(oldXp);
  const newLevel = levelForXp(newXp);
  return { leveledUp: oldLevel !== newLevel, newLevel, newXp };
}

export function getXPHistory(): XpEntry[] {
  return get<XpEntry[]>(KEYS.xpHistory, []).slice().reverse();
}

// ─── Unit Progress ───────────────────────────────────────────────────────────

export function getUnitProgress(collectionName: string, dayNumber: number): UnitProgress {
  const key = `${KEYS.unitProgress}_${collectionName}_${dayNumber}`;
  return get<UnitProgress>(key, { learnDone: false, flashcardDone: false, quizDone: false });
}

export function markLearningComplete(collectionName: string, dayNumber: number) {
  const key = `${KEYS.unitProgress}_${collectionName}_${dayNumber}`;
  const p = getUnitProgress(collectionName, dayNumber);
  const updated = { ...p, learnDone: true };
  if (updated.learnDone && updated.flashcardDone && updated.quizDone && !updated.completedAt) {
    updated.completedAt = new Date().toISOString();
  }
  set(key, updated);
}

export function markFlashcardComplete(collectionName: string, dayNumber: number) {
  const key = `${KEYS.unitProgress}_${collectionName}_${dayNumber}`;
  const p = getUnitProgress(collectionName, dayNumber);
  const updated = { ...p, flashcardDone: true };
  if (updated.learnDone && updated.flashcardDone && updated.quizDone && !updated.completedAt) {
    updated.completedAt = new Date().toISOString();
  }
  set(key, updated);
}

export function markQuizComplete(collectionName: string, dayNumber: number) {
  const key = `${KEYS.unitProgress}_${collectionName}_${dayNumber}`;
  const p = getUnitProgress(collectionName, dayNumber);
  const updated = { ...p, quizDone: true };
  if (updated.learnDone && updated.flashcardDone && updated.quizDone && !updated.completedAt) {
    updated.completedAt = new Date().toISOString();
  }
  set(key, updated);
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

export type HardWordEntry = { word: string; addedAt: string; removedAt?: string };

function getHardWordEntries(): HardWordEntry[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(KEYS.hardWords);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    // Migrate from old string[] format
    if (Array.isArray(parsed) && (parsed.length === 0 || typeof parsed[0] === 'string')) {
      return (parsed as string[]).map(w => ({ word: w, addedAt: new Date(0).toISOString() }));
    }
    return parsed as HardWordEntry[];
  } catch { return []; }
}

export { getHardWordEntries };

export function getHardWords(): string[] {
  return getHardWordEntries()
    .filter(e => !e.removedAt || e.addedAt > e.removedAt)
    .map(e => e.word);
}

export function addHardWord(word: string) {
  const entries = getHardWordEntries();
  const idx = entries.findIndex(e => e.word === word);
  const now = new Date().toISOString();
  if (idx === -1) {
    entries.push({ word, addedAt: now });
  } else {
    entries[idx] = { word, addedAt: now }; // re-add: clear any removedAt
  }
  set(KEYS.hardWords, entries);
}

export function removeHardWord(word: string) {
  const entries = getHardWordEntries();
  const idx = entries.findIndex(e => e.word === word);
  const now = new Date().toISOString();
  if (idx === -1) {
    // Word wasn't tracked locally — add a tombstone so the deletion propagates cross-device
    entries.push({ word, addedAt: new Date(0).toISOString(), removedAt: now });
  } else {
    entries[idx] = { ...entries[idx], removedAt: now };
  }
  set(KEYS.hardWords, entries);
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

// ─── Imported Words ──────────────────────────────────────────────────────────

const IMPORTED_KEY = 'lexivo_imported_words';
const FOLDER_MAP_KEY = 'lexivo_folder_map';
const DEFAULT_COLLECTION = 'My Words';

// Stores collection→folder mapping as a backup. Survives any pullAll wipe that
// strips folderName from word objects, because no sync code touches this key.
function getFolderMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(FOLDER_MAP_KEY) ?? '{}'); } catch { return {}; }
}

export function updateFolderMap(collectionName: string, folderName: string) {
  if (typeof window === 'undefined') return;
  const map = getFolderMap();
  map[collectionName] = folderName;
  localStorage.setItem(FOLDER_MAP_KEY, JSON.stringify(map));
}

export function getImportedWords(): ImportedWord[] {
  const folderMap = getFolderMap();
  return get<ImportedWord[]>(IMPORTED_KEY, []).map(w => {
    const col = w.collectionName ?? DEFAULT_COLLECTION;
    return {
      ...(w.collectionName ? w : { ...w, collectionName: DEFAULT_COLLECTION }),
      // Restore folderName from backup map if the word lost it (e.g. from old cached pullAll)
      folderName: w.folderName ?? folderMap[col],
    };
  });
}

export function getImportedWordsByCollection(collectionName: string, folderName?: string): ImportedWord[] {
  return getImportedWords().filter(w =>
    w.collectionName === collectionName &&
    (folderName === undefined ? !w.folderName : w.folderName === folderName)
  );
}

// ─── Class Homework Temp ──────────────────────────────────────────────────────
const CLASS_HW_TEMP_KEY = 'lexivo_class_hw_temp';
export interface ClassHWWord { word: string; translation: string; definition: string; example1: string; example1Translation: string; example2: string; example2Translation: string; className: string; }
export function saveClassHWTemp(words: ClassHWWord[]): void { if (typeof window !== 'undefined') localStorage.setItem(CLASS_HW_TEMP_KEY, JSON.stringify(words)); }
export function getClassHWTemp(): ClassHWWord[] { try { return JSON.parse(typeof window !== 'undefined' ? (localStorage.getItem(CLASS_HW_TEMP_KEY) ?? '[]') : '[]'); } catch { return []; } }

// Root-level collections (no folder)
export function getImportedCollections(): ImportedCollection[] {
  const words = getImportedWords().filter(w => !w.folderName);
  const map = new Map<string, { count: number; addedAt: number }>();
  for (const w of words) {
    const name = w.collectionName!;
    const entry = map.get(name);
    if (!entry) map.set(name, { count: 1, addedAt: w.addedAt });
    else entry.count++;
  }
  return Array.from(map.entries())
    .map(([name, { count, addedAt }]) => ({ name, count, addedAt }))
    .sort((a, b) => b.addedAt - a.addedAt);
}

// All folders, with collection count + word count
export function getImportedFolders(): ImportedFolder[] {
  const words = getImportedWords().filter(w => !!w.folderName);
  const map = new Map<string, { collections: Set<string>; wordCount: number; addedAt: number }>();
  for (const w of words) {
    const folder = w.folderName!;
    const entry = map.get(folder);
    if (!entry) map.set(folder, { collections: new Set([w.collectionName!]), wordCount: 1, addedAt: w.addedAt });
    else { entry.collections.add(w.collectionName!); entry.wordCount++; }
  }
  return Array.from(map.entries())
    .map(([name, { collections, wordCount, addedAt }]) => ({ name, collectionCount: collections.size, wordCount, addedAt }))
    .sort((a, b) => b.addedAt - a.addedAt);
}

// Collections within a specific folder
export function getCollectionsByFolder(folderName: string): ImportedCollection[] {
  const words = getImportedWords().filter(w => w.folderName === folderName);
  const map = new Map<string, { count: number; addedAt: number }>();
  for (const w of words) {
    const name = w.collectionName!;
    const entry = map.get(name);
    if (!entry) map.set(name, { count: 1, addedAt: w.addedAt });
    else entry.count++;
  }
  return Array.from(map.entries())
    .map(([name, { count, addedAt }]) => ({ name, count, addedAt, folderName }))
    .sort((a, b) => b.addedAt - a.addedAt);
}

export function addImportedWords(words: ImportedWord[], collectionName: string, folderName?: string) {
  const existing = getImportedWords();
  const existingSet = new Set(existing.map(w => w.word.toLowerCase().trim()));
  const fresh = words
    .filter(w => !existingSet.has(w.word.toLowerCase().trim()))
    .map(w => ({ ...w, collectionName, ...(folderName ? { folderName } : {}) }));
  set(IMPORTED_KEY, [...existing, ...fresh]);
  if (folderName) updateFolderMap(collectionName, folderName);
}

export function deleteImportedWord(word: string, collectionName: string, folderName?: string) {
  set(IMPORTED_KEY, getImportedWords().filter(w =>
    !(w.word === word && w.collectionName === collectionName &&
      (folderName === undefined ? !w.folderName : w.folderName === folderName))
  ));
}

export function deleteImportedCollection(collectionName: string, folderName?: string) {
  set(IMPORTED_KEY, getImportedWords().filter(w =>
    !(w.collectionName === collectionName &&
      (folderName === undefined ? !w.folderName : w.folderName === folderName))
  ));
}

export function deleteImportedFolder(folderName: string) {
  set(IMPORTED_KEY, getImportedWords().filter(w => w.folderName !== folderName));
}

export function saveImportedWords(words: ImportedWord[]) {
  set(IMPORTED_KEY, words);
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

// Clear all user-specific data from localStorage on sign-out.
// Preserves lexivo_ui_lang (device UI preference, not tied to a user account).
export function clearUserData(): void {
  if (typeof window === 'undefined') return;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.startsWith('lexivo_') && k !== 'lexivo_ui_lang') toRemove.push(k);
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}
