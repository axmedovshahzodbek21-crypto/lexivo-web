-- Account deletion (delete_own_account) failed for any user with rows in these
-- tables: their FKs to auth.users had no ON DELETE rule, so DELETE FROM
-- auth.users raised a foreign-key violation. Google Play requires working
-- account deletion. Everything a user owns now goes with them (classes they
-- own already cascade the same way); homework a teacher assigned keeps
-- existing for the class, with assigned_by cleared.

alter table public.class_targets
  drop constraint class_targets_teacher_id_fkey,
  add constraint class_targets_teacher_id_fkey foreign key (teacher_id) references auth.users(id) on delete cascade,
  drop constraint class_targets_student_id_fkey,
  add constraint class_targets_student_id_fkey foreign key (student_id) references auth.users(id) on delete cascade;

alter table public.class_words
  drop constraint class_words_teacher_id_fkey,
  add constraint class_words_teacher_id_fkey foreign key (teacher_id) references auth.users(id) on delete cascade;

alter table public.xp_history
  drop constraint xp_history_user_id_fkey,
  add constraint xp_history_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.class_task_assignments
  drop constraint class_homework_teacher_id_fkey,
  add constraint class_homework_teacher_id_fkey foreign key (teacher_id) references auth.users(id) on delete cascade;

alter table public.teacher_folders
  drop constraint teacher_folders_teacher_id_fkey,
  add constraint teacher_folders_teacher_id_fkey foreign key (teacher_id) references auth.users(id) on delete cascade;

alter table public.teacher_units
  drop constraint teacher_units_teacher_id_fkey,
  add constraint teacher_units_teacher_id_fkey foreign key (teacher_id) references auth.users(id) on delete cascade;

alter table public.teacher_unit_words
  drop constraint teacher_unit_words_teacher_id_fkey,
  add constraint teacher_unit_words_teacher_id_fkey foreign key (teacher_id) references auth.users(id) on delete cascade;

alter table public.class_homework_progress
  drop constraint class_homework_progress_student_id_fkey,
  add constraint class_homework_progress_student_id_fkey foreign key (student_id) references auth.users(id) on delete cascade;

alter table public.class_homework
  drop constraint class_homework_assigned_by_fkey,
  add constraint class_homework_assigned_by_fkey foreign key (assigned_by) references auth.users(id) on delete set null;

alter table public.class_word_units
  drop constraint class_word_units_teacher_id_fkey,
  add constraint class_word_units_teacher_id_fkey foreign key (teacher_id) references auth.users(id) on delete cascade;

alter table public.push_notification_log
  drop constraint push_notification_log_user_id_fkey,
  add constraint push_notification_log_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
