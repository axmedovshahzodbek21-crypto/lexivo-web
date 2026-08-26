-- ─────────────────────────────────────────────────────────────────────────────
-- Three more sync-breaking bugs found live-debugging the leaderboard/XP flow
-- (same root pattern as 20260827_fix_sync_profile_settings_timestamp_cast.sql:
-- text-typed function parameters don't auto-cast into non-text columns).
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) sync_user_stats: streak_bonus_date is `date`, stats_updated_at is
--    `timestamptz` — both were being assigned straight from their `text`
--    parameters. Identical to the live definition otherwise.
create or replace function public.sync_user_stats(
  p_user_id uuid,
  p_xp integer,
  p_streak integer,
  p_streak_freezes integer,
  p_last_study_date text,
  p_streak_bonus_date text,
  p_last_freeze_week text,
  p_show_on_leaderboard boolean,
  p_study_days jsonb,
  p_review_days jsonb,
  p_word_goal_days jsonb,
  p_today_xp integer,
  p_today_xp_date text,
  p_daily_words_learned integer,
  p_daily_words_date text,
  p_stats_updated_at text
) returns table(total_xp integer, streak integer)
language plpgsql
security definer
set search_path = public
as $function$
begin
  return query
  insert into user_data (
    id, total_xp, streak, streak_freezes, last_study_date, streak_bonus_date,
    last_freeze_week, show_on_leaderboard, study_days, review_days, word_goal_days,
    today_xp, today_xp_date, daily_words_learned, daily_words_date, stats_updated_at
  ) values (
    p_user_id, p_xp, p_streak, p_streak_freezes, p_last_study_date, p_streak_bonus_date::date,
    p_last_freeze_week, p_show_on_leaderboard, p_study_days, p_review_days, p_word_goal_days,
    p_today_xp, p_today_xp_date, p_daily_words_learned, p_daily_words_date, p_stats_updated_at::timestamptz
  )
  on conflict (id) do update set
    total_xp             = greatest(p_xp, user_data.total_xp),
    streak                = greatest(p_streak, user_data.streak),
    streak_freezes        = p_streak_freezes,
    last_study_date        = p_last_study_date,
    streak_bonus_date      = p_streak_bonus_date::date,
    last_freeze_week       = p_last_freeze_week,
    show_on_leaderboard    = p_show_on_leaderboard,
    study_days             = p_study_days,
    review_days            = p_review_days,
    word_goal_days         = p_word_goal_days,
    today_xp                = coalesce(p_today_xp, user_data.today_xp),
    today_xp_date           = coalesce(p_today_xp_date, user_data.today_xp_date),
    daily_words_learned     = coalesce(p_daily_words_learned, user_data.daily_words_learned),
    daily_words_date        = coalesce(p_daily_words_date, user_data.daily_words_date),
    stats_updated_at        = p_stats_updated_at::timestamptz
  returning user_data.total_xp, user_data.streak;
end;
$function$;

-- 2) sync_learning_prefs: same settings_updated_at text->timestamptz gap as
--    sync_profile_settings had.
create or replace function public.sync_learning_prefs(
  p_user_id uuid,
  p_session_size integer,
  p_study_order text,
  p_default_accent text,
  p_pulse_enabled boolean,
  p_pulse_speed text,
  p_font_size text,
  p_auto_play_on_reveal boolean,
  p_settings_updated_at text
) returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into user_data (
    id, session_size, study_order, default_accent, pulse_enabled, pulse_speed,
    font_size, auto_play_on_reveal, settings_updated_at
  ) values (
    p_user_id, p_session_size, p_study_order, p_default_accent, p_pulse_enabled, p_pulse_speed,
    p_font_size, p_auto_play_on_reveal, p_settings_updated_at::timestamptz
  )
  on conflict (id) do update set
    session_size         = coalesce(p_session_size, user_data.session_size),
    study_order           = coalesce(p_study_order, user_data.study_order),
    default_accent         = coalesce(p_default_accent, user_data.default_accent),
    pulse_enabled           = coalesce(p_pulse_enabled, user_data.pulse_enabled),
    pulse_speed             = coalesce(p_pulse_speed, user_data.pulse_speed),
    font_size               = coalesce(p_font_size, user_data.font_size),
    auto_play_on_reveal     = coalesce(p_auto_play_on_reveal, user_data.auto_play_on_reveal),
    settings_updated_at     = p_settings_updated_at::timestamptz;
end;
$function$;

-- 3) learned_words: the client's pushLists() upserts on
--    onConflict: 'user_id,word,collection' (a word can be independently
--    tracked as learned per-collection), but the live table only had a
--    2-column (user_id, word) unique constraint — every upsert with more
--    than zero learned words failed outright with "no unique or exclusion
--    constraint matching the ON CONFLICT specification".
alter table public.learned_words
  drop constraint if exists learned_words_user_id_word_key;
alter table public.learned_words
  add constraint learned_words_user_id_word_collection_key unique (user_id, word, collection);
