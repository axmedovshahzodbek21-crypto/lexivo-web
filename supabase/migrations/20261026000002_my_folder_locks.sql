-- ─────────────────────────────────────────────────────────────────────────────
-- My Words "in order" folder lock — synced per account
-- Run this in Supabase SQL Editor BEFORE deploying the web/app builds that
-- push it: pushLists upserts this column, and an upsert naming a column that
-- doesn't exist fails the whole list sync.
--
-- my_folder_locks maps a My Words folder name to its lock state:
--
--   { "IELTS": { "locked": true,  "at": 1761475200000 },
--     "Misc":  { "locked": false, "at": 1761475300000 } }
--
-- locked = true → Cards / Quiz / Match stay locked until Learn is done for
-- that unit (same rule as the pre-built collections). Off by default.
-- Merge (client-side, sync.ts / sync_service.dart): per-folder
-- last-write-wins by `at` (epoch ms), so turning a lock OFF on one device
-- isn't undone by a stale ON from another.
--
-- user_data already has RLS (own row only); a new column needs no new policy.
-- ─────────────────────────────────────────────────────────────────────────────

alter table user_data
  add column if not exists my_folder_locks jsonb not null default '{}'::jsonb;
