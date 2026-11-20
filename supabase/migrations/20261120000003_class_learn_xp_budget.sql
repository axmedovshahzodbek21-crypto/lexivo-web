-- record_class_word_learned: stop fake words from farming class Learn XP
-- (XP audit 2026-11-20)
--
-- Before: any word text the client sent counted as "new" and paid 1.0 XP, so
-- a script could send made-up words forever.
--
-- Most class homework is built-in collections (collection_name + day_number)
-- whose words live only in app code, so the server can't check each word.
-- Instead a student gets Learn XP only while their Learn XP count in this
-- class is below the number of words they could really learn there:
--   class_words of the class
-- + words of teacher units assigned to them as homework, or sitting in a
--   library folder assigned to the class
-- + word counts of built-in collection days assigned to them as homework
--   (collection_day_word_counts)
-- A real student can never learn more distinct words than that, so they are
-- never short-changed; a cheater is capped at the real total.
--
-- The SRS row is still created either way (it only affects that student's
-- own Review list). Everything else is unchanged.

-- collection_day_word_counts was seeded 2026-08-21 and never got the Phrases
-- A1-C2 collections added later, so Phrases homework had no count. Refresh
-- every built-in collection day from public/data/*.json (same per-day counts
-- as the Flutter app; 1,170 phrases in total).
insert into collection_day_word_counts (collection_name, day_number, word_count) values
  ('30 Days of Powerful Words', 1, 15),
  ('30 Days of Powerful Words', 2, 15),
  ('30 Days of Powerful Words', 3, 15),
  ('30 Days of Powerful Words', 4, 15),
  ('30 Days of Powerful Words', 5, 15),
  ('30 Days of Powerful Words', 6, 15),
  ('30 Days of Powerful Words', 7, 15),
  ('30 Days of Powerful Words', 8, 15),
  ('30 Days of Powerful Words', 9, 15),
  ('30 Days of Powerful Words', 10, 15),
  ('30 Days of Powerful Words', 11, 15),
  ('30 Days of Powerful Words', 12, 15),
  ('30 Days of Powerful Words', 13, 15),
  ('30 Days of Powerful Words', 14, 15),
  ('30 Days of Powerful Words', 15, 15),
  ('30 Days of Powerful Words', 16, 15),
  ('30 Days of Powerful Words', 17, 15),
  ('30 Days of Powerful Words', 18, 15),
  ('30 Days of Powerful Words', 19, 15),
  ('30 Days of Powerful Words', 20, 15),
  ('30 Days of Powerful Words', 21, 15),
  ('30 Days of Powerful Words', 22, 15),
  ('30 Days of Powerful Words', 23, 15),
  ('30 Days of Powerful Words', 24, 15),
  ('30 Days of Powerful Words', 25, 15),
  ('30 Days of Powerful Words', 26, 15),
  ('30 Days of Powerful Words', 27, 15),
  ('30 Days of Powerful Words', 28, 15),
  ('30 Days of Powerful Words', 29, 15),
  ('30 Days of Powerful Words', 30, 15),
  ('24 Vocabulary Challenge', 1, 30),
  ('24 Vocabulary Challenge', 2, 30),
  ('24 Vocabulary Challenge', 3, 30),
  ('24 Vocabulary Challenge', 4, 30),
  ('24 Vocabulary Challenge', 5, 30),
  ('24 Vocabulary Challenge', 6, 30),
  ('24 Vocabulary Challenge', 7, 30),
  ('24 Vocabulary Challenge', 8, 30),
  ('24 Vocabulary Challenge', 9, 30),
  ('24 Vocabulary Challenge', 10, 30),
  ('24 Vocabulary Challenge', 11, 30),
  ('24 Vocabulary Challenge', 12, 30),
  ('24 Vocabulary Challenge', 13, 30),
  ('24 Vocabulary Challenge', 14, 30),
  ('24 Vocabulary Challenge', 15, 30),
  ('24 Vocabulary Challenge', 16, 30),
  ('24 Vocabulary Challenge', 17, 30),
  ('24 Vocabulary Challenge', 18, 30),
  ('24 Vocabulary Challenge', 19, 30),
  ('24 Vocabulary Challenge', 20, 30),
  ('24 Vocabulary Challenge', 21, 30),
  ('24 Vocabulary Challenge', 22, 30),
  ('24 Vocabulary Challenge', 23, 30),
  ('24 Vocabulary Challenge', 24, 30),
  ('Word Mastery', 1, 10),
  ('Word Mastery', 2, 10),
  ('Word Mastery', 3, 10),
  ('Word Mastery', 4, 10),
  ('Word Mastery', 5, 10),
  ('Word Mastery', 6, 10),
  ('Word Mastery', 7, 10),
  ('Word Mastery', 8, 10),
  ('Word Mastery', 9, 10),
  ('Word Mastery', 10, 10),
  ('Word Mastery', 11, 10),
  ('Word Mastery', 12, 10),
  ('Word Mastery', 13, 10),
  ('Word Mastery', 14, 10),
  ('Word Mastery', 15, 10),
  ('Word Mastery', 16, 10),
  ('Word Mastery', 17, 10),
  ('Word Mastery', 18, 10),
  ('Word Mastery', 19, 10),
  ('Word Mastery', 20, 10),
  ('Word Mastery', 21, 10),
  ('Word Mastery', 22, 10),
  ('Word Mastery', 23, 10),
  ('Word Mastery', 24, 10),
  ('Word Mastery', 25, 10),
  ('Word Mastery', 26, 10),
  ('Word Mastery', 27, 10),
  ('Word Mastery', 28, 10),
  ('Word Mastery', 29, 10),
  ('Word Mastery', 30, 10),
  ('Word Mastery', 31, 10),
  ('Word Mastery', 32, 10),
  ('Phrases A1', 1, 15),
  ('Phrases A1', 2, 15),
  ('Phrases A1', 3, 15),
  ('Phrases A2', 1, 15),
  ('Phrases A2', 2, 15),
  ('Phrases A2', 3, 15),
  ('Phrases A2', 4, 15),
  ('Phrases A2', 5, 15),
  ('Phrases A2', 6, 15),
  ('Phrases A2', 7, 15),
  ('Phrases B1', 1, 15),
  ('Phrases B1', 2, 15),
  ('Phrases B1', 3, 15),
  ('Phrases B1', 4, 15),
  ('Phrases B1', 5, 15),
  ('Phrases B1', 6, 15),
  ('Phrases B1', 7, 15),
  ('Phrases B1', 8, 15),
  ('Phrases B1', 9, 15),
  ('Phrases B1', 10, 15),
  ('Phrases B1', 11, 15),
  ('Phrases B1', 12, 15),
  ('Phrases B1', 13, 15),
  ('Phrases B2', 1, 15),
  ('Phrases B2', 2, 15),
  ('Phrases B2', 3, 15),
  ('Phrases B2', 4, 15),
  ('Phrases B2', 5, 15),
  ('Phrases B2', 6, 15),
  ('Phrases B2', 7, 15),
  ('Phrases B2', 8, 15),
  ('Phrases B2', 9, 15),
  ('Phrases B2', 10, 15),
  ('Phrases B2', 11, 15),
  ('Phrases B2', 12, 15),
  ('Phrases B2', 13, 15),
  ('Phrases B2', 14, 15),
  ('Phrases B2', 15, 15),
  ('Phrases B2', 16, 15),
  ('Phrases B2', 17, 15),
  ('Phrases B2', 18, 15),
  ('Phrases B2', 19, 15),
  ('Phrases B2', 20, 15),
  ('Phrases B2', 21, 15),
  ('Phrases B2', 22, 15),
  ('Phrases B2', 23, 15),
  ('Phrases B2', 24, 15),
  ('Phrases C1', 1, 15),
  ('Phrases C1', 2, 15),
  ('Phrases C1', 3, 15),
  ('Phrases C1', 4, 15),
  ('Phrases C1', 5, 15),
  ('Phrases C1', 6, 15),
  ('Phrases C1', 7, 15),
  ('Phrases C1', 8, 15),
  ('Phrases C1', 9, 15),
  ('Phrases C1', 10, 15),
  ('Phrases C1', 11, 15),
  ('Phrases C1', 12, 15),
  ('Phrases C1', 13, 15),
  ('Phrases C1', 14, 15),
  ('Phrases C1', 15, 15),
  ('Phrases C2', 1, 15),
  ('Phrases C2', 2, 15),
  ('Phrases C2', 3, 15),
  ('Phrases C2', 4, 15),
  ('Phrases C2', 5, 15),
  ('Phrases C2', 6, 15),
  ('Phrases C2', 7, 15),
  ('Phrases C2', 8, 15),
  ('Phrases C2', 9, 15),
  ('Phrases C2', 10, 15),
  ('Phrases C2', 11, 15),
  ('Phrases C2', 12, 15),
  ('Phrases C2', 13, 15),
  ('Phrases C2', 14, 15),
  ('Phrases C2', 15, 15),
  ('Phrases C2', 16, 15),
  ('A1', 1, 40),
  ('A1', 2, 40),
  ('A1', 3, 40),
  ('A1', 4, 40),
  ('A1', 5, 40),
  ('A1', 6, 40),
  ('A1', 7, 40),
  ('A1', 8, 40),
  ('A1', 9, 40),
  ('A1', 10, 40),
  ('A1', 11, 40),
  ('A1', 12, 40),
  ('A1', 13, 40),
  ('A1', 14, 40),
  ('A1', 15, 40),
  ('A1', 16, 40),
  ('A1', 17, 40),
  ('A1', 18, 0),
  ('A1', 19, 0),
  ('A1', 20, 0),
  ('A1', 21, 0),
  ('A1', 22, 0),
  ('A1', 23, 0),
  ('A2', 1, 40),
  ('A2', 2, 40),
  ('A2', 3, 40),
  ('A2', 4, 40),
  ('A2', 5, 40),
  ('A2', 6, 40),
  ('A2', 7, 40),
  ('A2', 8, 40),
  ('A2', 9, 40),
  ('A2', 10, 40),
  ('A2', 11, 40),
  ('A2', 12, 40),
  ('A2', 13, 0),
  ('A2', 14, 0),
  ('A2', 15, 0),
  ('A2', 16, 0),
  ('A2', 17, 0),
  ('A2', 18, 0),
  ('A2', 19, 0),
  ('A2', 20, 0),
  ('A2', 21, 0),
  ('A2', 22, 0),
  ('A2', 23, 0),
  ('A2', 24, 0),
  ('A2', 25, 0),
  ('A2', 26, 0),
  ('A2', 27, 0),
  ('A2', 28, 0),
  ('A2', 29, 0),
  ('A2', 30, 0),
  ('B1', 1, 40),
  ('B1', 2, 40),
  ('B1', 3, 40),
  ('B1', 4, 40),
  ('B1', 5, 40),
  ('B1', 6, 40),
  ('B1', 7, 40),
  ('B1', 8, 40),
  ('B1', 9, 40),
  ('B1', 10, 40),
  ('B1', 11, 40),
  ('B1', 12, 40),
  ('B1', 13, 0),
  ('B1', 14, 0),
  ('B1', 15, 0),
  ('B1', 16, 0),
  ('B1', 17, 0),
  ('B1', 18, 0),
  ('B1', 19, 0),
  ('B1', 20, 0),
  ('B1', 21, 0),
  ('B1', 22, 0),
  ('B1', 23, 0),
  ('B1', 24, 0),
  ('B1', 25, 0),
  ('B1', 26, 0)
on conflict (collection_name, day_number) do update set word_count = excluded.word_count;

create or replace function public.record_class_word_learned(
  p_student_id uuid,
  p_class_id uuid,
  p_word text,
  p_translation text,
  p_next_due date,
  p_xp integer,
  p_reason text default 'Learn'
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_new boolean;
  v_xp int;
  v_budget int;
  v_paid int;
begin
  if auth.uid() is null or auth.uid() != p_student_id then
    raise exception 'not authorized';
  end if;

  if not is_approved_class_member(p_class_id, p_student_id) then
    raise exception 'not a member of this class';
  end if;

  insert into class_srs_states (user_id, class_id, word, translation, stage, next_due)
  values (p_student_id, p_class_id, p_word, p_translation, 0, p_next_due)
  on conflict (user_id, class_id, word) do nothing;

  v_is_new := found;

  if v_is_new and p_xp > 0 then
    select
        (select count(*) from class_words w where w.class_id = p_class_id)
      + (select count(*) from teacher_unit_words tw
          where tw.unit_id in (
            select h.unit_id from class_homework h
             where h.class_id = p_class_id and h.unit_id is not null
               and (h.student_ids is null or p_student_id = any(h.student_ids))
            union
            select u.id from teacher_units u
              join class_library_assignments a on a.folder_id = u.folder_id
             where a.class_id = p_class_id))
      + (select coalesce(sum(c.word_count), 0) from (
           select distinct h.collection_name, h.day_number from class_homework h
            where h.class_id = p_class_id and h.collection_name is not null
              and (h.student_ids is null or p_student_id = any(h.student_ids))
         ) d
         join collection_day_word_counts c
           on c.collection_name = d.collection_name and c.day_number = d.day_number)
    into v_budget;

    select count(*) into v_paid
      from class_xp_history
     where user_id = p_student_id and class_id = p_class_id and reason = 'Learn';

    if v_paid < v_budget then
      v_xp := least(greatest(p_xp, 0), 10);
      update class_members
        set class_xp = coalesce(class_xp, 0) + v_xp
        where student_id = p_student_id and class_id = p_class_id;

      insert into class_xp_history (user_id, class_id, amount, reason)
      values (p_student_id, p_class_id, v_xp, 'Learn');
    end if;
  end if;

  return v_is_new;
end;
$$;
