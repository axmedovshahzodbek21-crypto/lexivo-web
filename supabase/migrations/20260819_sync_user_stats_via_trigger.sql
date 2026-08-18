-- ─────────────────────────────────────────────────────────────────────────────
-- Consolidate user_data + user_stats to a single client write path
-- Run this in Supabase SQL Editor
--
-- pushStats()/pushLists() (both Flutter and web) wrote the same accumulator
-- fields (xp, streak, freezes, study/review/word-goal days, today's xp/word
-- count) to user_data AND user_stats via two separate client-side upserts
-- with no transactional guarantee — a partial failure (one succeeds, one
-- throws) left the two tables holding different values for the same
-- account. user_data is the real per-device sync source of truth;
-- user_stats is a denormalized projection the leaderboard reads (it can't
-- just read user_data directly — that table isn't meant to be broadly
-- readable the way a leaderboard needs).
--
-- This trigger makes user_data the only thing the client writes for these
-- fields: it derives the corresponding user_stats row automatically, in the
-- same transaction as the user_data write, so the two can no longer
-- diverge. The client-side second upsert to user_stats in pushStats()/
-- pushLists() should be removed on both platforms once this is applied.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function sync_user_stats_from_user_data()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_stats (
    id, xp, streak, freezes, last_study_date, last_freeze_week,
    total_days, study_days, review_days, word_goal_days,
    today_xp, today_xp_date, today_count, today_count_date,
    xp_updated_at
  )
  values (
    new.id,
    new.total_xp,
    new.streak,
    new.streak_freezes,
    nullif(new.last_study_date, '')::date,
    new.last_freeze_week,
    jsonb_array_length(coalesce(new.study_days, '[]'::jsonb)),
    coalesce(new.study_days, '[]'::jsonb),
    coalesce(new.review_days, '[]'::jsonb),
    coalesce(new.word_goal_days, '[]'::jsonb),
    new.today_xp,
    nullif(new.today_xp_date, '')::date,
    new.daily_words_learned,
    nullif(new.daily_words_date, '')::date,
    now()
  )
  on conflict (id) do update set
    xp                = excluded.xp,
    streak            = excluded.streak,
    freezes           = excluded.freezes,
    last_study_date   = excluded.last_study_date,
    last_freeze_week  = excluded.last_freeze_week,
    total_days        = excluded.total_days,
    study_days        = excluded.study_days,
    review_days       = excluded.review_days,
    word_goal_days    = excluded.word_goal_days,
    today_xp          = excluded.today_xp,
    today_xp_date     = excluded.today_xp_date,
    today_count       = excluded.today_count,
    today_count_date  = excluded.today_count_date,
    xp_updated_at     = excluded.xp_updated_at;
  return new;
end;
$$;

drop trigger if exists trg_sync_user_stats on user_data;

create trigger trg_sync_user_stats
  after insert or update of
    total_xp, streak, streak_freezes, last_study_date, last_freeze_week,
    study_days, review_days, word_goal_days,
    today_xp, today_xp_date, daily_words_learned, daily_words_date
  on user_data
  for each row
  execute function sync_user_stats_from_user_data();
