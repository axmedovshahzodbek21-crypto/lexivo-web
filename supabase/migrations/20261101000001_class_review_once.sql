-- ─────────────────────────────────────────────────────────────────────────────
-- record_class_review_once: idempotent class Review grading (offline Review)
-- Run in the Supabase SQL Editor
--
-- The Flutter app can now grade class Review cards with no internet (the
-- metro): the answer waits on the phone and is sent later. A queued answer
-- can reach the server twice (the first send landed but its reply was lost),
-- and advance_class_srs_word is NOT idempotent — a replay would move the card
-- up two stages and pay review XP twice. So each answer carries a
-- client-generated event id, stored on its class_review_events row; a second
-- send of the same id is a no-op.
--
-- Scheduling is unchanged (+1/+3/+7/+14/+30, same stage/fail_streak rules as
-- advance_class_srs_word — keep the two in sync). The only difference: the
-- review day may be up to 30 days back (an answer synced late keeps the day it
-- was really given; advance_class_srs_word allows 2), but never before the
-- card's previous review, and never in the future beyond the existing +2.
--
-- Review XP is still awarded via record_class_xp, so it lands on the day the
-- answer syncs (daily cap included).
--
-- advance_class_srs_word itself is untouched; the web app keeps using it.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.class_review_events
  add column if not exists client_event_id uuid;

create unique index if not exists class_review_events_client_event_uidx
  on public.class_review_events (client_event_id);

create or replace function public.record_class_review_once(
  p_event_id uuid,
  p_user_id uuid,
  p_class_id uuid,
  p_word text,
  p_knew boolean,
  p_today date,
  p_reviewed_at timestamptz,
  p_study_day date,
  p_response_ms integer default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_at timestamptz;
  v_today date;
  v_study_day date;
  v_row_count int;
  v_id uuid;
  v_stage int;
  v_fail_streak int;
  v_last date;
  v_next int;
  v_next_streak int;
  v_interval int;
  v_intervals int[] := array[1, 3, 7, 14, 30];
begin
  if auth.uid() is null or auth.uid() != p_user_id then
    raise exception 'not authorized';
  end if;

  if p_event_id is null then
    raise exception 'event id required';
  end if;

  if not is_approved_class_member(p_class_id, p_user_id) then
    raise exception 'not a member of this class';
  end if;

  -- When the answer was really given: at most 30 days back, never ahead.
  v_at := least(greatest(coalesce(p_reviewed_at, now()), now() - interval '30 days'), now());

  v_today := p_today;
  if v_today is null or v_today < current_date - 30 or v_today > current_date + 2 then
    v_today := current_date;
  end if;

  v_study_day := p_study_day;
  if v_study_day is null or v_study_day < current_date - 30 or v_study_day > current_date + 2 then
    v_study_day := v_today;
  end if;

  -- Claim the event id first: a replay stops here.
  insert into class_review_events (user_id, class_id, word, knew, response_ms, created_at, client_event_id)
  values (p_user_id, p_class_id, p_word, p_knew, p_response_ms, v_at, p_event_id)
  on conflict (client_event_id) do nothing;
  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    return false;
  end if;

  insert into class_study_days (student_id, class_id, study_date)
  values (p_user_id, p_class_id, v_study_day)
  on conflict (student_id, class_id, study_date) do nothing;

  select id, stage, coalesce(fail_streak, 0), last_reviewed::date
    into v_id, v_stage, v_fail_streak, v_last
  from class_srs_states
  where user_id = p_user_id and class_id = p_class_id and word = p_word
  for update;

  if v_id is null then
    return true;
  end if;

  -- Never schedule from a day before the card's previous review.
  if v_last is not null and v_today < v_last then
    v_today := v_last;
  end if;

  -- Same rules as advance_class_srs_word.
  v_next := case when p_knew then least(v_stage + 1, 5) else greatest(v_stage - 1, 0) end;
  v_interval := case when v_next >= 5 then 36500 else v_intervals[v_next + 1] end;
  v_next_streak := case
                     when p_knew then 0
                     when v_next = 0 then least(v_fail_streak + 1, 9)
                     else 0
                   end;

  update class_srs_states
  set stage = v_next,
      next_due = v_today + v_interval,
      last_reviewed = v_at,
      fail_streak = v_next_streak
  where id = v_id;

  if p_knew and v_next > v_stage then
    perform record_class_xp(p_user_id, p_class_id, 2, 'SRS Review');
  end if;

  return true;
end;
$$;

grant execute on function public.record_class_review_once(uuid, uuid, uuid, text, boolean, date, timestamptz, date, integer) to authenticated;
