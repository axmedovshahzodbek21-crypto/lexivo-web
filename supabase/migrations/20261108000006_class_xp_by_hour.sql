-- Class XP per student per hour (Tashkent time), for the rule-based class
-- digest (lib/class-digest.ts). get_student_xp_history stops at each student's
-- latest 50 rows, and one Learn or Review session can write more than that, so
-- it can't compare weeks. Read-only; returns nothing unless the caller teaches
-- this class.
create or replace function public.get_class_xp_by_hour(p_class_id uuid, p_since date)
 returns table(user_id uuid, day date, hour integer, xp integer, entries integer)
 language sql
 stable
 security definer
 set search_path = public
as $function$
  select
    h.user_id,
    (h.created_at at time zone 'Asia/Tashkent')::date                  as day,
    extract(hour from h.created_at at time zone 'Asia/Tashkent')::int  as hour,
    sum(h.amount)::int                                                 as xp,
    count(*)::int                                                      as entries
  from class_xp_history h
  where h.class_id = p_class_id
    and h.created_at >= (p_since::timestamp at time zone 'Asia/Tashkent')
    and exists (select 1 from classes c where c.id = p_class_id and c.teacher_id = auth.uid())
  group by 1, 2, 3
  order by 2, 1, 3
$function$;

revoke all on function public.get_class_xp_by_hour(uuid, date) from public, anon;
grant execute on function public.get_class_xp_by_hour(uuid, date) to authenticated;
