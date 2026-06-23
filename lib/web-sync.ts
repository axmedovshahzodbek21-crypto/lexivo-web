import { supabase } from './supabase';
import type { ImportedWord } from './types';
import {
  getSettings, saveSettings, setOnboarded, updateFolderMap,
  getLearnedWords, getSRSWords, getStarredWords,
  getXP, getTodayXP, getStreak, getFreezes, getTotalStudyDays,
  getProfilePicUrl, saveProfilePicUrl,
  getNameUpdatedAt, saveNameUpdatedAt,
  getLevelUpdatedAt, saveLevelUpdatedAt,
  getStudyDays, saveStudyDays,
  getUnlockedAchievements, getCustomLists,
  getHardWords,
  getImportedWords, saveImportedWords,
  localDateStr,
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
  hardWords:      'lexivo_hard_words',
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
      show_on_leaderboard: settings.showOnLeaderboard ?? true,
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
      last_freeze_week: (() => { const v = ls(K.lastFreezeWeek); return (v && /^\d{4}-W\d{1,2}$/.test(JSON.parse(v))) ? JSON.parse(v) : null; })(),
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

    // hard_words — full replace so removals propagate
    const hard = getHardWords();
    await supabase.from('hard_words').delete().eq('user_id', uid);
    if (hard.length > 0) {
      await supabase.from('hard_words').insert(hard.map(w => ({ user_id: uid, word: w })));
    }

    // achievements — upsert all
    const achievements = getUnlockedAchievements();
    if (achievements.length > 0) {
      await supabase.from('achievements').upsert(
        achievements.map(id => ({ user_id: uid, achievement_id: id })),
        { onConflict: 'user_id,achievement_id' },
      );
    }

    // custom_lists — upsert all
    const lists = getCustomLists();
    if (lists.length > 0) {
      await supabase.from('custom_lists').upsert(
        lists.map(l => ({ id: l.id, user_id: uid, name: l.name, words: l.words })),
        { onConflict: 'id' },
      );
    }

    // imported_words — full replace so collection deletions propagate.
    // Only replace when local has data — never delete from cloud when local is empty,
    // because that would wipe cloud data if push runs before the initial pull (race).
    const imported = getImportedWords();
    if (imported.length > 0) {
      await supabase.from('imported_words').delete().eq('user_id', uid);
      await supabase.from('imported_words').insert(
          imported.map(w => ({
            user_id: uid,
            word: w.word,
            collection_name: w.collectionName ?? 'My Words',
            folder_name: w.folderName ?? null,
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

  } catch (e) {
    console.error('pushAll error:', e);
  }

  // unit_progress — outside the outer try-catch so it always runs even if
  // an earlier push step throws (e.g. a network error on imported_words).
  if (typeof window !== 'undefined') {
    const localRows: {
      collection_name: string; day_number: number;
      learn_done: boolean; flashcard_done: boolean; quiz_done: boolean;
      completed_at: string | null;
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
        // Preserve the stored completedAt so periodic sync never overwrites the
        // real completion timestamp with "now". pullAll writes it here after each pull.
        completed_at: p.completedAt ?? null,
      });
    }
    console.log('[unit_progress] periodic push: found', localRows.length, 'local rows');
    for (const r of localRows) {
      try {
        const allDone = r.learn_done && r.flashcard_done && r.quiz_done;
        // Use stored timestamp if available; only generate "now" on the very first push
        const completedAt = allDone ? (r.completed_at ?? new Date().toISOString()) : null;
        const { data: updated, error: updateErr } = await supabase
          .from('unit_progress')
          .update({ learn_done: r.learn_done, flashcard_done: r.flashcard_done, quiz_done: r.quiz_done, completed_at: completedAt })
          .eq('user_id', uid)
          .eq('collection_name', r.collection_name)
          .eq('day_number', r.day_number)
          .select('id');
        if (updateErr) console.warn('[unit_progress] update error for', r.collection_name, r.day_number, updateErr);
        if (!updated || updated.length === 0) {
          const { error: insertErr } = await supabase.from('unit_progress').insert({
            user_id: uid, collection_name: r.collection_name, day_number: r.day_number,
            learn_done: r.learn_done, flashcard_done: r.flashcard_done, quiz_done: r.quiz_done,
            completed_at: completedAt,
          });
          if (insertErr) console.error('[unit_progress] insert error for', r.collection_name, r.day_number, insertErr);
          else console.log('[unit_progress] inserted', r.collection_name, r.day_number);
        }
      } catch (e) {
        console.error('[unit_progress] unexpected error for', r.collection_name, r.day_number, e);
      }
    }
  }
}

export async function pushAllCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await pushAll(user.id);
}

export async function pushUnitProgressCurrentUser(collectionName: string, dayNumber: number) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const key = `lexivo_unit_progress_${collectionName}_${dayNumber}`;
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (!raw) return;
    const p = JSON.parse(raw);
    const learnDone     = p.learnDone     ?? false;
    const flashcardDone = p.flashcardDone ?? false;
    const quizDone      = p.quizDone      ?? false;
    const allDone       = learnDone && flashcardDone && quizDone;
    const completedAt   = allDone ? new Date().toISOString() : null;

    // Try UPDATE first — avoids needing a unique constraint for ON CONFLICT
    const { data: updated, error: updateErr } = await supabase
      .from('unit_progress')
      .update({ learn_done: learnDone, flashcard_done: flashcardDone, quiz_done: quizDone, completed_at: completedAt })
      .eq('user_id', user.id)
      .eq('collection_name', collectionName)
      .eq('day_number', dayNumber)
      .select('id');
    if (updateErr) console.error('[unit_progress] update error:', updateErr);

    // No existing row (or update failed) — INSERT
    if (!updated || updated.length === 0) {
      const { error: insertErr } = await supabase.from('unit_progress').insert({
        user_id: user.id,
        collection_name: collectionName,
        day_number: dayNumber,
        learn_done: learnDone,
        flashcard_done: flashcardDone,
        quiz_done: quizDone,
        completed_at: completedAt,
      });
      if (insertErr) console.error('[unit_progress] insert error:', insertErr);
    }
  } catch (e) {
    console.error('[unit_progress] unexpected error:', e);
  }
}

