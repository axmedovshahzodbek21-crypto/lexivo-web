-- ─────────────────────────────────────────────────────────────────────────────
-- Class SRS: unlearn cascade support
-- Run this in Supabase SQL Editor
--
-- Adds fail_streak, which counts consecutive "Not Yet" answers while a word
-- sits at Stage 0 (the floor Math.max already prevents demoting below).
-- Reset to 0 on any correct answer or on leaving Stage 0. Once it reaches the
-- app's fail-streak limit, the client deletes the row instead of updating it
-- (hard reset — word has to be relearned from scratch, matching how personal
-- SRS's unlearn already works).
-- ─────────────────────────────────────────────────────────────────────────────

alter table class_srs_states add column if not exists fail_streak int not null default 0;
