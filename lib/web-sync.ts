import { supabase } from './supabase';
import {
  getSettings, saveSettings, setOnboarded,
  getLearnedWords, getSRSWords, getStarredWords,
  getXP, getTodayXP, getStreak, getFreezes, getTotalStudyDays,
  getProfilePicUrl, saveProfilePicUrl,
  getNameUpdatedAt, saveNameUpdatedAt,
  getLevelUpdatedAt, saveLevelUpdatedAt,
  getStudyDays, saveStudyDays,
} from './storage';

// localStorage key constants (mirrors KEYS in storage.ts)
const K = {
  xp:             'lexivo_xp',
  todayXp:        'lexivo_today_xp',
  todayXpDate:    'lexivo_today_xp_date',
  todayCount:     'lexivo_today_count',
  todayCountDate: 'lexivo_today_count_date',
  streak:         'lexivo_streak',
  lastStudy:      'lexivo_last_study',
  totalDays:      'lexivo_total_study_days',
  freezes:        'lexivo_freezes',
  lastFreezeWeek: 'lexivo_last_freeze_week',
  srs:            'lexivo_srs_words',
  learned:        'lexivo_learned_words',
  starred:        'lexivo_starred',
};

function ls(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}

// ── Push: localStorage → Supabase ─────────────────────────────────────────────

export async function pushAll(uid: string) {
  try {
    const settings = getSettings();

    const avatarUrl = getProfilePicUrl();
    const nameUpdatedAt = getNameUpdatedAt();
    const levelUpdatedAt = getLevelUpdatedAt();
    await supabase.from('profiles').upsert({
      id: uid,
      // Only push name/level when we have a timestamp — prevents overwriting a newer
      // value from another device that already set the timestamp
      ...(nameUpdatedAt  !== null && { name: settings.name, name_updated_at: nameUpdatedAt }),
      ...(levelUpdatedAt !== null && { language_level: settings.languageLevel, language_level_updated_at: levelUpdatedAt }),
      daily_goal: settings.dailyGoal,
      default_accent: settings.defaultAccent,
      auto_play_on_reveal: settings.autoPlayOnReveal,
      session_size: settings.sessionSize,
      font_size: settings.fontSize,
      study_order: settings.studyOrder,
      quiz_direction: settings.quizDirection,
      reduce_motion: settings.reduceMotion,
      ...(avatarUrl !== null && { avatar_url: avatarUrl }),
    });

    await supabase.from('user_stats').upsert({
      id: uid,
      xp: getXP(),
      today_xp: getTodayXP(),
      today_xp_date: ls(K.todayXpDate),
      today_count: parseInt(ls(K.todayCount) ?? '0', 10),
      today_count_date: ls(K.todayCountDate),
      streak: getStreak(),
      last_study_date: ls(K.lastStudy),
      total_days: getTotalStudyDays(),
      study_days: getStudyDays(),
      freezes: getFreezes(),
      last_freeze_week: ls(K.lastFreezeWeek),
    });

    // learned_words — deduplicate by word
    const learned = getLearnedWords();
    if (learned.length > 0) {
      const unique = new Map(learned.map(w => [w.word, w]));
      await supabase.from('learned_words').upsert(
        [...unique.values()].map(w => ({
          user_id: uid,
          word: w.word,
          collection: w.collectionName,
          learned_at: w.learnedAt,
        })),
        { onConflict: 'user_id,word' },
      );
    }

    // srs_words — deduplicate by word_id
    const srsWords = getSRSWords();
    if (srsWords.length > 0) {
      const unique = new Map(srsWords.map(w => [`${w.word}_${w.collectionName}`, w]));
      await supabase.from('srs_words').upsert(
        [...unique.entries()].map(([wordId, w]) => ({
          user_id: uid,
          word_id: wordId,
          data: w,
        })),
        { onConflict: 'user_id,word_id' },
      );
    }

    // starred_words — full replace
    const starred = [...new Set(getStarredWords())];
    await supabase.from('starred_words').delete().eq('user_id', uid);
    if (starred.length > 0) {
      await supabase.from('starred_words').insert(starred.map(w => ({ user_id: uid, word: w })));
    }

    // unit_progress — fetch remote first and OR-merge so false never overwrites true
    if (typeof window !== 'undefined') {
      const localRows: {
        collection_name: string; day_number: number;
        learn_done: boolean; flashcard_done: boolean; quiz_done: boolean;
      }[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('lexivo_unit_progress_')) continue;
        const suffix = key.slice('lexivo_unit_progress_'.length);
        const lastUnderscore = suffix.lastIndexOf('_');
        if (lastUnderscore === -1) continue;
        const collectionName = suffix.slice(0, lastUnderscore);
        const dayNumber = parseInt(suffix.slice(lastUnderscore + 1), 10);
        if (isNaN(dayNumber)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const p = JSON.parse(raw);
        localRows.push({
          collection_name: collectionName, day_number: dayNumber,
          learn_done: p.learnDone ?? false,
          flashcard_done: p.flashcardDone ?? false,
          quiz_done: p.quizDone ?? false,
        });
      }
      if (localRows.length > 0) {
        try {
          const { data: remoteRows } = await supabase
            .from('unit_progress')
            .select('collection_name,day_number,learn_done,flashcard_done,quiz_done')
            .eq('user_id', uid);
          const remoteMap = new Map((remoteRows ?? []).map(r => [`${r.collection_name}_${r.day_number}`, r]));
          const upRows = localRows.map(r => {
            const remote = remoteMap.get(`${r.collection_name}_${r.day_number}`);
            return {
              user_id: uid,
              collection_name: r.collection_name,
              day_number: r.day_number,
              learn_done: r.learn_done || (remote?.learn_done ?? false),
              flashcard_done: r.flashcard_done || (remote?.flashcard_done ?? false),
              quiz_done: r.quiz_done || (remote?.quiz_done ?? false),
            };
          });
          await supabase.from('unit_progress').upsert(upRows, { onConflict: 'user_id,collection_name,day_number' });
        } catch (_) {}
      }
    }
  } catch (e) {
    console.error('pushAll error:', e);
  }
}

