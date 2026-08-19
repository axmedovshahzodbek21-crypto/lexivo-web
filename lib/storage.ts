import type { SRSWord, DueSRSWord, LearnedWord, UnitProgress, MyUnitProgress, UserSettings, Achievement, CustomList, WordItem, WordCollection, ImportedWord, ImportedWordExample, ImportedCollection, ImportedFolder } from './types';
import { SRS_INTERVALS, LEVEL_THRESHOLDS, LEARN_XP_TIERS, STREAK_BONUS_7, STREAK_BONUS_30 } from './types';
import { supabase } from './supabase';

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
  wordGoalDays:       'lexivo_word_goal_days',
  todayWordGoal:      'lexivo_today_word_goal',
  todayWordGoalDate:  'lexivo_today_word_goal_date',
  reviewLog:    'lexivo_review_log',
  srsLastReview: 'lexivo_srs_last_review',
  xpHistory: 'lexivo_xp_history',
  xpUpdatedAt:       'lexivo_xp_updated_at',
  streakBonusDate:   'lexivo_streak_bonus_date',
  lastCompleteDay:   'lexivo_last_complete_day',
  settingsUpdatedAt: 'lexivo_settings_updated_at',
  hardWords:         'lexivo_hard_words',
  flashTotalDays:    'lexivo_flash_total_days',
  flashStreak:       'lexivo_flash_streak',
  flashLastDay:      'lexivo_flash_last_day',
  quizTotalDays:     'lexivo_quiz_total_days',
  quizStreak:        'lexivo_quiz_streak',
  quizLastDay:       'lexivo_quiz_last_day',
  achievementDates:  'lexivo_achievement_dates',
  flashcardXpUnits:  'lexivo_flash_xp_units',
  quizXpUnits:       'lexivo_quiz_xp_units',
  matchXpUnits:      'lexivo_match_xp_units',
  myWordsXpUnits:    'lexivo_my_words_xp_units',
  srsLockedDays:     'lexivo_srs_locked_days',
  myUnitProgress:    'lexivo_my_unit_progress',
  focusDays:         'lexivo_focus_days',
  focusUpdatedAt:    'lexivo_focus_updated_at',
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
  pulseEnabled: true,
  pulseSpeed: 'normal',
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

// Includes tombstoned (deletedAt set) entries — internal use only, so
// read-modify-write callers don't silently erase tombstones on their next
// save. Use getLearnedWords() for anything user-facing.
export function getLearnedWordsRaw(): LearnedWord[] {
  return get<LearnedWord[]>(KEYS.learned, []);
}

export function getLearnedWords(): LearnedWord[] {
  return getLearnedWordsRaw().filter(w => !w.deletedAt);
}

