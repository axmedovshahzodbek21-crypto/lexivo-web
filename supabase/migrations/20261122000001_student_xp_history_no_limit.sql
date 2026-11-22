-- get_student_xp_history returned only the latest 50 rows. Review and Learn
-- write one row per word, so 50 rows is about one day — a teacher opening a
-- student's XP History saw a single, half-counted day (e.g. +58.4 where the
-- student saw +119.4), an empty calendar before it, and a Summary / review
-- verdict built from that sliver.
--
-- Now: no limit. Clients page through with .range() (PostgREST still caps one
-- response at 1000 rows). id breaks created_at ties so pages don't overlap.
-- Access rule unchanged: the student themself or the class's teacher.
create or replace function public.get_student_xp_history(p_class_id uuid, p_student_id uuid)
 returns table(id uuid, amount integer, reason text, created_at timestamp with time zone)
 language sql
 stable
 security definer
 set search_path = public
as $function$
  select h.id, h.amount, h.reason, h.created_at
  from class_xp_history h
  where h.class_id = p_class_id and h.user_id = p_student_id
    and (
      p_student_id = auth.uid()
      or exists (select 1 from classes c where c.id = p_class_id and c.teacher_id = auth.uid())
    )
  order by h.created_at desc, h.id;
$function$;
