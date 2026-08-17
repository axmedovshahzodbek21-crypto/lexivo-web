import { supabase } from './supabase';
import type { UserSettings, LearnedWord, SRSWord, UnitProgress, MyUnitProgress } from './types';
import { getSettings, saveSettings, getLearnedWords, getLearnedWordsRaw, getSRSWordsRaw, getImportedWordsRaw, localDateStr, getProfilePicUrl, saveProfilePicUrl } from './storage';
import type { HardWordEntry } from './storage';
import { getNotifSettings, saveNotifSettings } from './notifications';

const S = {
  statTs: 'lexivo_sync_stat_ts',
  settingsTs: 'lexivo_sync_settings_ts',
  listsTs: 'lexivo_sync_lists_ts',
};

function lsGet(key: string): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(key) ?? '';
}

function lsSet(key: string, val: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, val);
}

function lsJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

function getAllUnitProgress(): Record<string, UnitProgress> {
  if (typeof window === 'undefined') return {};
  const result: Record<string, UnitProgress> = {};
  const prefix = 'lexivo_unit_progress_';
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(prefix)) {
      try { const v = localStorage.getItem(k); if (v) result[k.slice(prefix.length)] = JSON.parse(v); }
      catch {}
    }
  }
  return result;
}

function getAllMyUnitProgress(): Record<string, MyUnitProgress> {
  if (typeof window === 'undefined') return {};
  const result: Record<string, MyUnitProgress> = {};
  const prefix = 'lexivo_my_unit_progress_';
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(prefix)) {
      try { const v = localStorage.getItem(k); if (v) result[k.slice(prefix.length)] = JSON.parse(v); }
      catch {}
    }
  }
  return result;
}

async function getUid(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user.id ?? null;
  } catch { return null; }
}

// ── Push ─────────────────────────────────────────────────────────────────────

export async function pushStats(): Promise<void> {
  const uid = await getUid();
  if (!uid) return;
  try {
    const ts = new Date().toISOString();
    const today = localDateStr();
    const todayXpDate = lsGet('lexivo_today_xp_date');
    const todayCountDate = lsGet('lexivo_today_count_date');
    const s = getSettings();

    // Accumulators must never regress the shared cloud row: fetch its current
    // values and take max(local, cloud) before writing, mirroring the max()
    // merge already applied on pull. Without this, a device pushing a lower
    // (stale) locally-computed total after another device already pushed a
    // higher one would silently erase the other device's earned XP/streak.
    const { data: cloudRow } = await supabase.from('user_data').select('total_xp, streak, streak_freezes').eq('id', uid).maybeSingle();
    const xp = Math.max(lsJSON<number>('lexivo_xp', 0), cloudRow?.total_xp ?? 0);
    const streak = Math.max(lsJSON<number>('lexivo_streak', 0), cloudRow?.streak ?? 0);
    const freezes = Math.max(lsJSON<number>('lexivo_freezes', 0), cloudRow?.streak_freezes ?? 0);

    const studyDays = lsJSON<string[]>('lexivo_study_days', []);
    const reviewDays = lsJSON<string[]>('lexivo_review_days', []);
    const wordGoalDays = lsJSON<string[]>('lexivo_word_goal_days', []);
    await Promise.all([
      supabase.from('user_data').upsert({
        id: uid,
        total_xp:            xp,
        streak:              streak,
        streak_freezes:      freezes,
        last_study_date:     lsGet('lexivo_last_study') || null,
        last_freeze_week:    lsGet('lexivo_last_freeze_week') || null,
        show_on_leaderboard: s.showOnLeaderboard ?? true,
        ...(todayXpDate === today ? {
          today_xp:      lsJSON<number>('lexivo_today_xp', 0),
          today_xp_date: today,
        } : {}),
        ...(todayCountDate === today ? {
          daily_words_learned: lsJSON<number>('lexivo_today_count', 0),
          daily_words_date:    today,
        } : {}),
        stats_updated_at:    ts,
      }),
      supabase.from('user_stats').upsert({
        id:               uid,
        xp:               xp,
        streak:           streak,
        freezes:          freezes,
        last_study_date:  lsGet('lexivo_last_study') || null,
        last_freeze_week: lsGet('lexivo_last_freeze_week') || null,
        total_days:       studyDays.length,
        study_days:       studyDays,
        review_days:      reviewDays,
        word_goal_days:   wordGoalDays,
        ...(todayXpDate === today ? {
          today_xp:      lsJSON<number>('lexivo_today_xp', 0),
          today_xp_date: today,
        } : {}),
        ...(todayCountDate === today ? {
          today_count:      lsJSON<number>('lexivo_today_count', 0),
          today_count_date: today,
        } : {}),
        xp_updated_at:    ts,
      }),
    ]);
    lsSet('lexivo_xp', JSON.stringify(xp));
    lsSet('lexivo_streak', JSON.stringify(streak));
    lsSet('lexivo_freezes', JSON.stringify(freezes));
    lsSet(S.statTs, ts);
  } catch {}
}

