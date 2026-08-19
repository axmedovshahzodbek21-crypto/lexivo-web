-- ─────────────────────────────────────────────────────────────────────────────
-- Fix RLS gap letting any user write class_words/class_word_units for a class
-- they don't teach
-- Run this in Supabase SQL Editor
--
-- Same vulnerability class as 20260819_fix_teacher_ownership_rls.sql:
-- class_word_units' and class_words' "teacher manage" policies only checked
-- `teacher_id = auth.uid()` — a caller-controlled column with no cross-check
-- against classes.teacher_id for the class_id on the row. Any authenticated
-- user could call the Supabase API directly and insert/update/delete a word
-- or unit in a class they don't teach, just by setting teacher_id to their
-- own id. class_homework and class_library_assignments already had the
-- correct pattern (cross-check classes.teacher_id); these two are brought in
-- line with it.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "teacher_manage_class_word_units" on class_word_units;
create policy "teacher_manage_class_word_units"
  on class_word_units for all
  using (
    teacher_id = auth.uid()
    and exists (select 1 from classes where classes.id = class_word_units.class_id and classes.teacher_id = auth.uid())
  )
  with check (
    teacher_id = auth.uid()
    and exists (select 1 from classes where classes.id = class_word_units.class_id and classes.teacher_id = auth.uid())
  );

drop policy if exists "teacher_manage_class_words" on class_words;
create policy "teacher_manage_class_words"
  on class_words for all
  using (
    teacher_id = auth.uid()
    and exists (select 1 from classes where classes.id = class_words.class_id and classes.teacher_id = auth.uid())
  )
  with check (
    teacher_id = auth.uid()
    and exists (select 1 from classes where classes.id = class_words.class_id and classes.teacher_id = auth.uid())
  );
