-- ─────────────────────────────────────────────────────────────────────────────
-- Page tips: a short "what this page is / how to use it well" popup shown the
-- first time an account opens each main page, on web or in the app.
--
--   seen_tips    — tip ids this account has already closed (shared web + app,
--                  so a tip seen on one never shows again on the other)
--   tips_enabled — the Settings on/off switch
--
-- Same additive pattern as 20260831_profiles_bio.sql: the profiles "update own
-- profile" RLS policy is column-agnostic, so no policy change is needed.
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles add column if not exists seen_tips text[] not null default '{}';
alter table profiles add column if not exists tips_enabled boolean not null default true;

-- There are ~25 tips; cap well above that so a crafted request can't bloat the row.
alter table profiles drop constraint if exists profiles_seen_tips_len;
alter table profiles add constraint profiles_seen_tips_len check (cardinality(seen_tips) <= 100);

-- Atomic append, so a tip closed in the app and another closed on the web at
-- the same moment can't overwrite each other. SECURITY INVOKER: the caller's
-- own-row RLS policy still decides which row it can touch.
create or replace function mark_tip_seen(p_tip text)
returns void
language sql
security invoker
set search_path = public
as $$
  update profiles
     set seen_tips = array_append(seen_tips, p_tip)
   where id = auth.uid()
     and char_length(p_tip) <= 40
     and not (p_tip = any(seen_tips));
$$;

revoke execute on function mark_tip_seen(text) from public, anon;
grant execute on function mark_tip_seen(text) to authenticated;
