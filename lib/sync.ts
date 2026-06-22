import { supabase } from './supabase';
import {
  getSettings, saveSettings,
  getXP, getTodayXP, getStreak, getTotalStudyDays, getFreezes,
  getLearnedWords, getSRSWords, getStarredWords,
  getUnlockedAchievements, getCustomLists,
  getHardWords,
  getImportedWords, saveImportedWords,
  getProfilePicUrl, saveProfilePicUrl,
  getNameUpdatedAt, saveNameUpdatedAt,
  getLevelUpdatedAt, saveLevelUpdatedAt,
  getStudyDays, saveStudyDays,
} from './storage';
import { getNotifSettings, saveNotifSettings } from './notifications';

// ── Helpers ───────────────────────────────────────────────────────────────────


function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

function lsSet(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Push all local data to Supabase ───────────────────────────────────────────

function dispatch(name: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(name));
}

export async function pushAll(userId: string) {
  dispatch('lexivo-sync-start');
  try {
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
    show_on_leaderboard: s.showOnLeaderboard ?? true,
    ...(avatarUrl !== null && { avatar_url: avatarUrl }),
    notif_enabled: getNotifSettings().enabled,
    notif_time: getNotifSettings().time,
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
    study_days: getStudyDays(),
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
      srs.map(w => ({ user_id: userId, word_id: `${w.word}_${w.collectionName}`, data: w })),
      { onConflict: 'user_id,word_id' }
    );
  }

  // Starred words — replace all
  await supabase.from('starred_words').delete().eq('user_id', userId);
  const starred = getStarredWords();
  if (starred.length > 0) {
    await supabase.from('starred_words').insert(starred.map(w => ({ user_id: userId, word: w })));
  }

  // Hard words — full replace so removals propagate
  await supabase.from('hard_words').delete().eq('user_id', userId);
  const hardWords = getHardWords();
  if (hardWords.length > 0) {
    await supabase.from('hard_words').insert(hardWords.map(w => ({ user_id: userId, word: w })));
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

  // Imported words — full replace so collection deletions propagate
  const imported = getImportedWords();
  await supabase.from('imported_words').delete().eq('user_id', userId);
  if (imported.length > 0) {
    await supabase.from('imported_words').insert(
      imported.map(w => ({
        user_id: userId,
        word: w.word,
        collection_name: w.collectionName ?? 'My Words',
        translation: w.translation,
        definition: w.definition,
        example1: w.example1,
        example1_translation: w.example1Translation ?? '',
        example2: w.example2,
        example2_translation: w.example2Translation ?? '',
        language: w.language,
        added_at: w.addedAt,
      }))
    );
  }

  // unit_progress — OR-merge local with remote before upserting
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
          .select('collection_name,day_number,learn_done,flashcard_done,quiz_done,completed_at')
          .eq('user_id', userId);
        const remoteMap = new Map((remoteRows ?? []).map(r => [`${r.collection_name}_${r.day_number}`, r]));
        const upRows = localRows.map(r => {
          const remote = remoteMap.get(`${r.collection_name}_${r.day_number}`);
          const mergedLearn = r.learn_done || (remote?.learn_done ?? false);
          const mergedFlash = r.flashcard_done || (remote?.flashcard_done ?? false);
          const mergedQuiz = r.quiz_done || (remote?.quiz_done ?? false);
          const allDone = mergedLearn && mergedFlash && mergedQuiz;
          return {
            user_id: userId,
            collection_name: r.collection_name,
            day_number: r.day_number,
            learn_done: mergedLearn,
            flashcard_done: mergedFlash,
            quiz_done: mergedQuiz,
            completed_at: remote?.completed_at ?? (allDone ? new Date().toISOString() : null),
          };
        });
        await supabase.from('unit_progress').upsert(upRows, { onConflict: 'user_id,collection_name,day_number' });
      } catch (_) {}
    }
  }
  dispatch('lexivo-sync-done');
  } catch {
    dispatch('lexivo-sync-error');
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
      reduceMotion:        profile.reduce_motion      ?? false,
      showOnLeaderboard:   profile.show_on_leaderboard ?? true,
      uiLanguage:          existing.uiLanguage,
    });
    lsSet('lexivo_onboarded', true);
    if (useRemoteName && remoteNameTs) saveNameUpdatedAt(remoteNameTs);
    if (useRemoteLevel && remoteLevelTs) saveLevelUpdatedAt(remoteLevelTs);
    if (profile.avatar_url) saveProfilePicUrl(profile.avatar_url);
    if (profile.notif_enabled !== null || profile.notif_time !== null) {
      const cur = getNotifSettings();
      saveNotifSettings({
        enabled: profile.notif_enabled ?? cur.enabled,
        time: profile.notif_time ?? cur.time,
      });
    }
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
    if (Array.isArray(stats.study_days) && stats.study_days.length > 0) {
      const local = getStudyDays();
      const merged = Array.from(new Set([...local, ...stats.study_days]));
      saveStudyDays(merged);
    }
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

  // SRS words — replace local with cloud (deduplicate by word+collection in case of legacy format rows)
  const { data: srsRows } = await supabase.from('srs_words').select('data').eq('user_id', userId);
  if (srsRows && srsRows.length > 0) {
    const srsMap = new Map<string, unknown>();
    for (const row of srsRows) {
      const w = row.data;
      if (!w) continue;
      const key = `${w.word}_${w.collectionName}`;
      const existing = srsMap.get(key) as { reviewStage?: number } | undefined;
      const cloudStage = (w.reviewStage ?? 0);
      const existingStage = (existing?.reviewStage ?? 0);
      const cloudWins = !existing ||
        cloudStage > existingStage ||
        (cloudStage === existingStage && (w.nextReviewDate ?? '') >= ((existing as { nextReviewDate?: string }).nextReviewDate ?? ''));
      if (cloudWins) {
        srsMap.set(key, w);
      }
    }
    lsSet('lexivo_srs_words', [...srsMap.values()]);
  }

  // Starred words — replace local with cloud
  const { data: starred } = await supabase.from('starred_words').select('word').eq('user_id', userId);
  if (starred && starred.length > 0) {
    lsSet('lexivo_starred', starred.map(r => r.word));
  }

  // Hard words — authoritative replace
  const { data: hardRows } = await supabase.from('hard_words').select('word').eq('user_id', userId);
  if (hardRows !== null) {
    lsSet('lexivo_hard_words', hardRows.map(r => r.word));
  }

  // Imported words — authoritative replace
  const { data: importedRows } = await supabase.from('imported_words').select('*').eq('user_id', userId);
  if (importedRows !== null) {
    saveImportedWords(importedRows.map(r => ({
      word: r.word,
      translation: r.translation ?? '',
      definition: r.definition ?? '',
      example1: r.example1 ?? '',
      example1Translation: r.example1_translation ?? '',
      example2: r.example2 ?? '',
      example2Translation: r.example2_translation ?? '',
      language: r.language ?? 'en-US',
      addedAt: r.added_at ?? 0,
      collectionName: r.collection_name ?? 'My Words',
    })));
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
  if (lists !== null) {
    lsSet('lexivo_custom_lists', lists.map(l => ({ id: l.id, name: l.name, words: l.words })));
  }
}
