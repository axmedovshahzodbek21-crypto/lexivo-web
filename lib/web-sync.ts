import { supabase } from './supabase';
import {
  getSettings, saveSettings, setOnboarded,
  getLearnedWords, getSRSWords, getStarredWords,
  getXP, getTodayXP, getStreak, getFreezes, getTotalStudyDays,
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

    await supabase.from('profiles').upsert({
      id: uid,
      name: settings.name,
      language_level: settings.languageLevel,
      daily_goal: settings.dailyGoal,
      default_accent: settings.defaultAccent,
      auto_play_on_reveal: settings.autoPlayOnReveal,
      session_size: settings.sessionSize,
      font_size: settings.fontSize,
      study_order: settings.studyOrder,
      quiz_direction: settings.quizDirection,
      reduce_motion: settings.reduceMotion,
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

    // unit_progress
    if (typeof window !== 'undefined') {
      const upRows: {
        user_id: string; collection_name: string; day_number: number;
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
        upRows.push({
          user_id: uid, collection_name: collectionName, day_number: dayNumber,
          learn_done: p.learnDone ?? false,
          flashcard_done: p.flashcardDone ?? false,
          quiz_done: p.quizDone ?? false,
        });
      }
      if (upRows.length > 0) {
        try {
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
      saveSettings({
        name:            profile.name            ?? 'Learner',
        languageLevel:   profile.language_level  ?? 'B1',
        dailyGoal:       profile.daily_goal       ?? 10,
        defaultAccent:   profile.default_accent   ?? 'us',
        autoPlayOnReveal:profile.auto_play_on_reveal ?? true,
        sessionSize:     profile.session_size     ?? 20,
        fontSize:        profile.font_size        ?? 'normal',
        studyOrder:      profile.study_order      ?? 'random',
        quizDirection:   profile.quiz_direction   ?? 'word-to-uz',
        reduceMotion:    profile.reduce_motion    ?? false,
      });
      setOnboarded();
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

  } catch (e) {
    console.error('pullAll error:', e);
  }
}

// ── Periodic sync ─────────────────────────────────────────────────────────────

let _syncInterval: ReturnType<typeof setInterval> | null = null;

export function startSync(uid: string) {
  stopSync();
  _syncInterval = setInterval(() => pushAll(uid), 30_000);
}

export function stopSync() {
  if (_syncInterval) { clearInterval(_syncInterval); _syncInterval = null; }
}
