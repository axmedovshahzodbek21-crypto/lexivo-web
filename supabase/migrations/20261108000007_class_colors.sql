-- Each person's own header colour for a class. Only that person ever sees it,
-- so every policy is own-row; a class with no row here shows the default.

create table if not exists public.class_colors (
  user_id    uuid not null references auth.users(id) on delete cascade,
  class_id   uuid not null references public.classes(id) on delete cascade,
  color      text not null check (color in ('orange','indigo','pink','green','blue','violet','red','cyan')),
  updated_at timestamptz not null default now(),
  primary key (user_id, class_id)
);

alter table public.class_colors enable row level security;

drop policy if exists "Read own class colors" on public.class_colors;
create policy "Read own class colors" on public.class_colors
  for select using (auth.uid() = user_id);

-- Writes also require belonging to the class (as its teacher or a member).
drop policy if exists "Add own class color" on public.class_colors;
create policy "Add own class color" on public.class_colors
  for insert with check (
    auth.uid() = user_id
    and (
      exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
      or exists (select 1 from public.class_members m where m.class_id = class_colors.class_id and m.student_id = auth.uid())
    )
  );

drop policy if exists "Change own class color" on public.class_colors;
create policy "Change own class color" on public.class_colors
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = auth.uid())
      or exists (select 1 from public.class_members m where m.class_id = class_colors.class_id and m.student_id = auth.uid())
    )
  );

drop policy if exists "Remove own class color" on public.class_colors;
create policy "Remove own class color" on public.class_colors
  for delete using (auth.uid() = user_id);
