-- ─────────────────────────────────────────────────────────────────────────────
-- Cross-device resume for class Learn sessions
-- Run this in Supabase SQL Editor
--
-- The "Resume where you left off? / Start over" prompt for a class Learn
-- session (homework or class-words) was driven purely by device-local storage
-- (localStorage on web, SharedPreferences on the app), so a student who paused
-- a homework on the web and then opened the same class on their phone was
-- offered the whole list again with no prompt.
--
-- This table holds one resume bookmark per (student, class, scope) so the
-- prompt shows regardless of which device the session was paused on. The row
-- is written on every exit + on the session heartbeat, and deleted when the
-- session is completed or the student chooses "Start over".
--
-- scope: 'hw:<homework_id>' for a homework Learn session, 'words' for a
-- class-words Learn session. Learn only for now (index maps cleanly because
-- class word lists are served in a stable created_at order on both platforms).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists class_learn_progress (
  user_id     uuid not null references auth.users(id) on delete cascade,
  class_id    uuid not null references classes(id)    on delete cascade,
  scope       text not null,
  word_index  int  not null default 0,
  marks       jsonb not null default '{}'::jsonb,   -- {learned:[],tooHard:[],skipped:[]}
  total       int,
  updated_at  timestamptz not null default now(),
  primary key (user_id, class_id, scope)
);

alter table class_learn_progress enable row level security;

-- Students read/write only their own bookmarks.
create policy "class_learn_progress: student own"
  on class_learn_progress for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Teachers may read bookmarks for their own class (e.g. an "in progress" hint).
create policy "class_learn_progress: teacher read"
  on class_learn_progress for select
  using (exists (
    select 1 from classes
    where classes.id = class_learn_progress.class_id
      and classes.teacher_id = auth.uid()
  ));
