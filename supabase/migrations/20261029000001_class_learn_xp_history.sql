-- Class Learn XP was credited to class_members.class_xp but never written to
-- class_xp_history, so the XP History calendar/day list only ever showed
-- Review and homework XP — a student's total (e.g. 32.8) didn't add up to the
-- days shown (e.g. +1.8). Same body as 20260905_class_membership_approval.sql,
-- plus the history row, matching record_class_xp / record_class_homework_progress.
create or replace function record_class_word_learned(
  p_student_id uuid,
  p_class_id uuid,
  p_word text,
  p_translation text,
  p_next_due date,
  p_xp int,
  p_reason text default 'Learn'
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_new boolean;
  v_xp int;
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
    v_xp := least(greatest(p_xp, 0), 10);
    update class_members
      set class_xp = coalesce(class_xp, 0) + v_xp
      where student_id = p_student_id and class_id = p_class_id;

    insert into class_xp_history (user_id, class_id, amount, reason)
    values (p_student_id, p_class_id, v_xp, coalesce(p_reason, 'Learn'));
  end if;

  return v_is_new;
end;
$$;

grant execute on function record_class_word_learned(uuid, uuid, text, text, date, int, text) to authenticated;
