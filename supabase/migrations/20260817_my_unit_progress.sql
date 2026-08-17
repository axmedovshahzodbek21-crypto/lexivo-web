-- Adds the missing column for syncing "My Words" per-unit activity progress
-- (Learn/Flashcards/Quiz/Match done-flags + word snapshots), which previously
-- lived only in local device storage and never synced across devices/platforms.
alter table user_data
  add column if not exists my_unit_progress jsonb default '{}'::jsonb;