export async function pushSettings(): Promise<void> {
  const uid = await getUid();
  if (!uid) return;
  try {
    const s = getSettings();
    const ts = new Date().toISOString();
    const showOnLeaderboard = s.showOnLeaderboard ?? true;
    const notif = getNotifSettings();
    await Promise.all([
      supabase.from('user_data').upsert({
        id: uid,
        daily_word_goal:     s.dailyGoal,
        quiz_direction:      s.quizDirection,
        reduce_motion:       s.reduceMotion,
        show_on_leaderboard: showOnLeaderboard,
        user_name:           s.name,
        language_level:      s.languageLevel,
        notifications_enabled: notif.enabled,
        notif_time:            notif.time,
        ...(getProfilePicUrl() ? { avatar_url: getProfilePicUrl() } : {}),
        settings_updated_at: ts,
      }),
      supabase.from('profiles').upsert({
        id:                  uid,
        name:                s.name,
        show_on_leaderboard: showOnLeaderboard,
        language_level:      s.languageLevel,
        ...(getProfilePicUrl() ? { avatar_url: getProfilePicUrl() } : {}),
      }),
    ]);
    lsSet(S.settingsTs, ts);
  } catch {}
}

export async function pushLists(): Promise<void> {
  const uid = await getUid();
  if (!uid) return;
  try {
    // Merge in whatever's currently in the cloud row before overwriting it —
    // otherwise a device pushing after being offline (or racing another
    // device's own push) would silently discard the other side's data
    // instead of just adding to it.
    const { data: cloudRow } = await supabase.from('user_data')
      .select('learned_words, srs_words, starred_words, hard_words, study_days, review_days, word_goal_days, unit_done_days, xp_history, unit_progress, my_unit_progress, review_log, achievements, imported_words')
      .eq('id', uid).maybeSingle();
    if (cloudRow) mergeListsFromCloudRow(cloudRow);

    const ts = new Date().toISOString();
    const learnedWords = getLearnedWords(); // live-only, for the per-record learned_words table below
    const promises = [
      supabase.from('user_data').upsert({
        id: uid,
        learned_words:    getLearnedWordsRaw(), // includes tombstones so unlearning propagates
        srs_words:        getSRSWordsRaw(),     // includes tombstones so unlearning propagates
        starred_words:    lsJSON<string[]>('lexivo_starred', []),
        hard_words:       lsJSON<HardWordEntry[]>('lexivo_hard_words', []),
        study_days:       lsJSON<string[]>('lexivo_study_days', []),
        review_days:      lsJSON<string[]>('lexivo_review_days', []),
        word_goal_days:   lsJSON<string[]>('lexivo_word_goal_days', []),
        unit_done_days:   lsJSON<string[]>('lexivo_unit_done_days', []),
        xp_history:       lsJSON<unknown[]>('lexivo_xp_history', []),
        unit_progress:    getAllUnitProgress(),
        my_unit_progress: getAllMyUnitProgress(),
        review_log:       lsJSON<Record<string, number[]>>('lexivo_review_log', {}),
        imported_words:   getImportedWordsRaw(), // includes tombstones so deletions propagate
        achievements:     Object.entries(lsJSON<Record<string, string>>('lexivo_achievement_dates', {})).map(([id, date]) => ({ id, date })),
        lists_updated_at: ts,
      }),
    ];
    if (learnedWords.length > 0) {
      promises.push(
        supabase.from('learned_words').upsert(
          learnedWords.map(w => ({
            user_id:    uid,
            word:       w.word,
            collection: w.collectionName,
            learned_at: w.learnedAt,
          })),
          { onConflict: 'user_id,word,collection', ignoreDuplicates: true }
        )
      );
    }
    await Promise.all(promises);
    lsSet(S.listsTs, ts);
  } catch {}
}

