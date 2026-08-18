-- ─────────────────────────────────────────────────────────────────────────────
-- Atomic class XP increment
-- Run this in Supabase SQL Editor
--
-- recordClassXP (web, lib/class-xp.ts) and recordClassActivity (Flutter,
-- lib/services/supabase_service.dart) both did a client-side
-- read class_members.class_xp -> add xp -> write it back. Two near-
-- simultaneous XP awards for the same student (e.g. finishing two homework
-- modes back to back, or two devices) could both read the same "current"
-- value and both write current+xp, silently losing one increment — this
-- directly corrupts the leaderboard total. Confirmed independently by 3
-- separate audit passes.
--
-- record_class_xp() replaces the read-modify-write with a single atomic
-- UPDATE ... SET class_xp = class_xp + p_xp, which Postgres serializes via
-- the row lock regardless of how many callers race it. Also checks the
-- caller is awarding XP to themselves — the old client code had no such
-- guard, so a modified client could previously call it with an arbitrary
-- student_id/class_id/xp combination.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function record_class_xp(
  p_student_id uuid,
  p_class_id uuid,
  p_xp integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_xp <= 0 then
    return;
  end if;

  if auth.uid() is null or auth.uid() != p_student_id then
    raise exception 'not authorized';
  end if;

  update class_members
     set class_xp = coalesce(class_xp, 0) + p_xp
   where student_id = p_student_id and class_id = p_class_id;

  if not found then
    raise exception 'not a member of this class';
  end if;

  insert into class_xp_history (user_id, class_id, amount, reason)
  values (p_student_id, p_class_id, p_xp, p_reason);
end;
$$;

grant execute on function record_class_xp(uuid, uuid, integer, text) to authenticated;