export function saveLearnedWord(word: LearnedWord): boolean {
  const words = getLearnedWordsRaw();
  if (!words.find(w => !w.deletedAt && w.word === word.word && w.collectionName === word.collectionName)) {
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
  const today = localDateStr();
  return getLearnedWords().filter(
    w => w.learnedAt && localDateStr(new Date(w.learnedAt)) === today
  ).length;
}

export function incrementTodayCount() {
  const newCount = getTodayLearnedCount();
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

// Includes tombstoned (deletedAt set) entries — internal use only, so
// read-modify-write callers don't silently erase tombstones on their next
// save. Use getSRSWords() for anything user-facing.
export function getSRSWordsRaw(): SRSWord[] {
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

export function getSRSWords(): SRSWord[] {
  return getSRSWordsRaw().filter(w => !w.deletedAt);
}

export function addSRSWord(word: SRSWord) {
  const words = getSRSWordsRaw();
  if (!words.find(w => !w.deletedAt && w.id === word.id)) {
    words.push(word);
    set(KEYS.srs, words);
  }
}

export function removeSRSWord(id: string) {
  set(KEYS.srs, getSRSWordsRaw().filter(w => w.id !== id));
}

// ─── Review log ──────────────────────────────────────────────────────────────
// reviewLog: { "2026-07-01": [1, 3, 7] } — completed intervals per learning date

export function getReviewLog(): Record<string, number[]> {
  return get<Record<string, number[]>>(KEYS.reviewLog, {});
}

export function saveReviewLog(log: Record<string, number[]>) {
  set(KEYS.reviewLog, log);
}

export function getSRSLastReview(): Record<string, string> {
  return get<Record<string, string>>(KEYS.srsLastReview, {});
}

export function saveSRSLastReview(dates: Record<string, string>) {
  set(KEYS.srsLastReview, dates);
}

export function markIntervalDone(wordId: string, interval: number) {
  const log = getReviewLog();
  if (!log[wordId]) log[wordId] = [];
  if (!log[wordId].includes(interval)) log[wordId].push(interval);
  set(KEYS.reviewLog, log);

  // Record the date this review was done so getDueWords can compute the
  // next due date from the review date (matching Flutter's behaviour).
  const dates = getSRSLastReview();
  dates[wordId] = localDateStr();
  saveSRSLastReview(dates);
  // Graduated words stay in lexivo_srs_words so the Manage deck can show them.
  // getDueWords already skips them (no nextInterval found), so they won't resurface as due.
}

// Recomputes whether a unit's learnDone flag still holds, given the words
// currently tombstoned out of the SRS pool for that specific unit — instead
// of a blanket reset, this only demotes a unit that's actually missing a
// word, leaving unrelated units (and unrelated words that merely happened
// to be learned in the same session) untouched.
function recomputeUnitLearnDone(collectionName: string, dayNumber: number) {
  const key = `${KEYS.unitProgress}_${collectionName}_${dayNumber}`;
  const p = getUnitProgress(collectionName, dayNumber);
  if (!p.learnDone) return; // already not-done, nothing to demote

  const unitWords = getSRSWordsRaw().filter(w => w.collectionName === collectionName && w.dayNumber === dayNumber);
  const stillMissingAWord = unitWords.some(w => w.deletedAt);
  if (stillMissingAWord) {
    set(key, { learnDone: false, flashcardDone: false, quizDone: false });
  }
}

// Removes a single stale word from SRS and its review history, and demotes
// its unit's learnDone flag only if that unit is now genuinely missing a
// word — not the whole learnedAt-dated batch it happened to be learned
// alongside. Called when the 3-day unlearn rule triggers.
function unlearnWord(w: SRSWord) {
  const log = getReviewLog();
  delete log[w.id];
  set(KEYS.reviewLog, log);

  const lastReview = getSRSLastReview();
  delete lastReview[w.id];
  saveSRSLastReview(lastReview);

  // Tombstone (not remove) so the unlearn propagates across devices instead
  // of being silently undone by the next pull's additive-only merge, which
  // would otherwise just see the word missing locally and re-add it back
  // from a cloud copy that doesn't know it was unlearned.
  const now = Date.now();
  const rawSRS = getSRSWordsRaw();
  set(KEYS.srs, rawSRS.map(x => x.id === w.id ? { ...x, deletedAt: now } : x));

  // Scoped to the same collection, not just a matching word string — the
  // same word can appear in more than one collection/unit, and only this
  // one's copy went stale.
  const rawLearned = getLearnedWordsRaw();
  set(KEYS.learned, rawLearned.map(x =>
    (x.word === w.word && x.collectionName === w.collectionName) ? { ...x, deletedAt: now } : x
  ));

  recomputeUnitLearnDone(w.collectionName, w.dayNumber);
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

// Unlearns any SRS word whose next review is 3+ days overdue.
// Called automatically by getDueWords() but also exported for explicit use.
export function checkAndUnlearn(today: string = localDateStr()): void {
  const srsWords = getSRSWords();
  const log = getReviewLog();
  const lastReview = getSRSLastReview();

  const staleWords: SRSWord[] = [];

  for (const w of srsWords) {
    const completed = log[w.id] ?? [];
    const nextInterval = SRS_INTERVALS.find(i => !completed.includes(i));
    if (nextInterval === undefined) continue; // graduated

    const baseDate = lastReview[w.id] ?? w.learnedAt;
    const dueDate = addDaysToDateStr(baseDate, nextInterval);
    if (daysBetweenDateStrs(dueDate, today) >= 3) {
      staleWords.push(w);
    }
  }

  for (const w of staleWords) {
    unlearnWord(w);
  }

  // Push immediately so the tombstones (and unit-progress reset) reach the
  // server right away instead of waiting for some unrelated future write.
  // Dynamic import avoids a circular dependency (sync.ts imports storage.ts).
  if (staleWords.length > 0) {
    import('./sync').then(m => m.pushLists()).catch(() => {});
  }
}

export function getDueWords(): DueSRSWord[] {
  migrateReviewLogIfNeeded();
  migrateReviewLogToPerWord();
  const today = localDateStr();
  checkAndUnlearn(today);
  const srsWords = getSRSWords();
  const log = getReviewLog();
  const lastReview = getSRSLastReview();

  const result: DueSRSWord[] = [];

  for (const w of srsWords) {
    const completed = log[w.id] ?? [];
    const nextInterval = SRS_INTERVALS.find(i => !completed.includes(i));
    if (nextInterval === undefined) continue; // graduated

    const baseDate = lastReview[w.id] ?? w.learnedAt;
    const dueDate = addDaysToDateStr(baseDate, nextInterval);
    if (dueDate > today) continue; // not yet due

    result.push({ ...w, dueInterval: nextInterval });
  }

  return result;
}

// Count words where all 5 intervals are completed
export function getGraduatedCount(): number {
  const log = getReviewLog();
  let count = 0;
  for (const completed of Object.values(log)) {
    if (SRS_INTERVALS.every(i => completed.includes(i))) count++;
  }
  return count;
}

// ─── Streak ───────────────────────────────────────────────────────────────────

export function getStreak(): number {
  const stored = get<number>(KEYS.streak, 0);
  if (stored <= 0) return 0;

  // Validate: reset if no complete day (both tasks done) in the last 2 days
  const today = localDateStr();
  const yesterday = localDateStr(new Date(Date.now() - 86400000));
  const twoDaysAgo = localDateStr(new Date(Date.now() - 86400000 * 2));
  const reviewSet = new Set(getReviewDays());
  const wordSet   = new Set(getWordGoalDays());
  const isComplete = (d: string) => reviewSet.has(d) && wordSet.has(d);

  if (isComplete(today) || isComplete(yesterday)) return stored;
  if (isComplete(twoDaysAgo) && get<number>(KEYS.freezes, 0) > 0) return stored;

  set(KEYS.streak, 0);
  return 0;
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

  const days = getStudyDays();
  if (!days.includes(today)) {
    days.push(today);
    set(KEYS.studyDays, days);
  }

  if (last === today) return { freezeUsed: false };

  set(KEYS.lastStudy, today);
  set(KEYS.totalDays, get<number>(KEYS.totalDays, 0) + 1);

  return { freezeUsed: false };
}

// Called from recordReviewDay() and recordWordGoalDay() — only fires once per day
// when BOTH tasks are complete (review done + word goal met).
function checkAndUpdateStreak() {
  const today = localDateStr();
  if (get<string>(KEYS.lastCompleteDay, '') === today) return;

  const reviewDaysArr = get<string[]>(KEYS.reviewDays, []);
  const wordGoalDaysArr = get<string[]>(KEYS.wordGoalDays, []);
  if (!reviewDaysArr.includes(today) || !wordGoalDaysArr.includes(today)) return;

  set(KEYS.lastCompleteDay, today);

  const yesterday = localDateStr(new Date(Date.now() - 86400000));
  const twoDaysAgo = localDateStr(new Date(Date.now() - 86400000 * 2));
  const reviewSet = new Set(reviewDaysArr);
  const wordSet   = new Set(wordGoalDaysArr);
  const isComplete = (d: string) => reviewSet.has(d) && wordSet.has(d);

  let streak = get<number>(KEYS.streak, 0);

  if (isComplete(yesterday)) {
    streak += 1;
  } else if (isComplete(twoDaysAgo) && get<number>(KEYS.freezes, 0) > 0) {
    set(KEYS.freezes, get<number>(KEYS.freezes, 0) - 1);
    streak += 1;
  } else {
    streak = 1;
  }

  set(KEYS.streak, streak);

  // Grant weekly freeze now that streak is active
  checkAndGrantWeeklyFreeze();

  // Streak bonus XP
  const bonusDate = get<string>(KEYS.streakBonusDate, '');
  if (bonusDate !== today) {
    const bonus = streak >= 30 ? STREAK_BONUS_30 : streak >= 7 ? STREAK_BONUS_7 : 0;
    if (bonus > 0) {
      addXP(bonus, 'Streak Bonus');
      set(KEYS.streakBonusDate, today);
    }
  }
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
  checkAndUpdateStreak();
}

export function getWordGoalDays(): string[] { return get<string[]>(KEYS.wordGoalDays, []); }
export function saveWordGoalDays(days: string[]) { set(KEYS.wordGoalDays, days); }
export function recordWordGoalDay() {
  const today = localDateStr();
  const days = getWordGoalDays();
  if (!days.includes(today)) { days.push(today); set(KEYS.wordGoalDays, days); }
  checkAndUpdateStreak();
}


export function getSRSLockedDays(): string[] { return get<string[]>(KEYS.srsLockedDays, []); }
export function saveSRSLockedDays(days: string[]) { set(KEYS.srsLockedDays, days); }
export function recordSRSLockedDay() {
  const today = localDateStr();
  const days = getSRSLockedDays();
  if (!days.includes(today)) { days.push(today); set(KEYS.srsLockedDays, days); }
}

// ─── Focus time (Pomodoro) ────────────────────────────────────────────────────
// Seconds of actual work-phase time per day, including partial (paused/reset)
// sessions — a session only ever adds what was truly spent focusing.

export function getFocusDays(): Record<string, number> {
  return get<Record<string, number>>(KEYS.focusDays, {});
}

export function addFocusSeconds(seconds: number): void {
  if (seconds <= 0) return;
  const today = localDateStr();
  const days = getFocusDays();
  days[today] = (days[today] ?? 0) + seconds;
  set(KEYS.focusDays, days);
  set(KEYS.focusUpdatedAt, new Date().toISOString());
}

export function getTodayFocusSeconds(): number {
  return getFocusDays()[localDateStr()] ?? 0;
}

export function getWeekFocusSeconds(): number {
  const days = getFocusDays();
  let total = 0;
  for (let i = 0; i < 7; i++) {
    total += days[localDateStr(new Date(Date.now() - i * 86400000))] ?? 0;
  }
  return total;
}

export function getTotalFocusSeconds(): number {
  return Object.values(getFocusDays()).reduce((sum, s) => sum + s, 0);
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
  source?: string;
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

function _pushXpEntryAsync(entry: XpEntry): void {
  if (typeof window === 'undefined') return;
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) return;
    Promise.resolve(supabase.from('xp_history').upsert({
      user_id: session.user.id,
      amount: entry.amount,
      reason: entry.reason,
      source: entry.source ?? null,
      ts: entry.timestamp,
    }, { onConflict: 'user_id,ts', ignoreDuplicates: true } as Record<string, unknown>)).catch(() => {});
  }).catch(() => {});
}

export function addXP(amount: number, reason = 'Study', source?: string): { leveledUp: boolean; newLevel: string; newXp: number } {
  const oldXp = get<number>(KEYS.xp, 0);
  const newXp = oldXp + amount;
  set(KEYS.xp, newXp);
  set(KEYS.xpUpdatedAt, new Date().toISOString());

  const date = localDateStr();
  const storedDate = get<string>(KEYS.todayXpDate, '');
  const todayXp = storedDate === date ? get<number>(KEYS.todayXp, 0) : 0;
  set(KEYS.todayXp, todayXp + amount);
  set(KEYS.todayXpDate, date);

  const ts = Date.now();
  const entry: XpEntry = { amount, reason, timestamp: ts, ...(source ? { source } : {}) };
  const history = get<XpEntry[]>(KEYS.xpHistory, []);
  history.push(entry);
  if (history.length > 500) history.splice(0, history.length - 500);
  set(KEYS.xpHistory, history);

  _pushXpEntryAsync(entry);

  const oldLevel = levelForXp(oldXp);
  const newLevel = levelForXp(newXp);
  return { leveledUp: oldLevel !== newLevel, newLevel, newXp };
}

export function getXPHistory(): XpEntry[] {
  return get<XpEntry[]>(KEYS.xpHistory, []).slice().reverse();
}

export async function fetchXPHistory(): Promise<XpEntry[]> {
  const local = get<XpEntry[]>(KEYS.xpHistory, []);
  if (typeof window === 'undefined') return local.slice().reverse();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return local.slice().reverse();
    const { data } = await supabase
      .from('xp_history')
      .select('amount,reason,source,ts')
      .eq('user_id', session.user.id)
      .order('ts', { ascending: false })
      .limit(500);
    if (!data || data.length === 0) return local.slice().reverse();
    const localTs = new Set(local.map(e => e.timestamp));
    const toAdd: XpEntry[] = [];
    for (const row of data) {
      const ts = row.ts as number;
      if (!localTs.has(ts)) {
        toAdd.push({ amount: row.amount as number, reason: row.reason as string, timestamp: ts,
          ...(row.source ? { source: row.source as string } : {}) });
      }
    }
    if (toAdd.length > 0) {
      const merged = [...local, ...toAdd].sort((a, b) => a.timestamp - b.timestamp);
      if (merged.length > 500) merged.splice(0, merged.length - 500);
      set(KEYS.xpHistory, merged);
      return merged.slice().reverse();
    }
    return local.slice().reverse();
  } catch {
    return local.slice().reverse();
  }
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

export function markMatchComplete(collectionName: string, dayNumber: number) {
  const key = `${KEYS.unitProgress}_${collectionName}_${dayNumber}`;
  const p = getUnitProgress(collectionName, dayNumber);
  set(key, { ...p, matchDone: true });
}

// ─── My Words Unit Progress ───────────────────────────────────────────────────
// Unlike the curated collections above, a My Words unit can grow at any time.
// Each activity keeps its own word-list snapshot (learnWords etc.), taken the
// moment that activity is marked done — independent of whether the other
// three activities have ever run. So "new word" detection works per activity:
// if only Learn was done and the unit grows, Learn alone can offer just the
// new words, without needing Flashcards/Quiz/Match to have been done first.
// completedAt/completedWords separately track the whole-unit "all four done"
// milestone, used for the "🏆 Completed" badge.

type MyActivity = 'learn' | 'flashcard' | 'quiz' | 'match';
const MY_ACTIVITIES: MyActivity[] = ['learn', 'flashcard', 'quiz', 'match'];

function myUnitProgressKey(folderName: string | undefined, collectionName: string): string {
  return `${KEYS.myUnitProgress}_${folderName ?? ''}_${collectionName}`;
}

export function getMyUnitProgress(folderName: string | undefined, collectionName: string): MyUnitProgress {
  const defaults: MyUnitProgress = {
    learnDone: false, flashcardDone: false, quizDone: false, matchDone: false,
    learnWords: [], flashcardWords: [], quizWords: [], matchWords: [],
    completedWords: [],
  };
  // Merge over defaults, not just substitute on a missing key — records
  // stored before the per-activity word-list fields existed would otherwise
  // deserialize with those fields `undefined` instead of `[]`.
  return { ...defaults, ...get<Partial<MyUnitProgress>>(myUnitProgressKey(folderName, collectionName), {}) };
}

// Returns true when this call is what just brought the unit to full
// completion (all four activities done), so callers can fire a one-time
// celebration — not true on every call, and not true again on redos.
function markMyUnitActivityComplete(
  folderName: string | undefined,
  collectionName: string,
  activity: MyActivity,
): boolean {
  const key = myUnitProgressKey(folderName, collectionName);
  const p = getMyUnitProgress(folderName, collectionName);
  const wasComplete = p.learnDone && p.flashcardDone && p.quizDone && p.matchDone;
  const currentWords = getImportedWordsByCollection(collectionName, folderName).map(w => w.word);
  const updated: MyUnitProgress = { ...p, [`${activity}Done`]: true, [`${activity}Words`]: currentWords };
  const nowComplete = updated.learnDone && updated.flashcardDone && updated.quizDone && updated.matchDone;
  if (nowComplete) {
    updated.completedWords = currentWords;
    updated.completedAt = new Date().toISOString();
  }
  set(key, updated);
  return nowComplete && !wasComplete;
}

export const markMyLearnComplete      = (folderName: string | undefined, collectionName: string) => markMyUnitActivityComplete(folderName, collectionName, 'learn');
export const markMyFlashcardComplete  = (folderName: string | undefined, collectionName: string) => markMyUnitActivityComplete(folderName, collectionName, 'flashcard');
export const markMyQuizComplete       = (folderName: string | undefined, collectionName: string) => markMyUnitActivityComplete(folderName, collectionName, 'quiz');
export const markMyMatchComplete      = (folderName: string | undefined, collectionName: string) => markMyUnitActivityComplete(folderName, collectionName, 'match');

// Words not yet covered by this specific activity's last snapshot. Empty
// whenever the activity has never been done — its next run naturally
// includes everything, so there's nothing to flag as "new" ahead of time.
//
// Migration note: units completed before per-activity snapshots existed have
// an empty e.g. learnWords even though learnDone is true. In that case we
// fall back to completedWords (the old whole-unit snapshot) as a best-effort
// stand-in, so pre-existing completed units don't suddenly show every word
// as "new". Units that had only *some* activities done (never fully
// completed) predate this feature entirely and have no snapshot to fall back
// on — they'll start tracking correctly from the next time that activity runs.
export function getMyActivityPendingNewWords(
  folderName: string | undefined,
  collectionName: string,
  activity: MyActivity,
  currentWords: string[],
): string[] {
  const p = getMyUnitProgress(folderName, collectionName);
  const done = { learn: p.learnDone, flashcard: p.flashcardDone, quiz: p.quizDone, match: p.matchDone }[activity];
  if (!done) return [];
  let snapshot = { learn: p.learnWords, flashcard: p.flashcardWords, quiz: p.quizWords, match: p.matchWords }[activity];
  if (snapshot.length === 0 && p.completedWords.length > 0) snapshot = p.completedWords;
  const snapshotSet = new Set(snapshot);
  return currentWords.filter(w => !snapshotSet.has(w));
}

// Union of words pending for any activity that's actually done — used for
// the unit-level "Completed · N new words to learn" banner text.
export function getMyUnitPendingNewWords(folderName: string | undefined, collectionName: string, currentWords: string[]): string[] {
  const pending = new Set<string>();
  for (const activity of MY_ACTIVITIES) {
    for (const w of getMyActivityPendingNewWords(folderName, collectionName, activity, currentWords)) pending.add(w);
  }
  return currentWords.filter(w => pending.has(w));
}

// Clears all My Words unit progress (per-activity done-flags, word snapshots,
// completion badges) and their XP-awarded markers, for every folder/unit —
// but leaves the imported words/folders themselves untouched. Distinct from
// the Settings "Reset Progress" action, which resets curated-collection
// progress; this is scoped to My Words only, triggerable from within My Words.
export function resetMyWordsProgress(): void {
  if (typeof window === 'undefined') return;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(`${KEYS.myUnitProgress}_`)) toRemove.push(k);
  }
  toRemove.forEach(k => localStorage.removeItem(k));
  localStorage.removeItem(KEYS.myWordsXpUnits);
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

export function unlockAchievement(id: string, xpRaw = 0): boolean {
  const unlocked = getUnlockedAchievements();
  if (unlocked.includes(id)) return false;
  unlocked.push(id);
  set(KEYS.achievements, unlocked);
  const dates = get<Record<string, string>>(KEYS.achievementDates, {});
  if (!dates[id]) { dates[id] = new Date().toISOString(); set(KEYS.achievementDates, dates); }
  if (xpRaw > 0) addXP(xpRaw, 'Achievement', id);
  return true;
}

export function getAchievementDate(id: string): string | null {
  return get<Record<string, string>>(KEYS.achievementDates, {})[id] ?? null;
}

function _recordActivityDay(totalKey: string, streakKey: string, lastKey: string) {
  const today = localDateStr();
  const last = get<string>(lastKey, '');
  if (last === today) return;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yk = localDateStr(yesterday);
  const streak = last === yk ? get<number>(streakKey, 0) + 1 : 1;
  set(lastKey, today);
  set(totalKey, get<number>(totalKey, 0) + 1);
  set(streakKey, streak);
}

export function recordFlashcardSession() { _recordActivityDay(KEYS.flashTotalDays, KEYS.flashStreak, KEYS.flashLastDay); }
export function getFlashcardTotalDays(): number { return get<number>(KEYS.flashTotalDays, 0); }
export function getFlashcardStreak(): number { return get<number>(KEYS.flashStreak, 0); }

export function recordQuizSession() { _recordActivityDay(KEYS.quizTotalDays, KEYS.quizStreak, KEYS.quizLastDay); }
export function getQuizTotalDays(): number { return get<number>(KEYS.quizTotalDays, 0); }
export function getQuizStreak(): number { return get<number>(KEYS.quizStreak, 0); }

// ─── One-time flashcard / quiz XP per unit ───────────────────────────────────

function _unitKey(collectionName: string, dayNumber: number) { return `${collectionName}_${dayNumber}`; }

export function hasFlashcardXPAwarded(collectionName: string, dayNumber: number): boolean {
  return get<string[]>(KEYS.flashcardXpUnits, []).includes(_unitKey(collectionName, dayNumber));
}
export function markFlashcardXPAwarded(collectionName: string, dayNumber: number): void {
  const list = get<string[]>(KEYS.flashcardXpUnits, []);
  const k = _unitKey(collectionName, dayNumber);
  if (!list.includes(k)) { list.push(k); set(KEYS.flashcardXpUnits, list); }
}

export function hasQuizXPAwarded(collectionName: string, dayNumber: number): boolean {
  return get<string[]>(KEYS.quizXpUnits, []).includes(_unitKey(collectionName, dayNumber));
}
export function markQuizXPAwarded(collectionName: string, dayNumber: number): void {
  const list = get<string[]>(KEYS.quizXpUnits, []);
  const k = _unitKey(collectionName, dayNumber);
  if (!list.includes(k)) { list.push(k); set(KEYS.quizXpUnits, list); }
}

export function hasMatchXPAwarded(collectionName: string, dayNumber: number): boolean {
  return get<string[]>(KEYS.matchXpUnits, []).includes(_unitKey(collectionName, dayNumber));
}
export function markMatchXPAwarded(collectionName: string, dayNumber: number): void {
  const list = get<string[]>(KEYS.matchXpUnits, []);
  const k = _unitKey(collectionName, dayNumber);
  if (!list.includes(k)) { list.push(k); set(KEYS.matchXpUnits, list); }
}

// One-time XP per My Words unit per activity (learn is awarded per-word elsewhere,
// so this only covers flashcard/quiz/match — same "once per unit" rule as the
// curated-collection XP above, keyed by folder+collection instead of day number).
function _myWordsUnitKey(activity: string, folderName: string | undefined, collectionName: string) {
  return `${activity}_${folderName ?? ''}_${collectionName}`;
}
export function hasMyWordsXPAwarded(activity: 'flashcard' | 'quiz' | 'match', folderName: string | undefined, collectionName: string): boolean {
  return get<string[]>(KEYS.myWordsXpUnits, []).includes(_myWordsUnitKey(activity, folderName, collectionName));
}
export function markMyWordsXPAwarded(activity: 'flashcard' | 'quiz' | 'match', folderName: string | undefined, collectionName: string): void {
  const list = get<string[]>(KEYS.myWordsXpUnits, []);
  const k = _myWordsUnitKey(activity, folderName, collectionName);
  if (!list.includes(k)) { list.push(k); set(KEYS.myWordsXpUnits, list); }
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

// Stores collection→folder mapping as a backup.
function getFolderMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(FOLDER_MAP_KEY) ?? '{}'); } catch { return {}; }
}

