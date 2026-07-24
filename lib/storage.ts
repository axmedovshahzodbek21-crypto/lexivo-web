import type { SRSWord, DueSRSWord, LearnedWord, UnitProgress, UserSettings, Achievement, CustomList, WordItem, WordCollection, ImportedWord, ImportedCollection, ImportedFolder } from './types';
import { SRS_INTERVALS, LEVEL_THRESHOLDS, LEARN_XP_TIERS, STREAK_BONUS_7, STREAK_BONUS_30 } from './types';

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
  studyDays:    'lexivo_study_days',
  unitDoneDays: 'lexivo_unit_done_days',
  reviewDays:   'lexivo_review_days',
  wordGoalDays: 'lexivo_word_goal_days',
  reviewLog:    'lexivo_review_log',
  xpHistory: 'lexivo_xp_history',
  xpUpdatedAt:       'lexivo_xp_updated_at',
  streakBonusDate:   'lexivo_streak_bonus_date',
  settingsUpdatedAt: 'lexivo_settings_updated_at',
  hardWords:         'lexivo_hard_words',
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

export function getSettingsUpdatedAt(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEYS.settingsUpdatedAt) ?? null;
}

export function saveSettingsUpdatedAt(ts: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.settingsUpdatedAt, ts);
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
  const newCount = count + 1;
  set(KEYS.todayCount, newCount);
  set(KEYS.todayCountDate, date);
  if (newCount >= getSettings().dailyGoal) recordWordGoalDay();
}

// ─── SRS ─────────────────────────────────────────────────────────────────────