export async function pushAll(): Promise<void> {
  await Promise.all([pushStats(), pushSettings(), pushLists()]);
}

// ── Pull ─────────────────────────────────────────────────────────────────────

export async function pullAll(): Promise<void> {
  const uid = await getUid();
  if (!uid) return;
  try {
    const { data: row } = await supabase.from('user_data').select().eq('id', uid).maybeSingle();

    if (!row) {
      await pushAll();
      return;
    }

    // Cross-device reset: cloud carries a newer reset_at — clear local data
    // instead of pushing old data back overtop the reset.
    const cloudResetAt = (row.reset_at as string) ?? '';
    const localResetAt = lsGet('lexivo_last_reset_at');
    if (cloudResetAt && cloudResetAt > localResetAt) {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if (k.startsWith('lexivo_') && k !== 'lexivo_ui_lang' && k !== 'lexivo_last_reset_at' && k !== 'lexivo_onboarded') {
          toRemove.push(k);
        }
      }
      toRemove.forEach(k => localStorage.removeItem(k));
      lsSet('lexivo_last_reset_at', cloudResetAt);
      return;
    }

    // Row exists but was created empty (other platform pushed before having data).
    // Push local state on top so real data wins.
    if (!row.stats_updated_at && !row.lists_updated_at) {
      await pushAll();
      return;
    }

    // ── Stats ────────────────────────────────────────────────────────────────
    const cloudStatsTs = (row.stats_updated_at as string) ?? '';
    const localStatsTs = lsGet(S.statTs);
    const cloudStatsNewer = cloudStatsTs > localStatsTs;

    // Accumulators: always take max
    lsSet('lexivo_xp', JSON.stringify(Math.max(lsJSON<number>('lexivo_xp', 0), row.total_xp ?? 0)));
    lsSet('lexivo_streak', JSON.stringify(Math.max(lsJSON<number>('lexivo_streak', 0), row.streak ?? 0)));
    lsSet('lexivo_freezes', JSON.stringify(Math.max(lsJSON<number>('lexivo_freezes', 0), row.streak_freezes ?? 0)));

    // Daily accumulators: always take max regardless of which side has newer timestamp
    const today = localDateStr();
    if (row.today_xp_date === today) {
      const localTodayXp = lsGet('lexivo_today_xp_date') === today ? lsJSON<number>('lexivo_today_xp', 0) : 0;
      lsSet('lexivo_today_xp', JSON.stringify(Math.max(row.today_xp ?? 0, localTodayXp)));
      lsSet('lexivo_today_xp_date', today);
    }
    if (row.daily_words_date === today) {
      const localCount = lsGet('lexivo_today_count_date') === today ? lsJSON<number>('lexivo_today_count', 0) : 0;
      lsSet('lexivo_today_count', JSON.stringify(Math.max(row.daily_words_learned ?? 0, localCount)));
      lsSet('lexivo_today_count_date', today);
    }

    if (cloudStatsNewer) {
      if (row.last_study_date && row.last_study_date >= (lsGet('lexivo_last_study') || '')) {
        lsSet('lexivo_last_study', row.last_study_date);
      }
      if (row.last_freeze_week) lsSet('lexivo_last_freeze_week', row.last_freeze_week);
      lsSet(S.statTs, cloudStatsTs);
    }

    // ── Settings ─────────────────────────────────────────────────────────────
    const cloudSettingsTs = (row.settings_updated_at as string) ?? '';
    const localSettingsTs = lsGet(S.settingsTs);
    if (cloudSettingsTs > localSettingsTs) {
      const current = getSettings();
      const merged: UserSettings = {
        ...current,
        ...(row.daily_word_goal != null  && { dailyGoal: row.daily_word_goal }),
        ...(row.quiz_direction != null   && { quizDirection: row.quiz_direction }),
        ...(row.reduce_motion != null    && { reduceMotion: row.reduce_motion }),
        ...(row.show_on_leaderboard != null && { showOnLeaderboard: row.show_on_leaderboard }),
        ...(row.user_name != null        && { name: row.user_name }),
        ...(row.language_level != null   && { languageLevel: row.language_level as UserSettings['languageLevel'] }),
      };
      saveSettings(merged);
      if (row.avatar_url) saveProfilePicUrl(row.avatar_url as string);
      if (row.notifications_enabled != null || row.notif_time != null) {
        const currentNotif = getNotifSettings();
        saveNotifSettings({
          enabled: row.notifications_enabled ?? currentNotif.enabled,
          time:    (row.notif_time as string) ?? currentNotif.time,
        });
      }
      lsSet(S.settingsTs, cloudSettingsTs);
    }
    // Apply avatar_url even when settings timestamp didn't win (pic upload is independent)
    if (row.avatar_url && !getProfilePicUrl()) {
      saveProfilePicUrl(row.avatar_url as string);
    }

    mergeListsFromCloudRow(row);
  } catch {}
}

