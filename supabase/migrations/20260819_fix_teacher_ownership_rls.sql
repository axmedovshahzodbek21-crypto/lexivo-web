-- ─────────────────────────────────────────────────────────────────────────────
-- Fix RLS gaps letting a caller write to classes they don't teach
-- Run this in Supabase SQL Editor
--
-- class_announcements' and class_targets' "teacher manage" policies only
-- checked `teacher_id = auth.uid()` — a column the caller controls (or that
-- defaults to their own id), with no cross-check against classes.teacher_id
-- for the class_id on the row. Any authenticated user (a student, or anyone
-- with a valid session) could call the Supabase API directly — bypassing the
-- app's own client-side teacher guard entirely — and post a fake
-- announcement or target into a class they don't teach, just by setting
-- teacher_id to their own id. class_notes already had the correct pattern
-- (cross-checks classes.teacher_id); these two are brought in line with it.
--
-- Separately, class_members had no policy at all letting a teacher delete a
-- *student's* membership row — only "Students manage own memberships"
-- (auth.uid() = student_id), which doesn't cover a teacher removing someone
-- else. That means the app's "Remove student" action was likely a silent
-- no-op: a DELETE that matches zero RLS-permitted rows just deletes
-- nothing, with no error surfaced to the caller.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "teacher_manage_announcements" on class_announcements;
create policy "teacher_manage_announcements"
  on class_announcements for all
  using (
    teacher_id = auth.uid()
    and exists (select 1 from classes where classes.id = class_announcements.class_id and classes.teacher_id = auth.uid())
  )
  with check (
    teacher_id = auth.uid()
    and exists (select 1 from classes where classes.id = class_announcements.class_id and classes.teacher_id = auth.uid())
  );

drop policy if exists "teacher_manage_targets" on class_targets;
create policy "teacher_manage_targets"
  on class_targets for all
  using (
    teacher_id = auth.uid()
    and exists (select 1 from classes where classes.id = class_targets.class_id and classes.teacher_id = auth.uid())
  )
  with check (
    teacher_id = auth.uid()
    and exists (select 1 from classes where classes.id = class_targets.class_id and classes.teacher_id = auth.uid())
  );

drop policy if exists "Teachers remove class members" on class_members;
create policy "Teachers remove class members"
  on class_members for delete
  using (
    exists (select 1 from classes where classes.id = class_members.class_id and classes.teacher_id = auth.uid())
  );