// ── Pull: Supabase → localStorage ─────────────────────────────────────────────

export async function pullAll(uid: string) {
  try {
    const set = (key: string, val: unknown) =>
      typeof window !== 'undefined' && localStorage.setItem(key, JSON.stringify(val));

    // profiles → settings
    const { data: profile } = await supabase.from('profiles').select().eq('id', uid).maybeSingle();
    if (profile) {
      // Record reset_at so checkAndHandleReset won't re-fire on fresh browser sessions
      const resetAt = profile.reset_at as string | null;
      if (resetAt && typeof window !== 'undefined') localStorage.setItem('lexivo_last_seen_reset_at', resetAt);

      const existing = getSettings();
      const remoteNameTs = profile.name_updated_at as string | null;
      const localNameTs  = getNameUpdatedAt();
      const useRemoteName = remoteNameTs !== null && (localNameTs === null || remoteNameTs > localNameTs);

      const remoteLevelTs = profile.language_level_updated_at as string | null;
      const localLevelTs  = getLevelUpdatedAt();
      const useRemoteLevel = remoteLevelTs !== null && (localLevelTs === null || remoteLevelTs > localLevelTs);

      saveSettings({
        name:            useRemoteName  ? (profile.name           ?? 'Learner') : existing.name,
        languageLevel:   useRemoteLevel ? (profile.language_level ?? 'B1')      : existing.languageLevel,
        dailyGoal:       profile.daily_goal       ?? 10,
        defaultAccent:   profile.default_accent   ?? 'us',
        autoPlayOnReveal:profile.auto_play_on_reveal ?? true,
        sessionSize:     profile.session_size     ?? 20,
        fontSize:        profile.font_size        ?? 'normal',
        studyOrder:      profile.study_order      ?? 'random',
        quizDirection:   profile.quiz_direction   ?? 'word-to-uz',
        reduceMotion:         profile.reduce_motion         ?? false,
        showOnLeaderboard:    profile.show_on_leaderboard   ?? true,
        uiLanguage:           existing.uiLanguage,
      });
      setOnboarded();
      if (useRemoteName && remoteNameTs) saveNameUpdatedAt(remoteNameTs);
      if (useRemoteLevel && remoteLevelTs) saveLevelUpdatedAt(remoteLevelTs);
      if (profile.avatar_url) saveProfilePicUrl(profile.avatar_url);
    }

    // user_stats
    const { data: stats } = await supabase.from('user_stats').select().eq('id', uid).maybeSingle();
    if (stats) {
      set(K.xp,             stats.xp             ?? 0);
      set(K.todayXp,        stats.today_xp        ?? 0);
      set(K.todayCount,     stats.today_count     ?? 0);
      set(K.streak,         stats.streak          ?? 0);
      set(K.totalDays,      stats.total_days      ?? 0);
      set(K.freezes,        stats.freezes         ?? 0);
      if (stats.today_xp_date)    set(K.todayXpDate,    stats.today_xp_date);
      if (stats.today_count_date) set(K.todayCountDate, stats.today_count_date);
      if (stats.last_study_date)  set(K.lastStudy,      stats.last_study_date);
      if (stats.last_freeze_week) set(K.lastFreezeWeek, stats.last_freeze_week);
      if (Array.isArray(stats.study_days) && stats.study_days.length > 0) {
        const local = getStudyDays();
        const merged = Array.from(new Set([...local, ...stats.study_days]));
        saveStudyDays(merged);
      }
    }

    // srs_words — always overwrite local
    const { data: srsRows } = await supabase.from('srs_words').select('data').eq('user_id', uid);
    set(K.srs, srsRows?.map(r => r.data) ?? []);

    // learned_words — always overwrite local
    const { data: learnedRows } = await supabase.from('learned_words').select('word,collection,learned_at').eq('user_id', uid);
    set(K.learned, learnedRows?.map(r => ({
      word:           r.word,
      collectionName: r.collection  ?? '',
      learnedAt:      r.learned_at  ?? new Date().toISOString(),
    })) ?? []);

    // starred_words — always overwrite local
    const { data: starredRows } = await supabase.from('starred_words').select('word').eq('user_id', uid);
    set(K.starred, starredRows?.map(r => r.word) ?? []);

    // unit_progress — always overwrite local
    try {
      const { data: upRows } = await supabase.from('unit_progress')
        .select('collection_name,day_number,learn_done,flashcard_done,quiz_done')
        .eq('user_id', uid);
      if (typeof window !== 'undefined') {
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith('lexivo_unit_progress_')) toRemove.push(k);
        }
        toRemove.forEach(k => localStorage.removeItem(k));
        for (const r of (upRows ?? [])) {
          const key = `lexivo_unit_progress_${r.collection_name}_${r.day_number}`;
          localStorage.setItem(key, JSON.stringify({
            learnDone: r.learn_done ?? false,
            flashcardDone: r.flashcard_done ?? false,
            quizDone: r.quiz_done ?? false,
          }));
        }
      }
    } catch (_) {}

    // achievements — merge with local
    const { data: achievementRows } = await supabase.from('achievements').select('achievement_id').eq('user_id', uid);
    if (achievementRows && achievementRows.length > 0 && typeof window !== 'undefined') {
      const local: string[] = JSON.parse(localStorage.getItem('lexivo_achievements') || '[]');
      const merged = Array.from(new Set([...local, ...achievementRows.map(r => r.achievement_id as string)]));
      set('lexivo_achievements', merged);
    }

    // custom_lists — replace local with cloud
    const { data: listRows } = await supabase.from('custom_lists').select('*').eq('user_id', uid);
    if (listRows && listRows.length > 0) {
      set('lexivo_custom_lists', listRows.map(l => ({ id: l.id, name: l.name, words: l.words })));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('lexivo-sync'));
    }
  } catch (e) {
    console.error('pullAll error:', e);
  }
}

