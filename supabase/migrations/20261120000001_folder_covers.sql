-- ─────────────────────────────────────────────────────────────────────────────
-- Folder & unit covers (Library + My Words)
-- Run this in Supabase SQL Editor BEFORE deploying the web/app builds that
-- use it: pushLists upserts user_data.my_folder_covers, and an upsert naming
-- a column that doesn't exist fails the whole list sync.
--
-- A cover is one short string, same format on web (lib/folder-cover.ts) and
-- Flutter (lib/widgets/folder_cover.dart):
--   g:3          built-in gradient #3
--   e:🦊|3       emoji on gradient #3
--   img:<url>    uploaded picture — must be in this project's public
--                folder-covers bucket (no outside URLs: students' devices load
--                whatever a teacher puts here)
--   null         default look
--
-- Library: teacher_folders.cover / teacher_units.cover. The existing *_own
-- policies already limit writes to the teacher; students only read (assigned
-- folders), so they see the teacher's covers.
-- My Words: user_data.my_folder_covers = { key: { cover, at } }, key = folder
-- name, or folder + "\n" + unit name for a unit. cover '' = removed.
-- Merged per key, last-write-wins by `at` (same as my_folder_locks).
-- user_data already has RLS (own row only); a new column needs no new policy.
-- ─────────────────────────────────────────────────────────────────────────────

alter table user_data
  add column if not exists my_folder_covers jsonb not null default '{}'::jsonb;

alter table teacher_folders add column if not exists cover text;
alter table teacher_units   add column if not exists cover text;

do $$ begin
  alter table teacher_folders add constraint teacher_folders_cover_format check (
    cover is null or (length(cover) <= 400 and cover ~ (
      '^(g:[0-9]{1,2}|e:[^|]{1,16}\|[0-9]{1,2}|img:https://jzozrqbzhagezlwncktf\.supabase\.co/storage/v1/object/public/folder-covers/[0-9a-f-]{36}/[A-Za-z0-9_.-]+)$'
    ))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table teacher_units add constraint teacher_units_cover_format check (
    cover is null or (length(cover) <= 400 and cover ~ (
      '^(g:[0-9]{1,2}|e:[^|]{1,16}\|[0-9]{1,2}|img:https://jzozrqbzhagezlwncktf\.supabase\.co/storage/v1/object/public/folder-covers/[0-9a-f-]{36}/[A-Za-z0-9_.-]+)$'
    ))
  );
exception when duplicate_object then null; end $$;

-- Public bucket (covers aren't private, and public URLs let students and
-- offline caches load them without signed links). Clients resize to ~800px
-- JPEG first; the bucket refuses anything over 1 MB or not an image.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('folder-covers', 'folder-covers', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Upload cap: 30 covers per user per day. Counted in a SECURITY DEFINER
-- function — a policy that reads storage.objects itself recurses (see
-- 20261102000003_chat_photos_upload_fix.sql).
create or replace function public.folder_covers_uploaded_today()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from storage.objects o
   where o.bucket_id = 'folder-covers' and o.owner = auth.uid()
     and o.created_at >= date_trunc('day', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent';
$$;

revoke all on function public.folder_covers_uploaded_today() from public, anon;
grant execute on function public.folder_covers_uploaded_today() to authenticated;

-- Files live at folder-covers/<user id>/<file>; each user manages only their own.
drop policy if exists folder_covers_read_own on storage.objects;
create policy folder_covers_read_own on storage.objects for select to authenticated
using (bucket_id = 'folder-covers' and (storage.foldername(objects.name))[1] = auth.uid()::text);

drop policy if exists folder_covers_upload on storage.objects;
create policy folder_covers_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'folder-covers'
  and (storage.foldername(objects.name))[1] = auth.uid()::text
  and public.folder_covers_uploaded_today() < 30
);

drop policy if exists folder_covers_delete_own on storage.objects;
create policy folder_covers_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'folder-covers' and (storage.foldername(objects.name))[1] = auth.uid()::text);
