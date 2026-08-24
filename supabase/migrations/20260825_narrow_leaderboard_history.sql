-- ─────────────────────────────────────────────────────────────────────────────
-- Narrow get_leaderboard()'s bulk response; add get_leaderboard_profile()
-- Run this in Supabase SQL Editor
--
-- get_leaderboard() was shipping every visible user's full day-by-day
-- study_days/review_days/word_goal_days history to every visitor's browser
-- for all (up to 100) rows returned — even though the leaderboard UI only
-- ever displays that detail for the one profile card a viewer opens. This
-- drops those three fields from the bulk response and adds a narrow
-- single-user RPC for the profile-card use case.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_leaderboard()
 RETURNS TABLE(user_id uuid, name text, avatar_url text, xp bigint, streak integer, last_study_date text, today_count integer, total_learned bigint)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    p.id AS user_id, p.name, p.avatar_url,
    COALESCE(us.xp, 0) AS xp,
    COALESCE(us.streak, 0) AS streak,
    us.last_study_date,
    COALESCE(us.today_count, 0) AS today_count,
    COUNT(lw.word) AS total_learned
  FROM profiles p
  LEFT JOIN user_stats us ON us.id = p.id
  LEFT JOIN learned_words lw ON lw.user_id = p.id
  WHERE p.show_on_leaderboard IS NOT FALSE
  GROUP BY p.id, p.name, p.avatar_url, us.xp, us.streak, us.last_study_date, us.today_count
  ORDER BY us.xp DESC NULLS LAST
  LIMIT 100;
$function$;

CREATE OR REPLACE FUNCTION public.get_leaderboard_profile(p_user_id uuid)
 RETURNS TABLE(study_days jsonb, review_days jsonb, word_goal_days jsonb)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    COALESCE(us.study_days, '[]'::jsonb) AS study_days,
    COALESCE(us.review_days, '[]'::jsonb) AS review_days,
    COALESCE(us.word_goal_days, '[]'::jsonb) AS word_goal_days
  FROM profiles p
  LEFT JOIN user_stats us ON us.id = p.id
  WHERE p.id = p_user_id AND p.show_on_leaderboard IS NOT FALSE;
$function$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_profile(uuid) TO authenticated;
