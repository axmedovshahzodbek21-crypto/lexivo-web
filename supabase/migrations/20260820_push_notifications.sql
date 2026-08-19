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
-- Requires ONESIGNAL_REST_API_KEY set as an Edge Function secret
-- (`supabase secrets set`). The trigger secret (below) is stored in Supabase
-- Vault instead of `app.settings.*`, since hosted Supabase doesn't grant
-- regular users permission to run `alter database ... set`.
--
-- Before running this file, replace <PROJECT_REF> in the URL below with your
-- actual project ref, and run this once with your real random secret value
-- (must match the PUSH_TRIGGER_SECRET Edge Function secret):
--   select vault.create_secret('<same value as PUSH_TRIGGER_SECRET secret>', 'push_trigger_secret');
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles add column if not exists push_enabled boolean not null default false;

create or replace function notify_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  payload jsonb;
  trigger_secret text;
begin
  select decrypted_secret into trigger_secret
    from vault.decrypted_secrets where name = 'push_trigger_secret';

  -- IF/ELSIF instead of a single CASE expression: a CASE is one SQL
  -- expression, so Postgres has to type-check every branch against NEW's
  -- actual row shape before picking one — and new.student_id doesn't exist
  -- on class_homework, so inserting there failed even though that branch
  -- was never reached ("record 'new' has no field 'student_id'"). IF/ELSIF
  -- are separate PL/pgSQL statements, only compiled once actually entered.
  if tg_table_name = 'class_homework' then
    payload := jsonb_build_object(
      'kind', 'homework',
      'class_id', new.class_id,
      'student_ids', new.student_ids,
      'title', coalesce(new.collection_name, 'New homework')
    );
  elsif tg_table_name = 'class_targets' then
    payload := jsonb_build_object(
      'kind', 'target',
      'class_id', new.class_id,
      'student_ids', jsonb_build_array(new.student_id),
      'title', new.title
    );
  elsif tg_table_name = 'class_announcements' then
    payload := jsonb_build_object(
      'kind', 'announcement',
      'class_id', new.class_id,
      'message', new.message
    );
  end if;

  perform net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || trigger_secret
    ),
    body := payload
  );

  return new;
end;
$$;

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
