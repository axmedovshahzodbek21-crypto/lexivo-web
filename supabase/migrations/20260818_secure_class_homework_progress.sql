-- ─────────────────────────────────────────────────────────────────────────────
-- Secure class homework completion + XP
-- Run this in Supabase SQL Editor
--
-- Previously the client inserted directly into class_homework_progress and
-- separately called recordClassXP() off nothing but a ?completed=<mode> URL
-- query param — a student could mark any mode "done" and collect XP for it
-- just by visiting a crafted link, no actual study session required.
--
-- This RPC re-derives eligibility (assigned to this student, mode valid for
-- this homework) and performs the progress insert + XP award atomically,
-- server-side. Word counts are computed from Postgres where the content
-- lives there (class_words / teacher_unit_words); homework sourced from the
-- static collection JSON files (word_data.json, a1_collection.json, etc.)
-- has no DB-side word list, so that one case still takes a client-supplied
-- count — clamped to a realistic max to bound (not eliminate) XP abuse for
-- that content type specifically.
-- ─────────────────────────────────────────────────────────────────────────────

create unique index if not exists class_homework_progress_unique
  on class_homework_progress (homework_id, student_id, mode);

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
  v_is_member boolean;
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

  select exists(
    select 1 from class_members
     where class_id = v_hw.class_id and student_id = v_uid
  ) into v_is_member;
  if not v_is_member then
    raise exception 'not a member of this class';
  end if;

  if not (
    p_mode = any(coalesce(v_hw.modes, array[]::text[]))
    or (p_mode = 'read' and v_hw.passage_id is not null)
  ) then
    raise exception 'invalid mode for this homework';
  end if;

  insert into class_homework_progress (homework_id, student_id, mode)
  values (p_homework_id, v_uid, p_mode)
  on conflict (homework_id, student_id, mode) do nothing;
  get diagnostics v_row_count = row_count;

  if v_row_count = 0 then
    -- already recorded — idempotent no-op, no double XP
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
      -- collection_name + day_number: word list lives in static JSON, not Postgres.
      v_word_count := least(greatest(coalesce(p_client_word_count, 0), 0), 50);
    end if;

    v_xp_per_word := case p_mode
      when 'learn' then 10
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

    insert into class_study_days (student_id, class_id, study_date)
    values (v_uid, v_hw.class_id, current_date)
    on conflict (student_id, class_id, study_date) do nothing;
  end if;

  return query select true, v_xp;
end;
$$;

grant execute on function record_class_homework_progress(uuid, text, integer) to authenticated;

-- Close the direct-insert exploit path: only the SECURITY DEFINER function
-- above (which bypasses RLS as its owner) may write completion rows now.
revoke insert on class_homework_progress from authenticated;
