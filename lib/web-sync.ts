import { supabase } from './supabase';
import type { ImportedWord, UserSettings } from './types';
import {
  getSettings, saveSettings, setOnboarded, updateFolderMap,
  getLearnedWords, getSRSWords, getStarredWords,
  getXP, getTodayXP, getStreak, getFreezes, getTotalStudyDays,
  getProfilePicUrl, saveProfilePicUrl,
  getNameUpdatedAt, saveNameUpdatedAt,
  getLevelUpdatedAt, saveLevelUpdatedAt,
  getSettingsUpdatedAt, saveSettingsUpdatedAt,
  getStudyDays, saveStudyDays,
  getUnlockedAchievements, getCustomLists,
  getHardWordEntries, type HardWordEntry,
  getImportedWords, saveImportedWords,
  localDateStr,
} from './storage';

// ── Supabase response interfaces ─────────────────────────────────────────────
// These serve as compile-time contracts and runtime validation targets.
// If a DB column is removed, warnMissing() will log the discrepancy.

interface ProfileRow {
  reset_at:                  string | null;
  name:                      string | null;
  name_updated_at:           string | null;
  language_level:            string | null;
  language_level_updated_at: string | null;
  settings_updated_at:       string | null;
  daily_goal:                number | null;
  default_accent:            string | null;
  auto_play_on_reveal:       boolean | null;
  session_size:              number | null;
  font_size:                 string | null;
  study_order:               string | null;
  quiz_direction:            string | null;
  reduce_motion:             boolean | null;
  show_on_leaderboard:       boolean | null;
  avatar_url:                string | null;
}

interface StatsRow {
  xp:               number | null;
  xp_updated_at:    string | null;
  today_xp:         number | null;
  today_xp_date:    string | null;
  today_count:      number | null;
  today_count_date: string | null;
  streak:           number | null;
  last_study_date:  string | null;
  total_days:       number | null;
  study_days:       string[] | null;
  freezes:          number | null;
  last_freeze_week: string | null;
}

interface UnitProgressRow {
  collection_name: string;
  day_number:      number;
  learn_done:      boolean | null;
  flashcard_done:  boolean | null;
  quiz_done:       boolean | null;
  completed_at:    string | null;
}

function warnMissing(context: string, data: Record<string, unknown>, fields: string[]) {
  const missing = fields.filter(f => !(f in data));
  if (missing.length > 0) console.warn(`[sync] ${context}: missing DB columns: ${missing.join(', ')}`);
}

