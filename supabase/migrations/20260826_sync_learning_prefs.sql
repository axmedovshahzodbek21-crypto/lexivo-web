-- ─────────────────────────────────────────────────────────────────────────────
-- Cross-device sync for the learning-preference settings that pushSettings()
-- never sent: sessionSize, studyOrder, defaultAccent, pulseEnabled,
-- pulseSpeed, fontSize, autoPlayOnReveal.
-- Run this in Supabase SQL Editor
--
-- Not a clobber bug — these fields just silently stayed local-only, so a
-- second device never saw a preference changed on the first one. Added as a
-- separate, additive RPC (rather than editing sync_profile_settings, whose
-- current SQL body isn't available to safely CREATE OR REPLACE without
-- risking the fields it already handles) writing into the same user_data
-- row, reusing settings_updated_at as pullAll's existing single-timestamp
-- gate for the whole settings set.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.user_data
  add column if not exists session_size integer,
  add column if not exists study_order text,
  add column if not exists default_accent text,
  add column if not exists pulse_enabled boolean,
  add column if not exists pulse_speed text,
  add column if not exists font_size text,
  add column if not exists auto_play_on_reveal boolean;

create or replace function public.sync_learning_prefs(
  p_user_id uuid,
  p_session_size integer,
  p_study_order text,
  p_default_accent text,
  p_pulse_enabled boolean,
  p_pulse_speed text,
  p_font_size text,
  p_auto_play_on_reveal boolean,
  p_settings_updated_at text
) returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into user_data (
    id, session_size, study_order, default_accent, pulse_enabled, pulse_speed,
    font_size, auto_play_on_reveal, settings_updated_at
  ) values (
    p_user_id, p_session_size, p_study_order, p_default_accent, p_pulse_enabled, p_pulse_speed,
    p_font_size, p_auto_play_on_reveal, p_settings_updated_at
  )
  on conflict (id) do update set
    session_size         = coalesce(p_session_size, user_data.session_size),
    study_order           = coalesce(p_study_order, user_data.study_order),
    default_accent         = coalesce(p_default_accent, user_data.default_accent),
    pulse_enabled           = coalesce(p_pulse_enabled, user_data.pulse_enabled),
    pulse_speed             = coalesce(p_pulse_speed, user_data.pulse_speed),
    font_size               = coalesce(p_font_size, user_data.font_size),
    auto_play_on_reveal     = coalesce(p_auto_play_on_reveal, user_data.auto_play_on_reveal),
    settings_updated_at     = p_settings_updated_at;
end;
$function$;

grant execute on function public.sync_learning_prefs(
  uuid, integer, text, text, boolean, text, text, boolean, text
) to anon, authenticated;