// Merges every list-type field from a cloud `user_data` row into local
// storage (additive union-merge / tombstone-aware last-write-wins, depending
// on the field — see comments per field below). Shared by pullAll() and by
// pushLists(), which calls this immediately before building its push payload
// so a push can never silently discard data another device already synced —
// without this, pushLists() overwrote the whole row with only-local state.
function mergeListsFromCloudRow(row: Record<string, unknown>): void {
  try {
    // learned_words — per-record last-write-wins merge (keyed by
    // word+collection). Cloud rows may include tombstones (deletedAt), so an
    // unlearn made on another device correctly overwrites a stale local copy
    // instead of a naive add-only merge silently resurrecting it.
    if (Array.isArray(row.learned_words) && row.learned_words.length > 0) {
      const local = lsJSON<LearnedWord[]>('lexivo_learned_words', []);
      const keyOf = (w: LearnedWord) => `${w.word}::${w.collectionName}`;
      const tsOf = (w: LearnedWord) => w.deletedAt ?? Date.parse(w.learnedAt) ?? 0;
      const byKey = new Map<string, LearnedWord>(local.map(w => [keyOf(w), w]));
      let learnedChanged = false;
      for (const cw of row.learned_words as LearnedWord[]) {
        const key = keyOf(cw);
        const existing = byKey.get(key);
        if (!existing || tsOf(cw) > tsOf(existing)) {
          byKey.set(key, cw);
          learnedChanged = true;
        }
      }
      if (learnedChanged) lsSet('lexivo_learned_words', JSON.stringify([...byKey.values()]));
    }

    // srs_words: union by key; when both sides are live, take the higher
    // reviewStage (preserves real review progress, matching Flutter's local
    // model); when either side is a tombstone (deletedAt), last-write-wins by
    // timestamp instead, so an unlearn on another device isn't undone.
    if (Array.isArray(row.srs_words) && row.srs_words.length > 0) {
      const local = lsJSON<SRSWord[]>('lexivo_srs_words', []);
      const localMap = new Map(local.map((w: SRSWord) => [`${w.collectionName}::${w.word}`, w]));
      const tsOf = (w: SRSWord) => w.deletedAt ?? Date.parse(w.learnedAt) ?? 0;
      let changed = false;
      for (const cw of row.srs_words as Record<string, unknown>[]) {
        const key = `${cw['collectionName']}::${cw['word']}`;
        const lw = localMap.get(key);
        if (lw && (cw['deletedAt'] != null || lw.deletedAt != null)) {
          if (tsOf(cw as unknown as SRSWord) > tsOf(lw)) {
            localMap.set(key, cw as unknown as SRSWord);
            changed = true;
          }
        } else if (lw) {
          const cloudStage = (cw['reviewStage'] as number) ?? 0;
          const localStage = (lw as unknown as Record<string, unknown>)['reviewStage'] as number ?? 0;
          if (cloudStage > localStage) {
            localMap.set(key, cw as unknown as SRSWord);
            changed = true;
          }
        } else {
          // Add new word from cloud; reviewLog tracks its progress independently
          localMap.set(key, { ...cw, id: cw['id'] ?? key } as unknown as SRSWord);
          changed = true;
        }
      }
      if (changed) lsSet('lexivo_srs_words', JSON.stringify([...localMap.values()]));
    }

    // starred_words (web stores as string[], cloud pushes as string[])
    if (Array.isArray(row.starred_words) && row.starred_words.length > 0) {
      const local = lsJSON<string[]>('lexivo_starred', []);
      const localSet = new Set(local);
      let changed = false;
      for (const w of row.starred_words as string[]) {
        if (!localSet.has(w)) { local.push(w); localSet.add(w); changed = true; }
      }
      if (changed) lsSet('lexivo_starred', JSON.stringify(local));
    }

    // hard_words (HardWordEntry[]) — per-word last-write-wins by the entry's
    // effective timestamp (removedAt if present, else addedAt). The previous
    // comparison only looked at addedAt, so a tombstone (removedAt set, same
    // addedAt as the local live entry) never actually won the comparison —
    // an unmark on another device could never propagate.
    if (Array.isArray(row.hard_words) && row.hard_words.length > 0) {
      const local = lsJSON<HardWordEntry[]>('lexivo_hard_words', []);
      const localMap = new Map(local.map((e: HardWordEntry) => [e.word, e]));
      const tsOf = (e: HardWordEntry) => e.removedAt && e.removedAt > e.addedAt ? e.removedAt : e.addedAt;
      let changed = false;
      for (const raw of row.hard_words as (HardWordEntry | string)[]) {
        const ce: HardWordEntry = typeof raw === 'string'
          ? { word: raw, addedAt: '1970-01-01T00:00:00.000Z' }
          : raw;
        const le = localMap.get(ce.word);
        if (!le || tsOf(ce) > tsOf(le)) {
          localMap.set(ce.word, ce);
          changed = true;
        }
      }
      if (changed) lsSet('lexivo_hard_words', JSON.stringify([...localMap.values()]));
    }

    // day sets
    for (const [cloudKey, localKey] of [
      ['study_days', 'lexivo_study_days'],
      ['review_days', 'lexivo_review_days'],
      ['word_goal_days', 'lexivo_word_goal_days'],
      ['unit_done_days', 'lexivo_unit_done_days'],
    ] as const) {
      if (Array.isArray(row[cloudKey]) && row[cloudKey].length > 0) {
        const local = lsJSON<string[]>(localKey, []);
        const merged = [...new Set([...local, ...row[cloudKey] as string[]])];
        if (merged.length > local.length) lsSet(localKey, JSON.stringify(merged));
      }
    }

    // xp_history: union by timestamp
    if (Array.isArray(row.xp_history) && row.xp_history.length > 0) {
      const local = lsJSON<{timestamp: number}[]>('lexivo_xp_history', []);
      const localTs = new Set(local.map(e => e.timestamp));
      const toAdd = (row.xp_history as {timestamp: number}[]).filter(e => !localTs.has(e.timestamp));
      if (toAdd.length > 0) {
        const merged = [...local, ...toAdd].sort((a, b) => a.timestamp - b.timestamp);
        if (merged.length > 500) merged.splice(0, merged.length - 500);
        lsSet('lexivo_xp_history', JSON.stringify(merged));
      }
    }

    // unit_progress: per-key, OR flags
    if (row.unit_progress && typeof row.unit_progress === 'object') {
      const prefix = 'lexivo_unit_progress_';
      for (const [unitKey, cp] of Object.entries(row.unit_progress as Record<string, UnitProgress>)) {
        const lsKey = prefix + unitKey;
        const existing = localStorage.getItem(lsKey);
        if (!existing) {
          lsSet(lsKey, JSON.stringify(cp));
        } else {
          const lp: UnitProgress = JSON.parse(existing);
          const merged: UnitProgress = {
            learnDone:     lp.learnDone     || cp.learnDone,
            flashcardDone: lp.flashcardDone || cp.flashcardDone,
            quizDone:      lp.quizDone      || cp.quizDone,
            matchDone:     (lp.matchDone    || cp.matchDone) ?? false,
            completedAt:   lp.completedAt   ?? cp.completedAt,
          };
          lsSet(lsKey, JSON.stringify(merged));
        }
      }
    }

    // my_unit_progress: per-key (folder+collection), OR flags + per-activity word snapshots
    if (row.my_unit_progress && typeof row.my_unit_progress === 'object') {
      const prefix = 'lexivo_my_unit_progress_';
      for (const [unitKey, cp] of Object.entries(row.my_unit_progress as Record<string, MyUnitProgress>)) {
        const lsKey = prefix + unitKey;
        const existing = localStorage.getItem(lsKey);
        if (!existing) {
          lsSet(lsKey, JSON.stringify(cp));
        } else {
          const lp: MyUnitProgress = JSON.parse(existing);
          const pick = (activity: 'learn' | 'flashcard' | 'quiz' | 'match') => {
            const doneKey = `${activity}Done` as const;
            const wordsKey = `${activity}Words` as const;
            const done = lp[doneKey] || cp[doneKey];
            // Local's own snapshot wins once local has run the activity; only
            // take cloud's snapshot when local hasn't done it yet itself.
            const words = lp[doneKey] ? lp[wordsKey] : (cp[doneKey] ? cp[wordsKey] : lp[wordsKey]);
            return { done, words };
          };
          const learn = pick('learn');
          const flashcard = pick('flashcard');
          const quiz = pick('quiz');
          const match = pick('match');
          const merged: MyUnitProgress = {
            learnDone: learn.done, learnWords: learn.words,
            flashcardDone: flashcard.done, flashcardWords: flashcard.words,
            quizDone: quiz.done, quizWords: quiz.words,
            matchDone: match.done, matchWords: match.words,
            completedAt: lp.completedAt ?? cp.completedAt,
            completedWords: lp.completedWords.length > 0 ? lp.completedWords : cp.completedWords,
          };
          lsSet(lsKey, JSON.stringify(merged));
        }
      }
    }

    // review_log: per-word union merge
    if (row.review_log && typeof row.review_log === 'object') {
      const local = lsJSON<Record<string, number[]>>('lexivo_review_log', {});
      let changed = false;
      for (const [wordKey, intervals] of Object.entries(row.review_log as Record<string, number[]>)) {
        const localIntervals = local[wordKey] ?? [];
        const merged = [...new Set([...localIntervals, ...intervals])];
        if (merged.length > localIntervals.length) { local[wordKey] = merged; changed = true; }
      }
      if (changed) lsSet('lexivo_review_log', JSON.stringify(local));
    }

    // achievements: union by id, write to both lexivo_achievements and lexivo_achievement_dates
    if (Array.isArray(row.achievements) && row.achievements.length > 0) {
      const dates = lsJSON<Record<string, string>>('lexivo_achievement_dates', {});
      const unlocked = lsJSON<string[]>('lexivo_achievements', []);
      const unlockedSet = new Set(unlocked);
      let changed = false;
      for (const ach of row.achievements as { id: string; date: string }[]) {
        if (!dates[ach.id]) {
          dates[ach.id] = ach.date;
          if (!unlockedSet.has(ach.id)) { unlocked.push(ach.id); unlockedSet.add(ach.id); }
          changed = true;
        }
      }
      if (changed) {
        lsSet('lexivo_achievement_dates', JSON.stringify(dates));
        lsSet('lexivo_achievements', JSON.stringify(unlocked));
      }
    }

    // imported_words — per-record last-write-wins merge (keyed by word+collection+folder).
    // Cloud rows include tombstones (deletedAt), so a deletion made on another
    // device correctly overwrites a stale local copy instead of being ignored.
    if (Array.isArray(row.imported_words)) {
      const local = lsJSON<Record<string, unknown>[]>('lexivo_imported_words', []);
      const keyOf = (w: Record<string, unknown>) => `${w['word']}__${w['collectionName'] ?? ''}__${w['folderName'] ?? ''}`;
      const tsOf = (w: Record<string, unknown>) => (w['deletedAt'] as number | undefined) ?? (w['addedAt'] as number | undefined) ?? 0;
      const byKey = new Map<string, Record<string, unknown>>();
      for (const w of local) byKey.set(keyOf(w), w);
      let changed = false;
      for (const w of row.imported_words as Record<string, unknown>[]) {
        const key = keyOf(w);
        const existing = byKey.get(key);
        if (!existing || tsOf(w) > tsOf(existing)) {
          byKey.set(key, w);
          changed = true;
        }
      }
      if (changed) lsSet('lexivo_imported_words', JSON.stringify(Array.from(byKey.values())));
    }
  } catch {}
}