// localStorage key constants (mirrors KEYS in storage.ts)
const K = {
  xp:                  'lexivo_xp',
  xpUpdatedAt:         'lexivo_xp_updated_at',
  settingsUpdatedAt:   'lexivo_settings_updated_at',
  lastLearnedPullAt:   'lexivo_last_learned_pull_at',
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

async function upsertUserStats(payload: Record<string, unknown>) {
  const optionalColumns = ['xp_updated_at', 'study_days'];
  let current = { ...payload };

  for (let attempt = 0; attempt <= optionalColumns.length; attempt++) {
    const { error } = await supabase.from('user_stats').upsert(current);
    if (!error) return;

    const column = optionalColumns[attempt];
    if (!column || !(column in current)) throw error;
    console.warn(`[sync] user_stats upsert failed; retrying without ${column}:`, error.message);
    const { [column]: _removed, ...rest } = current;
    current = rest;
  }
}

// ── Push: localStorage → Supabase ─────────────────────────────────────────────

export async function pushAll(uid: string) {
  if (typeof window !== 'undefined' && localStorage.getItem('lexivo_resetting') === '1') return;
  try {
    const settings = getSettings();

    const avatarUrl = getProfilePicUrl();
    const nameUpdatedAt     = getNameUpdatedAt();
    const levelUpdatedAt    = getLevelUpdatedAt();
    const localSettingsTs   = getSettingsUpdatedAt();
    // Only push settings when local timestamp is at least as recent as the cloud
    // timestamp cached from the preceding pullAll — same pattern as XP.
    const pushSettings = !localSettingsTs || !_lastPulledSettingsTs || localSettingsTs >= _lastPulledSettingsTs;
    await supabase.from('profiles').upsert({
      id: uid,
      // Only push name/level when we have a timestamp — prevents overwriting a newer
      // value from another device that already set the timestamp
      ...(nameUpdatedAt  !== null && { name: settings.name, name_updated_at: nameUpdatedAt }),
      ...(levelUpdatedAt !== null && { language_level: settings.languageLevel, language_level_updated_at: levelUpdatedAt }),
      ...(pushSettings && {
        daily_goal:          settings.dailyGoal,
        default_accent:      settings.defaultAccent,
        auto_play_on_reveal: settings.autoPlayOnReveal,
        session_size:        settings.sessionSize,
        font_size:           settings.fontSize,
        study_order:         settings.studyOrder,
        quiz_direction:      settings.quizDirection,
        reduce_motion:       settings.reduceMotion,
        show_on_leaderboard: settings.showOnLeaderboard ?? true,
        settings_updated_at: localSettingsTs ?? new Date().toISOString(),
      }),
      ...(avatarUrl !== null && { avatar_url: avatarUrl }),
    });

    // Only push XP when the local timestamp is at least as recent as the cloud
    // timestamp cached during the preceding pullAll. This prevents a stale tab
    // (lower XP, older timestamp) from overwriting a tab that just earned more.
    const localXpTs = ls(K.xpUpdatedAt);
    const pushXp = !localXpTs || !_lastPulledXpTs || localXpTs >= _lastPulledXpTs;
    await upsertUserStats({
      id: uid,
      ...(pushXp ? { xp: getXP(), xp_updated_at: localXpTs ?? new Date().toISOString() } : {}),
      today_xp: getTodayXP(),
      today_xp_date: ls(K.todayXpDate),
      today_count: parseInt(ls(K.todayCount) ?? '0', 10),
      today_count_date: ls(K.todayCountDate),
      streak: getStreak(),
      last_study_date: ls(K.lastStudy),
      total_days: getTotalStudyDays(),
      study_days: getStudyDays(),
      freezes: getFreezes(),
      last_freeze_week: (() => { try { const v = ls(K.lastFreezeWeek); return (v && /^\d{4}-W\d{1,2}$/.test(JSON.parse(v))) ? JSON.parse(v) : null; } catch { return null; } })(),
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

    // hard_words — upsert with timestamps so cross-device removals propagate via tombstones
    const hardEntries = getHardWordEntries();
    if (hardEntries.length > 0) {
      await supabase.from('hard_words').upsert(
        hardEntries.map(e => ({
          user_id: uid, word: e.word,
          added_at: e.addedAt,
          removed_at: e.removedAt ?? null,
        })),
        { onConflict: 'user_id,word' },
      );
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
      let collectionName: string;
      let dayNumber: number;
      if (suffix.includes('§')) {
        const sepIdx = suffix.indexOf('§');
        collectionName = suffix.slice(0, sepIdx);
        dayNumber = parseInt(suffix.slice(sepIdx + 1), 10);
      } else {
        const lastUnderscore = suffix.lastIndexOf('_');
        if (lastUnderscore === -1) continue;
        collectionName = suffix.slice(0, lastUnderscore);
        dayNumber = parseInt(suffix.slice(lastUnderscore + 1), 10);
      }
      if (isNaN(dayNumber)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      let p: { learnDone?: boolean; flashcardDone?: boolean; quizDone?: boolean; completedAt?: string | null };
      try { p = JSON.parse(raw); } catch { continue; }
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
    const key    = `lexivo_unit_progress_${collectionName}_${dayNumber}`;
    const keyOld = `lexivo_unit_progress_${collectionName}§${dayNumber}`; // legacy § key
    const raw = typeof window !== 'undefined' ? (localStorage.getItem(key) ?? localStorage.getItem(keyOld)) : null;
    if (!raw) return;
    let p: { learnDone?: boolean; flashcardDone?: boolean; quizDone?: boolean; completedAt?: string | null };
    try { p = JSON.parse(raw); } catch { return; }
    const learnDone     = p.learnDone     ?? false;
    const flashcardDone = p.flashcardDone ?? false;
    const quizDone      = p.quizDone      ?? false;
    const allDone       = learnDone && flashcardDone && quizDone;
    const completedAt   = allDone ? (p.completedAt ?? new Date().toISOString()) : null;

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
  if (typeof window !== 'undefined' && localStorage.getItem('lexivo_resetting') === '1') return;
  const SNAPSHOT_KEY = 'lexivo_pull_snapshot';

  // Snapshot current localStorage state so we can rollback if pullAll throws mid-write
  if (typeof window !== 'undefined') {
    try {
      const snap: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if (k.startsWith('lexivo_') && k !== SNAPSHOT_KEY) {
          const v = localStorage.getItem(k);
          if (v !== null) snap[k] = v;
        }
      }
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
    } catch { /* snapshot write failed (localStorage full) — proceed without rollback */ }
  }

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
      const p = profile as unknown as ProfileRow;
      warnMissing('profiles', p as unknown as Record<string, unknown>, [
        'name','daily_goal','default_accent','auto_play_on_reveal','session_size',
        'font_size','study_order','quiz_direction','reduce_motion','show_on_leaderboard',
        'settings_updated_at',
      ]);
      // Record reset_at so checkAndHandleReset won't re-fire on fresh browser sessions
      const resetAt = p.reset_at;
      if (resetAt && typeof window !== 'undefined') localStorage.setItem('lexivo_last_seen_reset_at', resetAt);

      const existing = getSettings();
      const remoteNameTs = p.name_updated_at;
      const localNameTs  = getNameUpdatedAt();
      const useRemoteName = remoteNameTs !== null && (localNameTs === null || remoteNameTs > localNameTs);

      const remoteLevelTs = p.language_level_updated_at;
      const localLevelTs  = getLevelUpdatedAt();
      const useRemoteLevel = remoteLevelTs !== null && (localLevelTs === null || remoteLevelTs > localLevelTs);

      // Cache for the subsequent pushAll check in this sync cycle.
      const remoteSettingsTs = p.settings_updated_at;
      _lastPulledSettingsTs  = remoteSettingsTs;
      const localSettingsTs  = ls(K.settingsUpdatedAt);
      // Keep local only when both timestamps exist and local is strictly newer.
      // When either is missing we default to remote so new devices inherit cloud settings.
      const useRemoteSettings = localSettingsTs === null || remoteSettingsTs === null || remoteSettingsTs >= localSettingsTs;

      saveSettings({
        name:             useRemoteName     ? (p.name                  ?? 'Learner')                                          : existing.name,
        languageLevel:    useRemoteLevel    ? (p.language_level        ?? 'B1')           as UserSettings['languageLevel']    : existing.languageLevel,
        dailyGoal:        useRemoteSettings ? (p.daily_goal            ?? 10)                                                 : existing.dailyGoal,
        defaultAccent:    useRemoteSettings ? (p.default_accent        ?? 'us')           as UserSettings['defaultAccent']    : existing.defaultAccent,
        autoPlayOnReveal: useRemoteSettings ? (p.auto_play_on_reveal   ?? true)                                               : existing.autoPlayOnReveal,
        sessionSize:      useRemoteSettings ? (p.session_size          ?? 20)                                                 : existing.sessionSize,
        fontSize:         useRemoteSettings ? (p.font_size             ?? 'normal')       as UserSettings['fontSize']         : existing.fontSize,
        studyOrder:       useRemoteSettings ? (p.study_order           ?? 'random')       as UserSettings['studyOrder']       : existing.studyOrder,
        quizDirection:    useRemoteSettings ? (p.quiz_direction        ?? 'word-to-uz')   as UserSettings['quizDirection']    : existing.quizDirection,
        reduceMotion:     useRemoteSettings ? (p.reduce_motion         ?? false)                                              : existing.reduceMotion,
        showOnLeaderboard:useRemoteSettings ? (p.show_on_leaderboard   ?? true)                                               : existing.showOnLeaderboard,
        uiLanguage:       existing.uiLanguage,
      });
      setOnboarded();
      if (useRemoteName     && remoteNameTs)     saveNameUpdatedAt(remoteNameTs);
      if (useRemoteLevel    && remoteLevelTs)    saveLevelUpdatedAt(remoteLevelTs);
      if (useRemoteSettings && remoteSettingsTs) saveSettingsUpdatedAt(remoteSettingsTs);
      if (p.avatar_url) saveProfilePicUrl(p.avatar_url);
    }

    // user_stats
    const { data: stats } = await supabase.from('user_stats').select().eq('id', uid).maybeSingle();
    if (stats) {
      const s = stats as unknown as StatsRow;
      warnMissing('user_stats', s as unknown as Record<string, unknown>, [
        'xp','xp_updated_at','streak','freezes','total_days','today_xp','today_xp_date',
        'today_count','today_count_date','last_study_date','last_freeze_week','study_days',
      ]);
      // Cache cloud xp_updated_at so pushAll can skip the XP upsert when cloud is newer
      _lastPulledXpTs = s.xp_updated_at ?? null;
      // Accumulating counters: take max so locally earned progress isn't overwritten by a stale cloud value.
      // When cloud XP wins, also sync the timestamp so this tab agrees on which version is canonical.
      const localXp = parseInt(ls(K.xp) ?? '0', 10);
      const cloudXp = s.xp ?? 0;
      set(K.xp, Math.max(localXp, cloudXp));
      if (cloudXp > localXp && s.xp_updated_at) set(K.xpUpdatedAt, s.xp_updated_at);
      set(K.streak, Math.max(parseInt(ls(K.streak)  ?? '0', 10), s.streak  ?? 0));
      set(K.freezes,Math.max(parseInt(ls(K.freezes) ?? '0', 10), s.freezes ?? 0));
      set(K.totalDays, s.total_days ?? 0);

      // today_xp / today_count: only sync if the cloud value is from today (avoids resetting today's progress with yesterday's cloud data)
      const todayStr = localDateStr();
      const cloudXpDate    = s.today_xp_date;
      const cloudCountDate = s.today_count_date;
      if (cloudXpDate === todayStr) {
        const localXp = parseInt(ls(K.todayXp) ?? '0', 10);
        set(K.todayXp,    ls(K.todayXpDate) === todayStr ? Math.max(localXp, s.today_xp ?? 0) : (s.today_xp ?? 0));
        set(K.todayXpDate, cloudXpDate);
      }
      if (cloudCountDate === todayStr) {
        const localCount = parseInt(ls(K.todayCount) ?? '0', 10);
        set(K.todayCount,    ls(K.todayCountDate) === todayStr ? Math.max(localCount, s.today_count ?? 0) : (s.today_count ?? 0));
        set(K.todayCountDate, cloudCountDate);
      }

      // last_study_date: take the more recent of local and cloud
      const cloudLastStudy = s.last_study_date;
      const localLastStudy = ls(K.lastStudy);
      if (cloudLastStudy && (!localLastStudy || cloudLastStudy > localLastStudy)) {
        set(K.lastStudy, cloudLastStudy);
      }
      // Validate freeze week looks like "YYYY-Wnn" before writing (guards against corrupt 100KB+ values)
      const fwVal = s.last_freeze_week;
      if (fwVal && /^\d{4}-W\d{1,2}$/.test(fwVal)) set(K.lastFreezeWeek, fwVal);
      if (Array.isArray(s.study_days) && s.study_days.length > 0) {
        const local = getStudyDays();
        const merged = Array.from(new Set([...local, ...s.study_days])).sort();
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
      // Clamp before comparing so corrupt cloud values (e.g. reviewStage: 99) cannot
      // beat a valid local value in the merge, and never land in localStorage unclamped.
      const cloudStage = Math.min(Math.max((w.reviewStage ?? 0), 0), 4);
      const localStage = (existing?.reviewStage ?? 0);
      const cloudWins = !existing ||
        cloudStage > localStage ||
        (cloudStage === localStage && (w.nextReviewDate ?? '') > (existing.nextReviewDate ?? ''));
      if (cloudWins) localMap.set(key, { ...w, reviewStage: cloudStage });
    }
    // Write if cloud responded (even empty) — backfills id for any word still missing it
    if (srsRows !== null && localMap.size > 0) {
      set(K.srs, [...localMap.values()].map(
        w => w.id ? w : { ...w, id: `${w.collectionName}::${w.word}` }
      ));
    }

    // learned_words — delta merge: only fetch rows newer than the last pull watermark.
    // On the first pull (no watermark) the full table is fetched; subsequent pulls are cheap
    // index scans returning only newly learned words, cutting bandwidth by ~99% for active users.
    // Supabase's default page size is 1000, so we paginate to handle users with 1000+ words.
    const lastLearnedPullAt = ls(K.lastLearnedPullAt);
    const LEARNED_PAGE = 1000;
    let learnedRows: { word: string; collection: string | null; learned_at: string | null }[] = [];
    let learnedQueryOk = true;
    for (let offset = 0; ; offset += LEARNED_PAGE) {
      let q = supabase
        .from('learned_words')
        .select('word,collection,learned_at')
        .eq('user_id', uid)
        .range(offset, offset + LEARNED_PAGE - 1);
      if (lastLearnedPullAt) q = q.gt('learned_at', lastLearnedPullAt);
      const { data: page, error } = await q;
      if (error) { learnedQueryOk = false; break; }
      if (!page || page.length === 0) break;
      learnedRows.push(...page);
      if (page.length < LEARNED_PAGE) break; // last page — no need for another round-trip
    }
    if (learnedRows.length > 0) {
      const local = getLearnedWords();
      const localKeys = new Set(local.map(w => w.word));
      const toAdd = learnedRows
        .filter(r => !localKeys.has(r.word))
        .map(r => ({ word: r.word, collectionName: r.collection ?? '', learnedAt: r.learned_at ?? new Date().toISOString(), translation: '', topic: '', dayNumber: 0 }));
      if (toAdd.length > 0) set(K.learned, [...local, ...toAdd]);
      // Advance the watermark to the latest learned_at in this batch
      const maxTs = learnedRows.reduce((m, r) => ((r.learned_at ?? '') > m ? (r.learned_at ?? '') : m), '');
      if (maxTs) set(K.lastLearnedPullAt, maxTs);
    } else if (learnedQueryOk && !lastLearnedPullAt) {
      // First pull returned empty (new user with no learned words) — record the baseline
      // so future pulls use delta from this point forward
      set(K.lastLearnedPullAt, new Date().toISOString());
    }

    // starred_words — authoritative replace: cloud state wins so removals propagate cross-device
    const { data: starredRows } = await supabase.from('starred_words').select('word').eq('user_id', uid);
    if (starredRows !== null) {
      set(K.starred, starredRows.map(r => r.word as string));
    }

    // hard_words — timestamp merge: most-recent action (addedAt vs removedAt) wins per word
    const { data: hardRows } = await supabase.from('hard_words').select('word,added_at,removed_at').eq('user_id', uid);
    if (hardRows !== null) {
      const localEntries = getHardWordEntries();
      const merged = new Map<string, HardWordEntry>(localEntries.map(e => [e.word, e]));
      for (const r of hardRows) {
        const cloudEntry: HardWordEntry = {
          word: r.word as string,
          addedAt: (r.added_at as string) ?? new Date(0).toISOString(),
          ...(r.removed_at ? { removedAt: r.removed_at as string } : {}),
        };
        const local = merged.get(cloudEntry.word);
        if (!local) {
          merged.set(cloudEntry.word, cloudEntry);
        } else {
          const cloudLast = cloudEntry.removedAt ?? cloudEntry.addedAt;
          const localLast = local.removedAt ?? local.addedAt;
          if (cloudLast > localLast) merged.set(cloudEntry.word, cloudEntry);
        }
      }
      set(K.hardWords, [...merged.values()]);
    }

    // unit_progress — OR-merge: remote true always wins, local true never erased
    try {
      const { data: upRows } = await supabase.from('unit_progress')
        .select('collection_name,day_number,learn_done,flashcard_done,quiz_done,completed_at')
        .eq('user_id', uid);
      if (typeof window !== 'undefined' && upRows && upRows.length > 0) {
        const typedRows = upRows as unknown as UnitProgressRow[];
        for (const r of typedRows) {
          // Use _ separator to match what storage.ts's getUnitProgress reads.
          // Old pullAll wrote § keys — remove any legacy key so pushAll doesn't double-push.
          const key = `lexivo_unit_progress_${r.collection_name}_${r.day_number}`;
          const legacyKey = `lexivo_unit_progress_${r.collection_name}§${r.day_number}`;
          const existing = localStorage.getItem(key) ?? localStorage.getItem(legacyKey);
          localStorage.removeItem(legacyKey);
          let local: { learnDone: boolean; flashcardDone: boolean; quizDone: boolean; completedAt?: string | null };
          try { local = existing ? JSON.parse(existing) : { learnDone: false, flashcardDone: false, quizDone: false }; }
          catch { local = { learnDone: false, flashcardDone: false, quizDone: false }; }
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
      let local: string[] = [];
      try { local = JSON.parse(localStorage.getItem('lexivo_achievements') || '[]'); } catch { local = []; }
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
          updateFolderMap(
            (r.collection_name as string).slice(0, 200),
            (r.folder_name as string).slice(0, 200),
          );
        }
      }
      const cloudWords = importedRows.map(r => {
        const colName = ((r.collection_name as string) ?? 'My Words').slice(0, 200);
        const key = `${(r.word as string).toLowerCase()}__${colName.toLowerCase()}`;
        const localMatch = localByKey.get(key);
        return {
          word: (r.word as string).slice(0, 100),
          translation: ((r.translation as string) ?? '').slice(0, 300),
          definition: ((r.definition as string) ?? '').slice(0, 1000),
          example1: ((r.example1 as string) ?? '').slice(0, 500),
          example1Translation: ((r.example1_translation as string) ?? '').slice(0, 500),
          example2: ((r.example2 as string) ?? '').slice(0, 500),
          example2Translation: ((r.example2_translation as string) ?? '').slice(0, 500),
          language: ((r.language as string) ?? 'en-US').slice(0, 20),
          addedAt: (r.added_at as number) ?? 0,
          collectionName: colName,
          folderName: ((r.folder_name as string | null) ?? localMatch?.folderName)?.slice(0, 200),
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
      localStorage.removeItem(SNAPSHOT_KEY); // All writes succeeded — discard rollback snapshot
      window.dispatchEvent(new Event('lexivo-sync'));
    }
  } catch (e) {
    console.error('pullAll error:', e);
    // Rollback: restore the pre-sync localStorage state to avoid partially-written data
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (raw) {
        try {
          const snap: Record<string, string> = JSON.parse(raw);
          // Remove any keys written during the failed sync
          const toRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)!;
            if (k.startsWith('lexivo_') && k !== SNAPSHOT_KEY) toRemove.push(k);
          }
          toRemove.forEach(k => localStorage.removeItem(k));
          // Restore snapshotted values
          for (const [k, v] of Object.entries(snap)) localStorage.setItem(k, v);
          console.warn('pullAll: rolled back localStorage to pre-sync state');
        } catch { /* snapshot corrupt — leave state as-is */ }
      }
      localStorage.removeItem(SNAPSHOT_KEY);
    }
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

// ── Periodic sync with exponential backoff + circuit breaker ─────────────────

const BASE_INTERVAL_MS  = 30_000;
const MAX_INTERVAL_MS   = 10 * 60_000; // 10 minutes
const MAX_FAILURES      = 10;

let _syncTimer:      ReturnType<typeof setTimeout> | null = null;
let _syncStopped     = false;
let _failureCount    = 0;
// Cached xp_updated_at from the last pullAll — used by pushAll to skip the xp
// upsert when the cloud value is newer, preventing a stale tab from overwriting XP.
let _lastPulledXpTs: string | null = null;
// Same pattern for settings_updated_at: cache cloud timestamp so pushAll can
// skip the settings upsert when the cloud value is newer than the local one.
let _lastPulledSettingsTs: string | null = null;

function dispatch(name: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(name));
}

function scheduleSync(uid: string, delayMs: number) {
  if (_syncStopped) return;
  _syncTimer = setTimeout(() => runSync(uid), delayMs);
}

async function runSync(uid: string) {
  if (_syncStopped) return;
  // Skip sync entirely while a reset is in progress — pushAll would overwrite
  // the just-cleared localStorage with zeros back to Supabase, and pullAll
  // would restore deleted rows. The resetting tab calls stopSync() after this
  // window, but other tabs only see the flag via localStorage.
  if (typeof window !== 'undefined' && localStorage.getItem('lexivo_resetting') === '1') return;
  // Refresh the JWT before any Supabase calls. If the refresh token is gone
  // (user cleared cookies, server revoked session, etc.) stop the sync loop
  // rather than silently failing every 30 seconds.
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    console.warn('[sync] Session refresh failed — stopping sync:', refreshError.message);
    stopSync();
    dispatch('lexivo-sync-suspended');
    return;
  }
  dispatch('lexivo-sync-start');
  try {
    const wasReset = await checkAndHandleReset(uid);
    await pullAll(uid);
    if (!wasReset) await pushAll(uid);
    _failureCount = 0;
    dispatch('lexivo-sync-done');
    scheduleSync(uid, BASE_INTERVAL_MS);
  } catch {
    _failureCount++;
    dispatch('lexivo-sync-error');
    if (_failureCount >= MAX_FAILURES) {
      console.warn(`[sync] ${MAX_FAILURES} consecutive failures — suspending sync`);
      dispatch('lexivo-sync-suspended');
      _syncStopped = true;
      return;
    }
    // Exponential backoff: 30s, 60s, 120s, …, capped at 10 min
    const backoff = Math.min(BASE_INTERVAL_MS * 2 ** (_failureCount - 1), MAX_INTERVAL_MS);
    scheduleSync(uid, backoff);
  }
}

export function startSync(uid: string) {
  stopSync();
  _syncStopped  = false;
  _failureCount = 0;
  scheduleSync(uid, BASE_INTERVAL_MS);
}

export function stopSync() {
  _syncStopped = true;
  if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null; }
}