// ── Reset detection ───────────────────────────────────────────────────────────

async function checkAndHandleReset(uid: string): Promise<boolean> {
  try {
    const { data: profile } = await supabase.from('profiles').select('reset_at').eq('id', uid).maybeSingle();
    const resetAt = profile?.reset_at as string | null;
    if (!resetAt) return false;
    const lastSeen = typeof window !== 'undefined' ? localStorage.getItem('lexivo_last_seen_reset_at') : null;
    if (lastSeen === resetAt) return false;

    // New reset detected — wipe all progress from localStorage
    if (typeof window !== 'undefined') {
      const progressKeys = Object.values(K);
      progressKeys.forEach(k => localStorage.removeItem(k));
      // Also clear unit_progress_* keys
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('lexivo_unit_progress_')) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
      localStorage.setItem('lexivo_last_seen_reset_at', resetAt);
    }
    return true;
  } catch {
    return false;
  }
}

// ── Periodic sync ─────────────────────────────────────────────────────────────

let _syncInterval: ReturnType<typeof setInterval> | null = null;

export function startSync(uid: string) {
  stopSync();
  _syncInterval = setInterval(async () => {
    const wasReset = await checkAndHandleReset(uid);
    await pullAll(uid);              // Pull first — local becomes authoritative merged state
    if (!wasReset) await pushAll(uid); // Then push the merged state
  }, 30_000);
}

export function stopSync() {
  if (_syncInterval) { clearInterval(_syncInterval); _syncInterval = null; }
}
