-- Lets a teacher assign one of the static "Ideas" reading passages
-- (lib/reading-data.ts, referenced by its numeric id) as class homework,
-- alongside the existing unit_id / class_unit_id / collection_name+day_number
-- content pointers. Completion is tracked the same way as every other mode:
-- a class_homework_progress row with mode = 'read'.
alter table class_homework
  add column if not exists passage_id integer;