export function localDateStr(d = new Date()): string {
  return d.toLocaleDateString('en-CA'); // yields YYYY-MM-DD in the user's local timezone
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

function daysBetweenDateStrs(fromStr: string, toStr: string): number {
  const from = new Date(fromStr + 'T00:00:00');
  const to = new Date(toStr + 'T00:00:00');
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function getSRSWords(): SRSWord[] {
  const raw = get<any[]>(KEYS.srs, []); // eslint-disable-line @typescript-eslint/no-explicit-any
  let needsSave = false;
  const words: SRSWord[] = raw.map(w => {
    const learnedAt = w.learnedAt ?? w.learnedDate ?? localDateStr();
    if (!w.learnedAt || !w.id) needsSave = true;
    return {
      ...w,
      id: w.id ?? `${w.collectionName}::${w.word}`,
      learnedAt,
    } as SRSWord;
  });
  if (needsSave) set(KEYS.srs, words);
  return words;
}

export function addSRSWord(word: SRSWord) {
  const words = getSRSWords();
  if (!words.find(w => w.id === word.id)) {
    words.push(word);
    set(KEYS.srs, words);
  }
}

export function removeSRSWord(id: string) {
  set(KEYS.srs, getSRSWords().filter(w => w.id !== id));
}

// ─── Review log ──────────────────────────────────────────────────────────────
// reviewLog: { "2026-07-01": [1, 3, 7] } — completed intervals per learning date

export function getReviewLog(): Record<string, number[]> {
  return get<Record<string, number[]>>(KEYS.reviewLog, {});
}

export function saveReviewLog(log: Record<string, number[]>) {
  set(KEYS.reviewLog, log);
}

export function markIntervalDone(wordId: string, interval: number) {
  const log = getReviewLog();
  if (!log[wordId]) log[wordId] = [];
  if (!log[wordId].includes(interval)) log[wordId].push(interval);
  set(KEYS.reviewLog, log);

  // Graduated: all 5 intervals complete — remove this specific word from SRS store
  if (SRS_INTERVALS.every(i => log[wordId].includes(i))) {
    set(KEYS.srs, getSRSWords().filter(w => w.id !== wordId));
  }
}

// Removes all words for a learning date from SRS and resets their unit progress.
// Called when the 3-day unlearn rule triggers.
function unlearnDate(learnedDate: string) {
  const allWords = getSRSWords();
  const affected = allWords.filter(w => w.learnedAt === learnedDate);
  const log = getReviewLog();
  for (const w of affected) delete log[w.id];
  delete log[learnedDate]; // clean up any old date-keyed entries too
  set(KEYS.reviewLog, log);

  // Reset unit progress so words can be re-learned
  const unitKeys = new Set(affected.map(w => `${w.collectionName}||${w.dayNumber}`));
  for (const key of unitKeys) {
    const sep = key.indexOf('||');
    const col = key.slice(0, sep);
    const day = key.slice(sep + 2);
    set(`${KEYS.unitProgress}_${col}_${day}`, { learnDone: false, flashcardDone: false, quizDone: false });
  }

  // Remove from SRS store
  set(KEYS.srs, allWords.filter(w => w.learnedAt !== learnedDate));

  // Remove from learned words so the user can re-learn them fresh
  const affectedWords = new Set(affected.map(w => w.word));
  set(KEYS.learned, getLearnedWords().filter(w => !affectedWords.has(w.word)));
}

// One-time migration: pre-populate reviewLog from old reviewStage data so
// existing users don't lose their progress on first run of the new system.
function migrateReviewLogIfNeeded() {
  if (Object.keys(getReviewLog()).length > 0) return;
  const raw = get<any[]>(KEYS.srs, []); // eslint-disable-line @typescript-eslint/no-explicit-any
  if (raw.length === 0) return;

  const stageToIntervals: number[][] = [[], [1], [1, 3], [1, 3, 7], [1, 3, 7, 14]];
  const byDate = new Map<string, number>();
  for (const w of raw) {
    const date = w.learnedAt ?? w.learnedDate;
    if (!date) continue;
    const stage = Math.min(Math.max(w.reviewStage ?? 0, 0), 4);
    // take the minimum stage per date (most conservative)
    byDate.set(date, Math.min(byDate.get(date) ?? 99, stage));
  }

  const log: Record<string, number[]> = {};
  for (const [date, stage] of byDate) {
    log[date] = stageToIntervals[stage] ?? [];
  }
  set(KEYS.reviewLog, log);
}

// One-time migration: converts date-keyed log entries to per-word keys.
// Old: { "2026-07-01": [1, 3] }  →  New: { "Collection::word": [1, 3] }
function migrateReviewLogToPerWord() {
  const log = getReviewLog();
  if (Object.keys(log).length === 0) return;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!Object.keys(log).some(k => datePattern.test(k))) return; // already migrated

  const words = getSRSWords();
  const newLog: Record<string, number[]> = {};

  for (const [k, v] of Object.entries(log)) {
    if (!datePattern.test(k)) newLog[k] = v; // keep already-migrated entries
  }
  for (const w of words) {
    if (newLog[w.id]) continue;
    const intervals = log[w.learnedAt];
    if (intervals && intervals.length > 0) newLog[w.id] = [...intervals];
  }

  set(KEYS.reviewLog, newLog);
}

// Checks all SRS batches and unlearns any that are 2+ days overdue.
// Called automatically by getDueWords() but also exported for explicit use.
export function checkAndUnlearn(today: string = localDateStr()): void {
  const srsWords = getSRSWords();
  const log = getReviewLog();

  const byDate = new Map<string, SRSWord[]>();
  for (const w of srsWords) {
    if (!byDate.has(w.learnedAt)) byDate.set(w.learnedAt, []);
    byDate.get(w.learnedAt)!.push(w);
  }

  for (const [date, words] of byDate) {
    const nextInterval = SRS_INTERVALS.find(i => words.some(w => !(log[w.id] ?? []).includes(i)));
    if (nextInterval === undefined) continue; // all graduated

    const dueDate = addDaysToDateStr(date, nextInterval);
    if (daysBetweenDateStrs(dueDate, today) >= 2) unlearnDate(date);
  }
}

export function getDueWords(): DueSRSWord[] {
  migrateReviewLogIfNeeded();
  migrateReviewLogToPerWord();
  const today = localDateStr();
  checkAndUnlearn(today);
  const srsWords = getSRSWords();
  const log = getReviewLog();

  const result: DueSRSWord[] = [];

  for (const w of srsWords) {
    const completed = log[w.id] ?? [];
    const nextInterval = SRS_INTERVALS.find(i => !completed.includes(i));
    if (nextInterval === undefined) continue; // graduated

    const dueDate = addDaysToDateStr(w.learnedAt, nextInterval);
    if (dueDate > today) continue; // not yet due

    result.push({ ...w, dueInterval: nextInterval });
  }

  return result;
}

// Count words where all 5 intervals are completed
export function getGraduatedCount(): number {
  const log = getReviewLog();
  const srsWords = getSRSWords();
  const byDate = new Map<string, number>();
  for (const w of srsWords) {
    byDate.set(w.learnedAt, (byDate.get(w.learnedAt) ?? 0) + 1);
  }
  let count = 0;
  for (const [date, wordCount] of byDate) {
    if ((log[date] ?? []).length >= SRS_INTERVALS.length) count += wordCount;
  }
  return count;
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

  // Award streak bonus once per day
  const bonusDate = get<string>(KEYS.streakBonusDate, '');
  if (bonusDate !== today) {
    const bonus = streak >= 30 ? STREAK_BONUS_30 : streak >= 7 ? STREAK_BONUS_7 : 0;
    if (bonus > 0) {
      addXP(bonus, 'Streak Bonus');
      set(KEYS.streakBonusDate, today);
    }
  }

  return { freezeUsed };
}

export function getTotalStudyDays(): number {
  return get<number>(KEYS.totalDays, 0);
}

// ─── Daily Task Tracking (unit done / SRS review / word goal) ────────────────

export function getUnitDoneDays(): string[] { return get<string[]>(KEYS.unitDoneDays, []); }
export function saveUnitDoneDays(days: string[]) { set(KEYS.unitDoneDays, days); }
export function recordUnitDoneDay() {
  const today = localDateStr();
  const days = getUnitDoneDays();
  if (!days.includes(today)) { days.push(today); set(KEYS.unitDoneDays, days); }
}

export function getReviewDays(): string[] { return get<string[]>(KEYS.reviewDays, []); }
export function saveReviewDays(days: string[]) { set(KEYS.reviewDays, days); }
export function recordReviewDay() {
  const today = localDateStr();
  const days = getReviewDays();
  if (!days.includes(today)) { days.push(today); set(KEYS.reviewDays, days); }
}

export function getWordGoalDays(): string[] { return get<string[]>(KEYS.wordGoalDays, []); }
export function saveWordGoalDays(days: string[]) { set(KEYS.wordGoalDays, days); }
export function recordWordGoalDay() {
  const today = localDateStr();
  const days = getWordGoalDays();
  if (!days.includes(today)) { days.push(today); set(KEYS.wordGoalDays, days); }
}

export function getDayTasks(dateStr: string): { unit: boolean; review: boolean; words: boolean } {
  return {
    unit:   getUnitDoneDays().includes(dateStr),
    review: getReviewDays().includes(dateStr),
    words:  getWordGoalDays().includes(dateStr),
  };
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

// Stored ×10 integers; displayed value = raw ÷ 10
export function displayXP(raw: number): string {
  return (raw / 10).toFixed(1);
}

// Returns the XP to store (×10) based on how many words the user has ever learned
export function getLearnXPAmount(): number {
  const total = getLearnedWords().length;
  return (LEARN_XP_TIERS.find(t => total < t.maxWords) ?? LEARN_XP_TIERS[LEARN_XP_TIERS.length - 1]).xp;
}

export function addXP(amount: number, reason = 'Study'): { leveledUp: boolean; newLevel: string; newXp: number } {
  const oldXp = get<number>(KEYS.xp, 0);
  const newXp = oldXp + amount;
  set(KEYS.xp, newXp);
  set(KEYS.xpUpdatedAt, new Date().toISOString());

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

const MAX_IMPORTED_WORDS = 10_000;

function sanitizeImportedWord(w: ImportedWord): ImportedWord {
  const trunc = (s: string | undefined, max: number) => (s ?? '').slice(0, max);
  return {
    ...w,
    word:               trunc(w.word, 100),
    translation:        trunc(w.translation, 200),
    definition:         trunc(w.definition, 500),
    example1:           trunc(w.example1, 300),
    example1Translation:trunc(w.example1Translation, 300),
    example2:           trunc(w.example2, 300),
    example2Translation:trunc(w.example2Translation, 300),
    collectionName:     trunc(w.collectionName, 100),
    folderName:         w.folderName ? trunc(w.folderName, 100) : undefined,
  };
}

export function addImportedWords(words: ImportedWord[], collectionName: string, folderName?: string) {
  const existing = getImportedWords();
  const slots = Math.max(0, MAX_IMPORTED_WORDS - existing.length);
  if (slots === 0) return;
  const existingSet = new Set(existing.map(w => w.word.toLowerCase().trim()));
  const fresh = words
    .filter(w => w.word?.trim() && !existingSet.has(w.word.toLowerCase().trim()))
    .slice(0, slots)
    .map(w => sanitizeImportedWord({ ...w, collectionName, ...(folderName ? { folderName } : {}) }));
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
  set(IMPORTED_KEY, words.slice(0, MAX_IMPORTED_WORDS).map(sanitizeImportedWord));
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
  localStorage.removeItem(`lexivo_learn_marks_${collectionName}_${dayNumber}`);
}

export function saveLearnMarks(collectionName: string, dayNumber: number, tooHard: string[], skipped: string[]): void {
  set(`lexivo_learn_marks_${collectionName}_${dayNumber}`, { tooHard, skipped });
}

export function getLearnMarks(collectionName: string, dayNumber: number): { tooHard: string[]; skipped: string[] } | null {
  return get<{ tooHard: string[]; skipped: string[] } | null>(`lexivo_learn_marks_${collectionName}_${dayNumber}`, null);
}

export function getHardWordCount(collectionName: string, dayNumber: number): number {
  // Graduated words are removed from SRS, so any remaining word is still in progress
  return getSRSWords().filter(
    w => w.collectionName === collectionName && w.dayNumber === dayNumber
  ).length;
}

export function saveFlashcardProgress(collectionName: string, dayNumber: number, remainingWords: string[]): void {
  set(`lexivo_flashcard_idx_${collectionName}_${dayNumber}`, remainingWords);
}

export function getFlashcardProgress(collectionName: string, dayNumber: number): string[] | null {
  const val = get<unknown>(`lexivo_flashcard_idx_${collectionName}_${dayNumber}`, null);
  // Older saves stored a numeric index — treat as no progress (one-time migration loss is acceptable).
  if (Array.isArray(val) && val.length > 0) return val as string[];
  return null;
}

export function clearFlashcardProgress(collectionName: string, dayNumber: number): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`lexivo_flashcard_idx_${collectionName}_${dayNumber}`);
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