// Migrates old-shape records (fixed example1..5 fields) into the current
// `examples[]` array shape, for words stored/synced before that change.
function normalizeImportedWord(raw: Record<string, unknown>): ImportedWord {
  let examples: ImportedWordExample[];
  if (Array.isArray(raw.examples)) {
    examples = raw.examples as ImportedWordExample[];
  } else {
    examples = [];
    for (let i = 1; i <= 5; i++) {
      const sentence = raw[`example${i}`] as string | undefined;
      const translation = raw[`example${i}Translation`] as string | undefined;
      if (sentence) examples.push({ sentence, translation: translation || undefined });
    }
  }
  return {
    word: (raw.word as string) ?? '',
    partOfSpeech: raw.partOfSpeech as string | undefined,
    pronunciation: raw.pronunciation as string | undefined,
    translation: (raw.translation as string) ?? '',
    definition: (raw.definition as string) ?? '',
    definitionUz: raw.definitionUz as string | undefined,
    examples,
    language: (raw.language as string) ?? 'en-US',
    addedAt: (raw.addedAt as number) ?? 0,
    collectionName: raw.collectionName as string | undefined,
    folderName: raw.folderName as string | undefined,
    deletedAt: raw.deletedAt as number | undefined,
  };
}

export function updateFolderMap(collectionName: string, folderName: string) {
  if (typeof window === 'undefined') return;
  const map = getFolderMap();
  map[collectionName] = folderName;
  localStorage.setItem(FOLDER_MAP_KEY, JSON.stringify(map));
}

