-- Teachers had no way to know a student requested to join until they
-- happened to open the class (Home screen already shows the pending list —
-- see get_class_pending_members / 6fd7294 — but nothing pushed it to them).
-- Extends the existing notify_push() pipeline (20260820_push_notifications.sql)
-- with a join_request kind, sent to the teacher instead of the students.

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

drop trigger if exists trg_notify_join_request on class_members;
create trigger trg_notify_join_request
  after insert on class_members
  for each row execute function notify_push();
