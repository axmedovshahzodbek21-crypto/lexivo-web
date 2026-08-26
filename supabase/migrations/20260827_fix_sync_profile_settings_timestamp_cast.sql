-- ─────────────────────────────────────────────────────────────────────────────
-- Fix sync_profile_settings: p_settings_updated_at is a `text` parameter, and
-- Postgres does NOT implicitly cast a typed text value into a timestamptz
-- column (only untyped string literals get that free conversion) — every
-- call was failing with "column \"settings_updated_at\" is of type timestamp
-- with time zone but expression is of type text", silently breaking settings
-- sync (and, transitively, the leaderboard page's load(), which awaits
-- pushSettings() alongside pushStats()).
-- Run this in Supabase SQL Editor
--
-- Identical to the function's existing live definition (fetched via
-- pg_get_functiondef) except for the added ::timestamptz cast.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.sync_profile_settings(
  p_user_id uuid,
  p_daily_word_goal integer,
  p_quiz_direction text,
  p_reduce_motion boolean,
  p_show_on_leaderboard boolean,
  p_notifications_enabled boolean,
  p_notif_time text,
  p_user_name text,
  p_language_level text,
  p_avatar_url text,
  p_settings_updated_at text,
  p_clear_avatar boolean default false
) returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into user_data (
    id, daily_word_goal, quiz_direction, reduce_motion, show_on_leaderboard,
    notifications_enabled, notif_time, user_name, language_level, avatar_url,
    settings_updated_at
  )
  values (
    p_user_id, p_daily_word_goal, p_quiz_direction, p_reduce_motion, p_show_on_leaderboard,
    p_notifications_enabled, p_notif_time, p_user_name, p_language_level, p_avatar_url,
    p_settings_updated_at::timestamptz
  )
  on conflict (id) do update set
    daily_word_goal        = excluded.daily_word_goal,
    quiz_direction          = excluded.quiz_direction,
    reduce_motion           = excluded.reduce_motion,
    show_on_leaderboard     = excluded.show_on_leaderboard,
    notifications_enabled   = excluded.notifications_enabled,
    notif_time              = excluded.notif_time,
    user_name               = excluded.user_name,
    language_level          = excluded.language_level,
    avatar_url              = case when p_clear_avatar then null
                                    else coalesce(excluded.avatar_url, user_data.avatar_url) end,
    settings_updated_at     = excluded.settings_updated_at;

  insert into profiles (id, name, show_on_leaderboard, language_level, avatar_url)
  values (p_user_id, p_user_name, p_show_on_leaderboard, p_language_level, p_avatar_url)
  on conflict (id) do update set
    name                 = excluded.name,
    show_on_leaderboard  = excluded.show_on_leaderboard,
    language_level       = excluded.language_level,
    avatar_url           = case when p_clear_avatar then null
                                 else coalesce(excluded.avatar_url, profiles.avatar_url) end;
end;
$function$;
