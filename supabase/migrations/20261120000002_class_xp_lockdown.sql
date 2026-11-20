-- record_class_xp lockdown (XP audit 2026-11-20)
--
-- Before: the client chose the amount, and any reason other than
-- 'SRS Review' / 'Flashcard' / 'Quiz' / 'Quiz (perfect)' / 'Match' skipped
-- every rule — one call with a made-up reason could add any amount of class
-- XP (the anon key ships in the APK, so anyone can call this).
--
-- Now:
--   * Only known reasons are accepted; anything else awards 0.
--   * The amount is clamped to what the activity can really earn. Practice
--     runs over the class's word list (class_words), so the cap is
--     per-word rate × that class's word count — the same formulas web and
--     the app use:
--       Flashcard       3 × words
--       Match           4 × words
--       Quiz            5 × words
--       Quiz (perfect)  5 × words + round(25%)
--   * 'SRS Review' pays at most 2 per call (the only amount the review
--     functions send) and never past the 400/day cap.
--   * 'Reading: <title>' pays at most 3, once per title per class, and at
--     most 10 reading credits per class per day.
--   * Practice stays once per activity per day (unchanged).
--
-- Days are Tashkent days. Return value is still the XP actually awarded.

create or replace function public.record_class_xp(
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
  v_words int;
  v_cap int;
  v_xp int;
begin
  if p_xp is null or p_xp <= 0 or p_reason is null then
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
    v_cap := least(2, v_review_daily_cap - v_today_review_xp);

  elsif p_reason in ('Flashcard', 'Match', 'Quiz', 'Quiz (perfect)') then
    v_practice_reasons := case
      when p_reason = 'Flashcard' then array['Flashcard']
      when p_reason = 'Match' then array['Match']
      else array['Quiz', 'Quiz (perfect)']
    end;
    if exists (
      select 1 from class_xp_history
      where user_id = p_student_id
        and class_id = p_class_id
        and reason = any(v_practice_reasons)
        and created_at >= v_day_start
    ) then
      return 0;
    end if;
    select count(*) into v_words from class_words where class_id = p_class_id;
    v_cap := case p_reason
      when 'Flashcard' then 3 * v_words
      when 'Match' then 4 * v_words
      when 'Quiz' then 5 * v_words
      else 5 * v_words + (5 * v_words + 2) / 4   -- base + round(base * 0.25)
    end;

  elsif p_reason like 'Reading: %' then
    if exists (
      select 1 from class_xp_history
      where user_id = p_student_id
        and class_id = p_class_id
        and reason = p_reason
    ) or (
      select count(*) from class_xp_history
      where user_id = p_student_id
        and class_id = p_class_id
        and reason like 'Reading: %'
        and created_at >= v_day_start
    ) >= 10 then
      return 0;
    end if;
    v_cap := 3;

  else
    return 0;
  end if;

  v_xp := least(p_xp, v_cap);
  if v_xp <= 0 then
    return 0;
  end if;

  update class_members
     set class_xp = coalesce(class_xp, 0) + v_xp
   where student_id = p_student_id and class_id = p_class_id;

  if not found then
    raise exception 'not a member of this class';
  end if;

  insert into class_xp_history (user_id, class_id, amount, reason)
  values (p_student_id, p_class_id, v_xp, p_reason);

  return v_xp;
end;
$$;

grant execute on function public.record_class_xp(uuid, uuid, integer, text) to authenticated;
