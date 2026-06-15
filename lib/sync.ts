import { supabase } from './supabase';
import {
  getSettings, saveSettings,
  getXP, getTodayXP, getStreak, getTotalStudyDays, getFreezes,
  getLearnedWords, getSRSWords, getStarredWords,
  getUnlockedAchievements, getCustomLists,
  getHardWords,
  getProfilePicUrl, saveProfilePicUrl,
  getNameUpdatedAt, saveNameUpdatedAt,
  getLevelUpdatedAt, saveLevelUpdatedAt,
} from './storage';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split('T')[0]; }

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

function lsSet(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Push all local data to Supabase ───────────────────────────────────────────

export async function pushAll(userId: string) {
  const s = getSettings();

  const avatarUrl = getProfilePicUrl();
  const nameUpdatedAt = getNameUpdatedAt();
  const levelUpdatedAt = getLevelUpdatedAt();

  // Profile / settings
  await supabase.from('profiles').upsert({
    id: userId,
    name: s.name,
    name_updated_at: nameUpdatedAt,
    language_level: s.languageLevel,
    language_level_updated_at: levelUpdatedAt,
    daily_goal: s.dailyGoal,
    default_accent: s.defaultAccent,
    auto_play_on_reveal: s.autoPlayOnReveal,
    session_size: s.sessionSize,
    font_size: s.fontSize,
    study_order: s.studyOrder,
    quiz_direction: s.quizDirection,
    reduce_motion: s.reduceMotion,
    ...(avatarUrl !== null && { avatar_url: avatarUrl }),
  });

  // Stats
  await supabase.from('user_stats').upsert({
    id: userId,
    xp: getXP(),
    today_xp: getTodayXP(),
    today_xp_date: lsGet('lexivo_today_xp_date', null),
    today_count: lsGet<number>('lexivo_today_count', 0),
    today_count_date: lsGet('lexivo_today_count_date', null),
    streak: getStreak(),
    last_study_date: lsGet('lexivo_last_study', null),
    total_days: getTotalStudyDays(),
    freezes: getFreezes(),
    last_freeze_week: lsGet('lexivo_last_freeze_week', null),
  });

  // Learned words — upsert all
  const learned = getLearnedWords();
  if (learned.length > 0) {
    await supabase.from('learned_words').upsert(
      learned.map(w => ({
        user_id: userId,
        word: w.word,
        collection: w.collectionName,
        learned_at: w.learnedAt,
      })),
      { onConflict: 'user_id,word' }
    );
  }

  // SRS words — upsert all
  const srs = getSRSWords();
  if (srs.length > 0) {
    await supabase.from('srs_words').upsert(
      srs.map(w => ({ user_id: userId, word_id: w.id, data: w })),
      { onConflict: 'user_id,word_id' }
    );
  }

  // Starred words — replace all
  await supabase.from('starred_words').delete().eq('user_id', userId);
  const starred = getStarredWords();
  if (starred.length > 0) {
    await supabase.from('starred_words').insert(starred.map(w => ({ user_id: userId, word: w })));
  }

  // Achievements — upsert all
  const achievements = getUnlockedAchievements();
  if (achievements.length > 0) {
    await supabase.from('achievements').upsert(
      achievements.map(id => ({ user_id: userId, achievement_id: id })),
      { onConflict: 'user_id,achievement_id' }
    );
  }

  // Custom lists — upsert all
  const lists = getCustomLists();
  if (lists.length > 0) {
    await supabase.from('custom_lists').upsert(
      lists.map(l => ({ id: l.id, user_id: userId, name: l.name, words: l.words })),
      { onConflict: 'id' }
    );
  }
}

// ── Pull cloud data into localStorage ────────────────────────────────────────

export async function pullAll(userId: string) {
  // Settings / profile
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (profile) {
    const existing = getSettings();
    const remoteNameTs = profile.name_updated_at as string | null;
    const localNameTs  = getNameUpdatedAt();
    const useRemoteName = remoteNameTs !== null && (localNameTs === null || remoteNameTs > localNameTs);

    const remoteLevelTs = profile.language_level_updated_at as string | null;
    const localLevelTs  = getLevelUpdatedAt();
    const useRemoteLevel = remoteLevelTs !== null && (localLevelTs === null || remoteLevelTs > localLevelTs);

    saveSettings({
      name:             useRemoteName  ? (profile.name           ?? 'Learner') : existing.name,
      languageLevel:    useRemoteLevel ? (profile.language_level ?? 'B1')      : existing.languageLevel,
      dailyGoal:        profile.daily_goal        ?? 10,
      defaultAccent:    profile.default_accent    ?? 'us',
      autoPlayOnReveal: profile.auto_play_on_reveal ?? true,
      sessionSize:      profile.session_size      ?? 20,
      fontSize:         profile.font_size         ?? 'normal',
      studyOrder:       profile.study_order       ?? 'random',
      quizDirection:    profile.quiz_direction    ?? 'word-to-uz',
      reduceMotion:     profile.reduce_motion     ?? false,
      uiLanguage:       existing.uiLanguage,
    });
    lsSet('lexivo_onboarded', true);
    if (useRemoteName && remoteNameTs) saveNameUpdatedAt(remoteNameTs);
    if (useRemoteLevel && remoteLevelTs) saveLevelUpdatedAt(remoteLevelTs);
    if (profile.avatar_url) saveProfilePicUrl(profile.avatar_url);
  }

  // Stats
  const { data: stats } = await supabase.from('user_stats').select('*').eq('id', userId).single();
  if (stats) {
    lsSet('lexivo_xp', stats.xp);
    lsSet('lexivo_today_xp', stats.today_xp);
    if (stats.today_xp_date) lsSet('lexivo_today_xp_date', stats.today_xp_date);
    lsSet('lexivo_today_count', stats.today_count);
    if (stats.today_count_date) lsSet('lexivo_today_count_date', stats.today_count_date);
    lsSet('lexivo_streak', stats.streak);
    if (stats.last_study_date) lsSet('lexivo_last_study', stats.last_study_date);
    lsSet('lexivo_total_study_days', stats.total_days);
    lsSet('lexivo_freezes', stats.freezes);
    if (stats.last_freeze_week) lsSet('lexivo_last_freeze_week', stats.last_freeze_week);
  }

  // Learned words — merge with local
  const { data: learned } = await supabase.from('learned_words').select('*').eq('user_id', userId);
  if (learned && learned.length > 0) {
    const local = lsGet<Array<{ word: string; collectionName: string; learnedAt: string; translation: string; topic: string; dayNumber: number }>>('lexivo_learned_words', []);
    const localKeys = new Set(local.map(w => w.word));
    const merged = [...local];
    for (const row of learned) {
      if (!localKeys.has(row.word)) {
        merged.push({ word: row.word, collectionName: row.collection ?? '', learnedAt: row.learned_at, translation: '', topic: '', dayNumber: 0 });
      }
    }
    lsSet('lexivo_learned_words', merged);
  }

  // SRS words — replace local with cloud
  const { data: srs } = await supabase.from('srs_words').select('data').eq('user_id', userId);
  if (srs && srs.length > 0) {
    lsSet('lexivo_srs_words', srs.map(r => r.data));
  }

  // Starred words — replace local with cloud
  const { data: starred } = await supabase.from('starred_words').select('word').eq('user_id', userId);
  if (starred && starred.length > 0) {
    lsSet('lexivo_starred', starred.map(r => r.word));
  }

  // Achievements — merge
  const { data: achievements } = await supabase.from('achievements').select('achievement_id').eq('user_id', userId);
  if (achievements && achievements.length > 0) {
    const local = lsGet<string[]>('lexivo_achievements', []);
    const merged = Array.from(new Set([...local, ...achievements.map(r => r.achievement_id)]));
    lsSet('lexivo_achievements', merged);
  }

  // Custom lists — replace local with cloud
  const { data: lists } = await supabase.from('custom_lists').select('*').eq('user_id', userId);
  if (lists && lists.length > 0) {
    lsSet('lexivo_custom_lists', lists.map(l => ({ id: l.id, name: l.name, words: l.words })));
  }
}
