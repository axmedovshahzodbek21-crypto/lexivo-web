-- Backfill the class Learn XP that record_class_word_learned credited to
-- class_members.class_xp but never wrote to class_xp_history (fixed going
-- forward in 20261029000001). One 'Learn' row per learned word, stamped with
-- the word's class_srs_states.created_at so it lands on the day it was learned.
--
-- Capped per student+class at the gap between class_xp and what history
-- already shows, so history never adds up to more than the real total (words
-- learned with no XP, or tiered web XP of 7/5, just shrink/stop the backfill).
-- Re-running is a no-op: once the gap is filled there's nothing left to insert.
insert into class_xp_history (user_id, class_id, amount, reason, created_at)
select user_id, class_id, least(10, missing - (run - 10)), 'Learn', created_at
from (
  select s.user_id, s.class_id, s.created_at,
         coalesce(m.class_xp, 0) - coalesce(h.total, 0) as missing,
         10 * row_number() over (partition by s.user_id, s.class_id order by s.created_at, s.id) as run
  from class_srs_states s
  join class_members m on m.student_id = s.user_id and m.class_id = s.class_id
  left join (
    select user_id, class_id, sum(amount) as total
    from class_xp_history
    group by user_id, class_id
  ) h on h.user_id = s.user_id and h.class_id = s.class_id
) x
where missing > 0 and run - 10 < missing;
