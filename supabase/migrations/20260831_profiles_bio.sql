-- ─────────────────────────────────────────────────────────────────────────────
-- Add profiles.bio
--
-- The bio feature (commit ef21e67, "feat: bio + hash-color avatars on
-- leaderboard, class home, profile, settings") shipped frontend-only — it
-- reads/writes profiles.bio from Settings, the leaderboard profile sheet, the
-- class-home teacher sheet and the profile page, but no migration ever created
-- the column. Every `select bio` errored and fell back to "No bio yet", and the
-- Settings upsert (unchecked, unawaited) silently dropped the value.
--
-- Same additive pattern as 20260820_push_notifications.sql: the profiles table
-- predates tracked migrations and its "update own profile" RLS policy is
-- column-agnostic, so no policy change is needed.
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles add column if not exists bio text;

-- Match the client-side maxLength={200} so a crafted request can't store more.
alter table profiles drop constraint if exists profiles_bio_len;
alter table profiles add constraint profiles_bio_len check (char_length(bio) <= 200);
