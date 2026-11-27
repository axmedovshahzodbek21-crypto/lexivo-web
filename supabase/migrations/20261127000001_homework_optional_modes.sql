-- Optional homework modes (2026-11-27)
--
-- Teachers can now assign "Learn only" (or Learn + any subset of
-- Cards/Quiz/Match). class_homework.modes stays the list of REQUIRED modes —
-- it alone decides "done" everywhere (student cards, teacher progress,
-- reminders, auto-homework, insights). The other practice modes are shown to
-- students as optional extras, so the RPC must accept them for word homework.
--
-- Only change vs the live body (20260905_class_membership_approval.sql):
-- the mode check also allows learn/flashcard/quiz/match on non-reading
-- homework. Each mode still pays once per homework (unique progress row),
-- at the same per-word rates.

create or replace function record_class_homework_progress(
  p_homework_id uuid,
  p_mode text,
  p_client_word_count integer default null
)
returns table(recorded boolean, xp_awarded integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hw record;
  v_word_count integer := 0;
  v_xp integer := 0;
  v_xp_per_word integer;
  v_row_count integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select id, class_id, unit_id, class_unit_id, collection_name, day_number,
         passage_id, modes, student_ids
    into v_hw
    from class_homework
   where id = p_homework_id;

  if not found then
    raise exception 'homework not found';
  end if;

  if v_hw.student_ids is not null and not (v_uid = any(v_hw.student_ids)) then
    raise exception 'not assigned this homework';
  end if;

  if not is_approved_class_member(v_hw.class_id, v_uid) then
    raise exception 'not a member of this class';
  end if;

  if not (
    p_mode = any(coalesce(v_hw.modes, array[]::text[]))
    or (p_mode = 'read' and v_hw.passage_id is not null)
    or (v_hw.passage_id is null and p_mode in ('learn', 'flashcard', 'quiz', 'match'))
  ) then
    raise exception 'invalid mode for this homework';
  end if;

  insert into class_homework_progress (homework_id, student_id, mode)
  values (p_homework_id, v_uid, p_mode)
  on conflict (homework_id, student_id, mode) do nothing;
  get diagnostics v_row_count = row_count;

  if v_row_count = 0 then
    return query select false, 0;
    return;
  end if;

  if v_hw.passage_id is not null then
    v_xp := 15;
  else
    if v_hw.class_unit_id is not null then
      select count(*) into v_word_count from class_words where unit_id = v_hw.class_unit_id;
    elsif v_hw.unit_id is not null then
      select count(*) into v_word_count from teacher_unit_words where unit_id = v_hw.unit_id;
    else
      v_word_count := least(greatest(coalesce(p_client_word_count, 0), 0), 50);
    end if;

    v_xp_per_word := case p_mode
      when 'learn' then 0
      when 'flashcard' then 3
      when 'quiz' then 5
      when 'match' then 4
      else 3
    end;
    v_xp := v_word_count * v_xp_per_word;
  end if;

  if v_xp > 0 then
    update class_members
       set class_xp = coalesce(class_xp, 0) + v_xp
     where class_id = v_hw.class_id and student_id = v_uid;

    insert into class_xp_history (user_id, class_id, amount, reason)
    values (v_uid, v_hw.class_id, v_xp, p_mode);
  end if;

  insert into class_study_days (student_id, class_id, study_date)
  values (v_uid, v_hw.class_id, current_date)
  on conflict (student_id, class_id, study_date) do nothing;

  return query select true, v_xp;
end;
$$;

grant execute on function record_class_homework_progress(uuid, text, integer) to authenticated;
