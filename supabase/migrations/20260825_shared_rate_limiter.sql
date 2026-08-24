-- ─────────────────────────────────────────────────────────────────────────────
-- Shared (cross-serverless-instance) rate limiter for /api routes
-- Run this in Supabase SQL Editor
--
-- /api/digest, /api/fetch-article, /api/transcribe, and /api/tts each kept
-- their own in-memory Map<userId, ...> as a rate limiter. That works within
-- one warm serverless instance, but each cold-started instance gets its own
-- empty Map — under any real concurrent load, the same user's requests can
-- land on several different instances, each independently allowing that
-- user's per-instance quota. The effective limit is multiplied by however
-- many instances happen to serve the user, against routes that each call a
-- paid third-party API (Anthropic, Google Cloud TTS/STT, an outbound fetch).
--
-- This moves the counters into Postgres, where a single atomic UPSERT can
-- enforce one true limit regardless of which instance handles the request.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.api_rate_limits (
  user_id      uuid not null,
  route        text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (user_id, route)
);

-- No policies defined — RLS enabled with zero policies means default-deny
-- for direct table access from any client role. Only the SECURITY DEFINER
-- function below (which runs as the function owner, bypassing RLS
-- entirely) can read or write this table; nothing should ever query it
-- directly from the client.
alter table public.api_rate_limits enable row level security;

-- Atomically checks-and-increments the counter for (user_id, route) and
-- reports whether this call is within the limit. A single UPSERT (not a
-- separate read then write) so two concurrent requests for the same user
-- can't both read a stale pre-increment count and both be allowed through.
create or replace function public.check_rate_limit(
  p_user_id uuid,
  p_route text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  insert into api_rate_limits (user_id, route, window_start, count)
  values (p_user_id, p_route, v_now, 1)
  on conflict (user_id, route) do update set
    window_start = case
      when api_rate_limits.window_start + make_interval(secs => p_window_seconds) <= v_now
        then v_now
        else api_rate_limits.window_start
    end,
    count = case
      when api_rate_limits.window_start + make_interval(secs => p_window_seconds) <= v_now
        then 1
        else api_rate_limits.count + 1
    end
  returning count into v_count;

  return v_count <= p_limit;
end;
$function$;

grant execute on function public.check_rate_limit(uuid, text, integer, integer) to anon, authenticated;
