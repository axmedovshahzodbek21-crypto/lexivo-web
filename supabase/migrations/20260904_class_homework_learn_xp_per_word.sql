-- ─────────────────────────────────────────────────────────────────────────────
-- Class-homework Learn: move XP from a completion bonus to per-word crediting
-- Run this in Supabase SQL Editor
--
-- Before: record_class_homework_progress awarded word_count * 10 class XP for
-- mode 'learn' at session finish. A student who left a homework Learn session
-- mid-list earned nothing for the words they had already learned, and the XP
-- only reached the class leaderboard once (and if) they completed the whole
-- list in one sitting.
--
-- After: homework Learn is credited per word by record_class_word_learned as
-- each card is marked (immediate, dedup-safe via that RPC's own uniqueness
-- check, and survivable across any mid-session exit) — exactly like the
-- non-homework class Learn flow. This RPC now awards 0 XP for mode 'learn';
-- it stays the sole writer of the class_homework_progress completion row and
-- still records the study day for every completed mode.
--
-- Net XP for a full homework Learn session is unchanged (~10 per word); it is
-- just credited incrementally instead of in one lump at the end.
-- ─────────────────────────────────────────────────────────────────────────────

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

    -- 'learn' is credited per-word at study time via record_class_word_learned
    -- (immediate + dedup-safe + survives a mid-session exit). Awarding
    -- word_count * 10 here as well would double-pay the class leaderboard.
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

  -- Record the study day for any newly-completed mode, including 'learn'
  -- (whose v_xp is 0 here because its XP is credited per-word elsewhere).
  insert into class_study_days (student_id, class_id, study_date)
  values (v_uid, v_hw.class_id, current_date)
  on conflict (student_id, class_id, study_date) do nothing;

  return query select true, v_xp;
end;
$$;

grant execute on function record_class_homework_progress(uuid, text, integer) to authenticated;
