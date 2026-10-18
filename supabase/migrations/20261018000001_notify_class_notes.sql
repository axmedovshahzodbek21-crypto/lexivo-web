-- Teacher notes (class_notes) only showed up when a student opened their
-- Classes page — no push, unlike homework, targets and announcements. Smart
-- insights' Send button writes notes, so they need to reach the student.
-- Extends notify_push() (latest: 20260914_notify_join_request.sql) with a
-- 'note' kind sent to the one student the note is for.
--
-- Deploy the updated send-push Edge Function BEFORE running this file —
-- the old one doesn't know the 'note' kind.

create or replace function notify_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  payload jsonb;
  trigger_secret text;
begin
  begin
    select decrypted_secret into trigger_secret
      from vault.decrypted_secrets where name = 'push_trigger_secret';

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
    elsif tg_table_name = 'class_members' and new.status = 'pending' then
      payload := jsonb_build_object(
        'kind', 'join_request',
        'class_id', new.class_id,
        'student_id', new.student_id
      );
    elsif tg_table_name = 'class_notes' then
      payload := jsonb_build_object(
        'kind', 'note',
        'class_id', new.class_id,
        'student_ids', jsonb_build_array(new.student_id),
        'message', new.message
      );
    end if;

    if payload is not null then
      perform net.http_post(
        url := 'https://jzozrqbzhagezlwncktf.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || trigger_secret
        ),
        body := payload
      );
    end if;
  exception when others then
    raise warning 'notify_push failed for %: %', tg_table_name, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_notify_note on class_notes;
create trigger trg_notify_note
  after insert on class_notes
  for each row execute function notify_push();
