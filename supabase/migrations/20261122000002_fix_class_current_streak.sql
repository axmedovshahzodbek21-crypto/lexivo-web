-- class_current_streak always returned 0 or 1.
--
-- It grouped consecutive days with `study_date - row_number()` while numbering
-- rows NEWEST first. Going back one day lowers the date by 1 but raises the
-- row number by 1, so every day landed in its own group and the "current run"
-- was always just the latest day. With rows numbered newest first, consecutive
-- days share `study_date + row_number()` instead.
--
-- Also: "today" was current_date (UTC). Clients write study_date as the local
-- (Tashkent) day, so between 00:00 and 05:00 Tashkent today's row was ignored.
--
-- Used by get_class_leaderboard and get_class_dashboard (streak column).
create or replace function public.class_current_streak(p_student_id uuid, p_class_id uuid)
 returns integer
 language sql
 stable
 set search_path = public
as $function$
  with today as (
    select (now() at time zone 'Asia/Tashkent')::date as d
  ),
  days as (
    select distinct study_date
    from class_study_days, today
    where student_id = p_student_id and class_id = p_class_id
      and study_date <= today.d
  ),
  grouped as (
    select study_date,
           study_date + (row_number() over (order by study_date desc))::int as grp
    from days
  )
  select case
    when not exists (select 1 from days, today where study_date >= today.d - 1) then 0
    else (
      select count(*)::integer from grouped
      where grp = (select grp from grouped order by study_date desc limit 1)
    )
  end;
$function$;
