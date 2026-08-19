-- ─────────────────────────────────────────────────────────────────────────────
-- Push notifications (homework + announcements) via OneSignal
--
-- BEFORE RUNNING: this migration assumes column names inferred from app code
-- (class_homework.student_ids/class_id/collection_name, class_targets.student_id/
-- title, class_announcements.class_id/message). Confirm these against the live
-- schema (information_schema.columns) before applying — the base tables predate
-- tracked migrations and were created directly in Supabase Studio.
--
-- Requires the pg_net extension (Database → Extensions in the dashboard).
-- Requires two secrets set on the Edge Function (`supabase secrets set`), not
-- referenced from SQL: ONESIGNAL_REST_API_KEY and PUSH_TRIGGER_SECRET. The
-- PUSH_TRIGGER_SECRET below is a placeholder — replace it with a real random
-- value and set the same value as a secret on the send-push function.
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles add column if not exists push_enabled boolean not null default false;

create or replace function notify_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  payload jsonb;
begin
  payload := case tg_table_name
    when 'class_homework' then jsonb_build_object(
      'kind', 'homework',
      'class_id', new.class_id,
      'student_ids', new.student_ids,
      'title', coalesce(new.collection_name, 'New homework')
    )
    when 'class_targets' then jsonb_build_object(
      'kind', 'target',
      'class_id', new.class_id,
      'student_ids', jsonb_build_array(new.student_id),
      'title', new.title
    )
    when 'class_announcements' then jsonb_build_object(
      'kind', 'announcement',
      'class_id', new.class_id,
      'message', new.message
    )
  end;

  perform net.http_post(
    url := current_setting('app.settings.push_function_url', true),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.push_trigger_secret', true)
    ),
    body := payload
  );

  return new;
end;
$$;

-- NOTE: current_setting('app.settings.*') requires these to be set at the
-- database/role level (`alter database postgres set app.settings.push_function_url = '...'`)
-- since triggers can't read Vault secrets directly. Set both before enabling
-- the triggers below:
--   alter database postgres set app.settings.push_function_url = 'https://<project-ref>.supabase.co/functions/v1/send-push';
--   alter database postgres set app.settings.push_trigger_secret = '<same value as PUSH_TRIGGER_SECRET secret>';

drop trigger if exists trg_notify_homework on class_homework;
create trigger trg_notify_homework
  after insert on class_homework
  for each row execute function notify_push();

drop trigger if exists trg_notify_target on class_targets;
create trigger trg_notify_target
  after insert on class_targets
  for each row execute function notify_push();

drop trigger if exists trg_notify_announcement on class_announcements;
create trigger trg_notify_announcement
  after insert on class_announcements
  for each row execute function notify_push();