// ── Pull: Supabase → localStorage ─────────────────────────────────────────────

export async function pullAll(uid: string) {
  try {
    const set = (key: string, val: unknown) => {
      if (typeof window === 'undefined') return;
      const serialized = JSON.stringify(val);
      // Guard: never write a value larger than 256KB — corrupt Supabase data can be huge
      if (serialized.length > 256 * 1024) {
        console.warn(`pullAll: skipping oversized value for ${key} (${(serialized.length/1024).toFixed(0)}KB)`);
        return;
      }
      try { localStorage.setItem(key, serialized); } catch {
        // localStorage full — evict the largest non-critical key and retry once
        try {
          let biggestKey = ''; let biggestSize = 0;
          const skip = new Set(['lexivo_settings', 'lexivo_imported_words', 'lexivo_ui_lang']);
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)!;
            if (skip.has(k)) continue;
            const size = (localStorage.getItem(k) ?? '').length;
            if (size > biggestSize) { biggestSize = size; biggestKey = k; }
          }
          if (biggestKey) localStorage.removeItem(biggestKey);
          localStorage.setItem(key, serialized);
        } catch { /* give up on this key, continue */ }
      }
    };

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
      // Accumulating counters: take max so locally earned progress isn't overwritten by a stale cloud value
      set(K.xp,     Math.max(parseInt(ls(K.xp)      ?? '0', 10), stats.xp      ?? 0));
      set(K.streak, Math.max(parseInt(ls(K.streak)  ?? '0', 10), stats.streak  ?? 0));
      set(K.freezes,Math.max(parseInt(ls(K.freezes) ?? '0', 10), stats.freezes ?? 0));
      set(K.totalDays, stats.total_days ?? 0);

      // today_xp / today_count: only sync if the cloud value is from today (avoids resetting today's progress with yesterday's cloud data)
      const todayStr = localDateStr();
      const cloudXpDate    = stats.today_xp_date    as string | null;
      const cloudCountDate = stats.today_count_date as string | null;
      if (cloudXpDate === todayStr) {
        const localXp = parseInt(ls(K.todayXp) ?? '0', 10);
        set(K.todayXp,    ls(K.todayXpDate) === todayStr ? Math.max(localXp, stats.today_xp ?? 0) : (stats.today_xp ?? 0));
        set(K.todayXpDate, cloudXpDate);
      }
      if (cloudCountDate === todayStr) {
        const localCount = parseInt(ls(K.todayCount) ?? '0', 10);
        set(K.todayCount,    ls(K.todayCountDate) === todayStr ? Math.max(localCount, stats.today_count ?? 0) : (stats.today_count ?? 0));
        set(K.todayCountDate, cloudCountDate);
      }

      // last_study_date: take the more recent of local and cloud
      const cloudLastStudy = stats.last_study_date as string | null;
      const localLastStudy = ls(K.lastStudy);
      if (cloudLastStudy && (!localLastStudy || cloudLastStudy > localLastStudy)) {
        set(K.lastStudy, cloudLastStudy);
      }
      // Validate freeze week looks like "YYYY-Wnn" before writing (guards against corrupt 100KB+ values)
      const fwVal = stats.last_freeze_week as string | null;
      if (fwVal && /^\d{4}-W\d{1,2}$/.test(fwVal)) set(K.lastFreezeWeek, fwVal);
      if (Array.isArray(stats.study_days) && stats.study_days.length > 0) {
        const local = getStudyDays();
        const merged = Array.from(new Set([...local, ...stats.study_days]));
        saveStudyDays(merged);
      }
    }

    // srs_words — merge: add new words, update existing if cloud has advanced further
    const { data: srsRows } = await supabase.from('srs_words').select('data').eq('user_id', uid);
    const localSRS = getSRSWords();
    const localMap = new Map(localSRS.map(w => [`${w.word}_${w.collectionName}`, w]));
    for (const row of srsRows ?? []) {
      const w = row.data;
      if (!w) continue;
      const key = `${w.word}_${w.collectionName}`;
      const existing = localMap.get(key);
      const cloudStage = (w.reviewStage ?? 0);
      const localStage = (existing?.reviewStage ?? 0);
      const cloudWins = !existing ||
        cloudStage > localStage ||
        (cloudStage === localStage && (w.nextReviewDate ?? '') > (existing.nextReviewDate ?? ''));
      if (cloudWins) localMap.set(key, w);
    }
    // Write if cloud responded (even empty) — backfills id for any word still missing it
    if (srsRows !== null && localMap.size > 0) {
      set(K.srs, [...localMap.values()].map(
        w => w.id ? w : { ...w, id: `${w.collectionName}::${w.word}` }
      ));
    }

    // learned_words — merge: keep local, add remote words not already in local
    const { data: learnedRows } = await supabase.from('learned_words').select('word,collection,learned_at').eq('user_id', uid);
    if (learnedRows && learnedRows.length > 0) {
      const local = getLearnedWords();
      const localKeys = new Set(local.map(w => w.word));
      const toAdd = learnedRows
        .filter(r => !localKeys.has(r.word))
        .map(r => ({ word: r.word, collectionName: r.collection ?? '', learnedAt: r.learned_at ?? new Date().toISOString(), translation: '', topic: '', dayNumber: 0 }));
      if (toAdd.length > 0) set(K.learned, [...local, ...toAdd]);
    }

    // starred_words — authoritative replace: cloud state wins so removals propagate cross-device
    const { data: starredRows } = await supabase.from('starred_words').select('word').eq('user_id', uid);
    if (starredRows !== null) {
      set(K.starred, starredRows.map(r => r.word as string));
    }

    // hard_words — authoritative replace
    const { data: hardRows } = await supabase.from('hard_words').select('word').eq('user_id', uid);
    if (hardRows !== null) {
      set(K.hardWords, hardRows.map(r => r.word as string));
    }

    // unit_progress — OR-merge: remote true always wins, local true never erased
    try {
      const { data: upRows } = await supabase.from('unit_progress')
        .select('collection_name,day_number,learn_done,flashcard_done,quiz_done,completed_at')
        .eq('user_id', uid);
      if (typeof window !== 'undefined' && upRows && upRows.length > 0) {
        for (const r of upRows) {
          const key = `lexivo_unit_progress_${r.collection_name}_${r.day_number}`;
          const existing = localStorage.getItem(key);
          const local = existing ? JSON.parse(existing) : { learnDone: false, flashcardDone: false, quizDone: false };
          localStorage.setItem(key, JSON.stringify({
            learnDone:     local.learnDone     || (r.learn_done      ?? false),
            flashcardDone: local.flashcardDone || (r.flashcard_done  ?? false),
            quizDone:      local.quizDone      || (r.quiz_done       ?? false),
            completedAt:   local.completedAt   ?? (r.completed_at    ?? null),
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
    if (listRows !== null) {
      set('lexivo_custom_lists', listRows.map(l => ({ id: l.id, name: l.name, words: l.words })));
    }

    // imported_words — smart merge: cloud version wins for each word+collection pair,
    // but local folderName is preserved when cloud has none (guards against Supabase
    // corruption where folder_name was wiped by an earlier bad push).
    // Dedup key is word+collection only (not folder) so a local word with folderName
    // is never duplicated by a cloud copy of the same word that lost its folder_name.
    const { data: importedRows } = await supabase.from('imported_words').select('*').eq('user_id', uid);
    if (importedRows !== null && importedRows.length > 0) {
      const local = getImportedWords();
      const localByKey = new Map(local.map(w => [
        `${w.word.toLowerCase()}__${(w.collectionName ?? 'My Words').toLowerCase()}`,
        w,
      ]));
      // Update folder map from cloud data so cross-device pulls restore folder assignments
      for (const r of importedRows) {
        if (r.folder_name && r.collection_name) {
          updateFolderMap(r.collection_name as string, r.folder_name as string);
        }
      }
      const cloudWords = importedRows.map(r => {
        const key = `${(r.word as string).toLowerCase()}__${(r.collection_name ?? 'My Words').toLowerCase()}`;
        const localMatch = localByKey.get(key);
        return {
          word: r.word as string,
          translation: (r.translation as string) ?? '',
          definition: (r.definition as string) ?? '',
          example1: (r.example1 as string) ?? '',
          example1Translation: (r.example1_translation as string) ?? '',
          example2: (r.example2 as string) ?? '',
          example2Translation: (r.example2_translation as string) ?? '',
          language: (r.language as string) ?? 'en-US',
          addedAt: (r.added_at as number) ?? 0,
          collectionName: (r.collection_name as string) ?? 'My Words',
          folderName: (r.folder_name as string | null) ?? localMatch?.folderName,
        } as ImportedWord;
      });
      // Preserve any local-only words not yet in Supabase (just imported, push pending)
      const cloudKeySet = new Set(cloudWords.map(w =>
        `${w.word.toLowerCase()}__${(w.collectionName ?? 'My Words').toLowerCase()}`
      ));
      const localOnly = local.filter(w =>
        !cloudKeySet.has(`${w.word.toLowerCase()}__${(w.collectionName ?? 'My Words').toLowerCase()}`)
      );
      saveImportedWords([...cloudWords, ...localOnly]);
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

function dispatch(name: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(name));
}

export function startSync(uid: string) {
  stopSync();
  _syncInterval = setInterval(async () => {
    dispatch('lexivo-sync-start');
    try {
      const wasReset = await checkAndHandleReset(uid);
      await pullAll(uid);
      if (!wasReset) await pushAll(uid);
      dispatch('lexivo-sync-done');
    } catch {
      dispatch('lexivo-sync-error');
    }
  }, 30_000);
}

export function stopSync() {
  if (_syncInterval) { clearInterval(_syncInterval); _syncInterval = null; }
}
