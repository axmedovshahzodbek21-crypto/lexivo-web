-- record_class_xp: two class-XP rules, decided server-side so web and app
-- can't drift.
--
-- 1. Words-tab practice (reason 'Flashcard', 'Quiz'/'Quiz (perfect)', 'Match')
--    pays once per activity per day. Before, every completed session paid, so
--    replaying Match on 4 words farmed the class leaderboard. Homework XP
--    (record_class_homework_progress, lowercase reasons) is already
--    once-per-assignment and is not touched here.
-- 2. SRS Review daily cap 200 -> 400 (20 -> 40 XP), since students can now
--    pick "All" new words per session and 100 correct reviews is reachable.
--
-- Days are Tashkent days (both rules), not UTC — UTC midnight is 5am here.
--
-- Now returns the XP actually awarded (0 when a rule skipped it) so the
-- client can show the truth instead of the amount it asked for. Changing the
-- return type needs a drop; advance_class_srs_word's `perform` call is
-- unaffected.
drop function if exists public.record_class_xp(uuid, uuid, integer, text);

create function public.record_class_xp(
  p_student_id uuid,
  p_class_id uuid,
  p_xp integer,
  p_reason text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today_review_xp int;
  v_review_daily_cap constant int := 400;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent';
  v_practice_reasons text[];
begin
  if p_xp <= 0 then
    return 0;
  end if;

  if auth.uid() is null or auth.uid() != p_student_id then
    raise exception 'not authorized';
  end if;

  if not is_approved_class_member(p_class_id, p_student_id) then
    raise exception 'not a member of this class';
  end if;

  if p_reason = 'SRS Review' then
    select coalesce(sum(amount), 0) into v_today_review_xp
    from class_xp_history
    where user_id = p_student_id
      and class_id = p_class_id
      and reason = 'SRS Review'
      and created_at >= v_day_start;
    if v_today_review_xp >= v_review_daily_cap then
      return 0;
    end if;
  end if;

  v_practice_reasons := case
    when p_reason = 'Flashcard' then array['Flashcard']
    when p_reason in ('Quiz', 'Quiz (perfect)') then array['Quiz', 'Quiz (perfect)']
    when p_reason = 'Match' then array['Match']
  end;
  if v_practice_reasons is not null and exists (
    select 1 from class_xp_history
    where user_id = p_student_id
      and class_id = p_class_id
      and reason = any(v_practice_reasons)
      and created_at >= v_day_start
  ) then
    return 0;
  end if;

  update class_members
     set class_xp = coalesce(class_xp, 0) + p_xp
   where student_id = p_student_id and class_id = p_class_id;

  if not found then
    raise exception 'not a member of this class';
  end if;

  insert into class_xp_history (user_id, class_id, amount, reason)
  values (p_student_id, p_class_id, p_xp, p_reason);

  return p_xp;
end;
$$;

grant execute on function public.record_class_xp(uuid, uuid, integer, text) to authenticated;