// Includes soft-deleted (tombstoned) words. Only sync push/merge logic should
// use this — everything else should use getImportedWords() below, which hides
// tombstones. Deletions are kept as tombstones (rather than removed outright)
// so they can propagate to other devices instead of the deleted word silently
// reappearing on next sync pull.
export function getImportedWordsRaw(): ImportedWord[] {
  const folderMap = getFolderMap();
  return get<Record<string, unknown>[]>(IMPORTED_KEY, []).map(raw => {
    const w = normalizeImportedWord(raw);
    const col = w.collectionName ?? DEFAULT_COLLECTION;
    return {
      ...(w.collectionName ? w : { ...w, collectionName: DEFAULT_COLLECTION }),
      // Restore folderName from backup map if the word lost it (e.g. from old cached pullAll)
      folderName: w.folderName ?? folderMap[col],
    };
  });
}

export function getImportedWords(): ImportedWord[] {
  return getImportedWordsRaw().filter(w => !w.deletedAt);
}

export function getImportedWordsByCollection(collectionName: string, folderName?: string): ImportedWord[] {
  return getImportedWords().filter(w =>
    w.collectionName === collectionName &&
    (folderName === undefined ? !w.folderName : w.folderName === folderName)
  );
}

// Folds an ImportedWord's unlimited examples[] into the app-wide WordItem/
// StudyWord shape (fixed example1-3 + extraExamples/extraExampleTranslations),
// used everywhere words are studied (Learn, Flashcards, Quiz, Matching).
export function importedWordExampleFields(w: ImportedWord) {
  const ex = w.examples ?? [];
  return {
    example1: ex[0]?.sentence ?? '',
    example1Situation: '',
    example1Translation: ex[0]?.translation ?? '',
    example2: ex[1]?.sentence ?? '',
    example2Situation: '',
    example2Translation: ex[1]?.translation ?? '',
    example3: ex[2]?.sentence ?? '',
    example3Situation: '',
    example3Translation: ex[2]?.translation ?? '',
    extraExamples: ex.slice(3).map(e => e.sentence),
    extraExampleTranslations: ex.slice(3).map(e => e.translation ?? ''),
  };
}

