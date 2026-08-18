-- ─────────────────────────────────────────────────────────────────────────────
-- Add Pomodoro focus-time tracking to user_data
-- Run this in Supabase SQL Editor
--
-- focus_days stores { "YYYY-MM-DD": secondsFocused } — actual elapsed seconds
-- spent in the Pomodoro work phase, including partial (paused/stopped)
-- sessions. Synced the same way as study_days/review_days: merged per-day by
-- taking the max of local vs. cloud, so a stale push from an idle device can
-- never erase time already recorded from another device. Today/This
-- Week/Total focused-time stats are all derived from this map client-side.
-- ─────────────────────────────────────────────────────────────────────────────

alter table user_data
  add column if not exists focus_days jsonb not null default '{}'::jsonb;
