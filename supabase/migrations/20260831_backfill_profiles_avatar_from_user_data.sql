-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill profiles.avatar_url from user_data.avatar_url
-- Run this in Supabase SQL Editor
--
-- The profile-photo upload writes the storage public URL to two columns via
-- an atomic RPC: user_data.avatar_url (the uploader's own devices) and
-- profiles.avatar_url (what every other user reads — leaderboard, class home,
-- joined-classes list). Earlier revisions of that path could write one column
-- and leave the other null (see the comments in app/profile/page.tsx around
-- handlePickPhoto / handleRemovePhoto), so some accounts have a photo in
-- storage + user_data but a null profiles.avatar_url.
--
-- For those accounts other users fall back to the colour-initial avatar even
-- though a real photo exists. This copies the URL across for every row where
-- profiles is missing it and user_data has it. One-off; safe to re-run.
--
-- Scope note: only fills genuinely-empty profiles values — never overwrites an
-- existing profiles.avatar_url, and never resurrects a photo the user removed
-- (a removal clears both columns, so user_data.avatar_url is null too).
-- ─────────────────────────────────────────────────────────────────────────────

update profiles p
set avatar_url = u.avatar_url
from user_data u
where u.id = p.id
  and (p.avatar_url is null or p.avatar_url = '')
  and u.avatar_url is not null
  and u.avatar_url <> '';
