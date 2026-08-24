-- ─────────────────────────────────────────────────────────────────────────────
-- Atomic pushStats() write via a single RPC, mirroring sync_profile_settings
-- Run this in Supabase SQL Editor
--
-- pushStats() (lib/sync.ts) did a SELECT to read the cloud row's total_xp/
-- streak, computed max(local, cloud) client-side, then a separate UPSERT to
-- write it back — the same read-then-write shape pushSettings() used to have
-- before sync_profile_settings() replaced it. Between that SELECT and
-- UPSERT, another device's own push could land with a newer xp/streak value;
-- this call's UPSERT would then silently overwrite it with a stale max()
-- computed from the now-outdated read. Doing the max() comparison inside a
-- single atomic UPSERT (GREATEST against the current row, not a
-- previously-read copy of it) closes that window entirely.
-- ─────────────────────────────────────────────────────────────────────────────

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
    p_user_id, p_xp, p_streak, p_streak_freezes, p_last_study_date, p_streak_bonus_date,
    p_last_freeze_week, p_show_on_leaderboard, p_study_days, p_review_days, p_word_goal_days,
    p_today_xp, p_today_xp_date, p_daily_words_learned, p_daily_words_date, p_stats_updated_at
  )
  on conflict (id) do update set
    -- Accumulators: never regress below whatever's already in the row.
    total_xp             = greatest(p_xp, user_data.total_xp),
    streak                = greatest(p_streak, user_data.streak),
    -- Freezes are spendable, not accumulated — the caller's value must win
    -- outright even if lower (e.g. right after spending one), matching the
    -- client's previous behavior of excluding freezes from the max() merge.
    streak_freezes        = p_streak_freezes,
    last_study_date        = p_last_study_date,
    streak_bonus_date      = p_streak_bonus_date,
    last_freeze_week       = p_last_freeze_week,
    show_on_leaderboard    = p_show_on_leaderboard,
    study_days             = p_study_days,
    review_days            = p_review_days,
    word_goal_days         = p_word_goal_days,
    -- The client only sends today_xp/today_xp_date (and the daily_words
    -- pair) when its own local "today" cache is fresh — coalesce onto the
    -- existing value when the caller passes null, matching how the old
    -- code omitted those keys from its upsert payload entirely rather than
    -- overwriting them with stale/zeroed data.
    today_xp                = coalesce(p_today_xp, user_data.today_xp),
    today_xp_date           = coalesce(p_today_xp_date, user_data.today_xp_date),
    daily_words_learned     = coalesce(p_daily_words_learned, user_data.daily_words_learned),
    daily_words_date        = coalesce(p_daily_words_date, user_data.daily_words_date),
    stats_updated_at        = p_stats_updated_at
  returning user_data.total_xp, user_data.streak;
end;
$function$;

grant execute on function public.sync_user_stats(
  uuid, integer, integer, integer, text, text, text, boolean, jsonb, jsonb, jsonb,
  integer, text, integer, text, text
) to anon, authenticated;
