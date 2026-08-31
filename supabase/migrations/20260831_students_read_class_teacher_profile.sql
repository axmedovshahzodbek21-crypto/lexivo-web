-- ─────────────────────────────────────────────────────────────────────────────
-- Let a student read the profile row of a teacher whose class they're in
-- Run this in Supabase SQL Editor
--
-- The `profiles` table's SELECT RLS only lets a caller read their own row
-- (auth.uid() = id) — which is why the leaderboard has to go through the
-- get_leaderboard / get_leaderboard_profile SECURITY DEFINER RPCs to show
-- other users' names.
--
-- The class-home and joined-classes screens (both web and Flutter) instead
-- read the teacher's profile directly:
--
--     supabase.from('profiles').select('name, bio, avatar_url')
--       .eq('id', cls.teacher_id).maybeSingle()          -- class home (student)
--     supabase.from('profiles').select('id, name, avatar_url')
--       .in('id', teacherIds)                             -- joined classes list
--
-- For a student these return no rows, so every call site falls back to the
-- literal string 'Teacher', an empty bio, and a colour-initial avatar — even
-- when the teacher has set a real name. This adds a narrow, permissive SELECT
-- policy (RLS policies for the same command are OR'd together) that exposes a
-- teacher's profile row to the students currently enrolled in one of their
-- classes, and nothing more.
--
-- Teacher -> student profile reads already go through get_class_dashboard /
-- get_class_leaderboard RPCs, so no reverse policy is needed here. (The one
-- remaining direct cross-user read, srsNames in app/classes/[id]/page.tsx,
-- is a separate pre-existing gap and out of scope for this fix.)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "students read their class teachers' profiles" on profiles;
create policy "students read their class teachers' profiles"
  on profiles for select
  using (
    exists (
      select 1
      from classes c
      join class_members m on m.class_id = c.id
      where c.teacher_id = profiles.id
        and m.student_id = auth.uid()
    )
  );