// ─── Class Homework Temp ──────────────────────────────────────────────────────
const CLASS_HW_TEMP_KEY = 'lexivo_class_hw_temp';
export interface ClassHWWord { word: string; translation: string; definition: string; partOfSpeech: string; pronunciation: string; definitionUz: string; example1: string; example1Translation: string; example2: string; example2Translation: string; example3: string; example3Translation: string; extraExamples: string[]; extraExampleTranslations: string[]; className: string; }
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

const MAX_EXAMPLES_PER_WORD = 10;

function sanitizeImportedWord(w: ImportedWord): ImportedWord {
  const trunc = (s: string | undefined, max: number) => (s ?? '').slice(0, max);
  return {
    ...w,
    word:               trunc(w.word, 100),
    translation:        trunc(w.translation, 200),
    definition:         trunc(w.definition, 500),
    examples: (w.examples ?? []).slice(0, MAX_EXAMPLES_PER_WORD).map(ex => ({
      sentence:    trunc(ex.sentence, 300),
      translation: ex.translation ? trunc(ex.translation, 300) : undefined,
    })),
    collectionName:     trunc(w.collectionName, 100),
    folderName:         w.folderName ? trunc(w.folderName, 100) : undefined,
  };
}

export function addImportedWords(words: ImportedWord[], collectionName: string, folderName?: string) {
  const raw = getImportedWordsRaw();
  const live = raw.filter(w => !w.deletedAt);
  const slots = Math.max(0, MAX_IMPORTED_WORDS - live.length);
  if (slots === 0) return;
  // Dedupe against live words only — re-importing a word that was previously
  // deleted (a tombstone) is allowed, so it comes back as a fresh entry.
  const existingSet = new Set(live.map(w => w.word.toLowerCase().trim()));
  const fresh = words
    .filter(w => w.word?.trim() && !existingSet.has(w.word.toLowerCase().trim()))
    .slice(0, slots)
    .map(w => sanitizeImportedWord({ ...w, collectionName, ...(folderName ? { folderName } : {}) }));
  set(IMPORTED_KEY, [...raw, ...fresh]);
  if (folderName) updateFolderMap(collectionName, folderName);
  // No longer resetting the four done-flags here: per-activity word
  // snapshots (see getMyActivityPendingNewWords) now detect exactly which
  // words are new for each activity, so there's no need to force a full
  // redo — the existing ✅ badges stay, with a "N new" indicator alongside.
}

