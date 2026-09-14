-- ─────────────────────────────────────────────────────────────────────────────
-- Scheduled engagement push (due reviews / streak risk / homework / idle class)
--
-- Adds a second push pathway alongside the existing event-triggered one
-- (notify_push() in 20260820_push_notifications.sql): a daily pg_cron scan
-- that reacts to time passing / inaction rather than a row being inserted.
-- See the approved plan (linked-forging-cookie) for full context.
--
-- This migration touches `classes`, `class_targets`, and `class_announcements`,
-- which — same caveat as 20260820_push_notifications.sql — predate tracked
-- migrations and were created directly in Supabase Studio. Column names used
-- here (classes.id/name/teacher_id/created_at, class_targets.class_id/
-- due_date/completed_at/created_at, class_announcements.class_id/created_at)
-- were confirmed against information_schema.columns on 2026-09-14.
--
-- Requires the pg_cron and pg_net extensions (Database → Extensions).
-- Requires the same `push_trigger_secret` Vault secret used by
-- notify_push() (see 20260820_push_notifications.sql for how it's created)
-- and the ONESIGNAL_REST_API_KEY / PUSH_TRIGGER_SECRET Edge Function
-- secrets, now also read by the new `send-scheduled-push` function
-- (`supabase secrets set` — same values, no new secrets needed).
--
-- Before running this file, replace <PROJECT_REF> if this project's ref
-- differs from the one already hardcoded into notify_push()'s URL.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Per-type push preferences, replacing the single push_enabled switch ──

alter table profiles add column if not exists push_prefs jsonb not null default '{
  "class_activity": true,
  "due_reviews": true,
  "streak_risk": true,
  "homework_reminders": true,
  "class_idle": true
}'::jsonb;

-- Backfill: existing on/off value applies to every sub-type so current
-- opted-in users keep getting class_activity pushes with no behavior change,
-- and default to the same value for the four new types rather than silently
-- opting them in/out of something they never chose.
update profiles set push_prefs = jsonb_build_object(
  'class_activity', push_enabled,
  'due_reviews', push_enabled,
  'streak_risk', push_enabled,
  'homework_reminders', push_enabled,
  'class_idle', push_enabled
);

alter table profiles drop column push_enabled;

-- ── 2. Idempotency / throttle log for the scheduled job ──

create table if not exists push_notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  notification_type text not null,
  class_id uuid,
  sent_on date not null,
  created_at timestamptz not null default now(),
  -- `nulls not distinct`: class_id is null for every personal (non-class)
  -- notification type (due_reviews, streak_risk, homework_reminders is
  -- personal too — only class_idle carries a real class_id). Postgres's
  -- default uniqueness treats null <> null, so a plain `unique(...)` would
  -- let the ON CONFLICT DO NOTHING idempotency check in send-scheduled-push
  -- silently miss every personal-type duplicate and re-send on a rerun.
  unique nulls not distinct (user_id, notification_type, class_id, sent_on)
);
alter table push_notification_log enable row level security;
-- No policies: only the Edge Function (service role, which bypasses RLS
-- entirely) ever touches this table — same "RLS enabled, no policies"
-- posture as other service-role-only tables in this codebase.

-- ── 3. Server-side due-count, so personal (non-class) SRS can drive a push ──
-- Personal review due-state lives only on-device (lib/storage.ts getDueWords);
-- this column lets the client push its own computed count up so the
-- scheduled job has something to query. Matches the add-column pattern used
-- for daily_words_learned/daily_words_date (20260825_atomic_sync_user_stats.sql).

alter table user_data add column if not exists due_words_count integer;

-- ── 4. Extend sync_user_stats to accept due_words_count ──
-- Adding a parameter changes the function's argument-type signature, so
-- `create or replace` would create a second overload instead of replacing
-- the existing one (Postgres only lets `replace` reuse the same name when
-- the input types match) — that would leave two sync_user_stats functions
-- and make PostgREST's `.rpc()` call ambiguous. Drop the old signature first.

drop function if exists public.sync_user_stats(
  uuid, integer, integer, integer, text, text, text, boolean, jsonb, jsonb, jsonb,
  integer, text, integer, text, text
);

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
  p_stats_updated_at text,
  p_due_words_count integer default null
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
    today_xp, today_xp_date, daily_words_learned, daily_words_date, stats_updated_at,
    due_words_count
  ) values (
    p_user_id, p_xp, p_streak, p_streak_freezes, p_last_study_date, p_streak_bonus_date,
    p_last_freeze_week, p_show_on_leaderboard, p_study_days, p_review_days, p_word_goal_days,
    p_today_xp, p_today_xp_date, p_daily_words_learned, p_daily_words_date, p_stats_updated_at,
    p_due_words_count
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
    -- overwriting them with stale/zeroed data. due_words_count is a plain
    -- point-in-time snapshot (not an accumulator), so it gets the same
    -- coalesce-on-null treatment: a caller that doesn't know it yet
    -- shouldn't zero out a value some other, up-to-date device already sent.
    today_xp                = coalesce(p_today_xp, user_data.today_xp),
    today_xp_date           = coalesce(p_today_xp_date, user_data.today_xp_date),
    daily_words_learned     = coalesce(p_daily_words_learned, user_data.daily_words_learned),
    daily_words_date        = coalesce(p_daily_words_date, user_data.daily_words_date),
    due_words_count         = coalesce(p_due_words_count, user_data.due_words_count),
    stats_updated_at        = p_stats_updated_at
  returning user_data.total_xp, user_data.streak;
end;
$function$;

grant execute on function public.sync_user_stats(
  uuid, integer, integer, integer, text, text, text, boolean, jsonb, jsonb, jsonb,
  integer, text, integer, text, text, integer
) to anon, authenticated;

-- ── 5. Daily scheduled scan → send-scheduled-push Edge Function ──
-- One run/day is enough for all four v1 notification types (due reviews,
-- streak risk, homework reminders, idle class) — none need finer
-- granularity, and it keeps this from turning into a spam engine.
-- 14:00 UTC = 19:00 Asia/Tashkent (no DST there, so this offset is stable).

select cron.schedule(
  'send-scheduled-push-daily',
  '0 14 * * *',
  $$ select net.http_post(
       url := 'https://jzozrqbzhagezlwncktf.supabase.co/functions/v1/send-scheduled-push',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'push_trigger_secret')
       ),
       body := '{}'::jsonb
     ); $$
);
