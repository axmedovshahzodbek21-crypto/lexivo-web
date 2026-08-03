-- ─────────────────────────────────────────────────────────────────────────────
-- Class SRS, Hard Words, Starred Words
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- class_srs_states
-- stage: 0=new, 1-4=interval done, 5=graduated
-- next_due: date word is due for review next
create table if not exists class_srs_states (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  class_id      uuid references classes(id) on delete cascade not null,
  word          text not null,
  translation   text not null default '',
  stage         int  not null default 0,
  next_due      date not null default (current_date + interval '1 day'),
  last_reviewed timestamptz,
  created_at    timestamptz not null default now(),
  unique(user_id, class_id, word)
);

alter table class_srs_states enable row level security;

-- Students manage their own rows
create policy "class_srs: student own"
  on class_srs_states for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Teachers read all rows for their class
create policy "class_srs: teacher read"
  on class_srs_states for select
  using (
    exists (
      select 1 from classes
      where classes.id = class_srs_states.class_id
        and classes.teacher_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists class_hard_words (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  class_id   uuid references classes(id) on delete cascade not null,
  word       text not null,
  created_at timestamptz not null default now(),
  unique(user_id, class_id, word)
);

alter table class_hard_words enable row level security;

create policy "class_hard: student own"
  on class_hard_words for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "class_hard: teacher read"
  on class_hard_words for select
  using (
    exists (
      select 1 from classes
      where classes.id = class_hard_words.class_id
        and classes.teacher_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists class_starred_words (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  class_id   uuid references classes(id) on delete cascade not null,
  word       text not null,
  created_at timestamptz not null default now(),
  unique(user_id, class_id, word)
);

alter table class_starred_words enable row level security;

-- Students only — teachers do not see starred words
create policy "class_starred: student own"
  on class_starred_words for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