// Soft-delete: mark with a tombstone timestamp instead of removing outright,
// so the deletion syncs to (and takes effect on) other devices too.
export function deleteImportedWord(word: string, collectionName: string, folderName?: string) {
  const now = Date.now();
  set(IMPORTED_KEY, getImportedWordsRaw().map(w =>
    (w.word === word && w.collectionName === collectionName &&
      (folderName === undefined ? !w.folderName : w.folderName === folderName))
      ? { ...w, deletedAt: now }
      : w
  ));
}

export function deleteImportedCollection(collectionName: string, folderName?: string) {
  const now = Date.now();
  set(IMPORTED_KEY, getImportedWordsRaw().map(w =>
    (w.collectionName === collectionName &&
      (folderName === undefined ? !w.folderName : w.folderName === folderName))
      ? { ...w, deletedAt: now }
      : w
  ));
}

export function deleteImportedFolder(folderName: string) {
  const now = Date.now();
  set(IMPORTED_KEY, getImportedWordsRaw().map(w => w.folderName === folderName ? { ...w, deletedAt: now } : w));
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

// ─── Story Unlock ────────────────────────────────────────────────────────────

export interface StoryUnlockInfo {
  story1Unlocked: boolean;
  story2Unlocked: boolean;
  story3Unlocked: boolean;
  anyUnlocked: boolean;
  unlockedCount: number;
}

const STORY_COLLECTIONS = new Set([
  '30 Days of Powerful Words',
  '24 Vocabulary Challenge',
  'Word Mastery',
]);

export function getStoryUnlockInfo(
  collectionName: string,
  dayNumber: number,
  totalWords: number,
): StoryUnlockInfo {
  const none: StoryUnlockInfo = {
    story1Unlocked: false, story2Unlocked: false, story3Unlocked: false,
    anyUnlocked: false, unlockedCount: 0,
  };
  if (!STORY_COLLECTIONS.has(collectionName)) return none;

  const srsWords = getSRSWords().filter(
    w => w.collectionName === collectionName && w.dayNumber === dayNumber,
  );
  if (srsWords.length === 0) return none;

  const log = getReviewLog();
  const threshold = Math.ceil(totalWords * 0.8);
  const stage4Count = srsWords.filter(w => (log[w.id] ?? []).includes(14)).length;
  const stage5Count = srsWords.filter(w => (log[w.id] ?? []).includes(30)).length;

  const story1 = stage4Count >= threshold;
  const story2 = stage5Count >= threshold;

  let story3 = false;
  if (story2 && typeof window !== 'undefined') {
    const key = `lexivo_story2_unlock_${collectionName}_${dayNumber}`;
    let unlockDate = localStorage.getItem(key);
    if (!unlockDate) {
      unlockDate = localDateStr();
      localStorage.setItem(key, unlockDate);
    }
    const unlockDt = new Date(unlockDate);
    unlockDt.setDate(unlockDt.getDate() + 30);
    story3 = new Date(localDateStr()) >= unlockDt;
  }

  const count = [story1, story2, story3].filter(Boolean).length;
  return {
    story1Unlocked: story1, story2Unlocked: story2, story3Unlocked: story3,
    anyUnlocked: story1 || story2 || story3, unlockedCount: count,
  };
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
