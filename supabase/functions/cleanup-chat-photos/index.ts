// @ts-nocheck — Deno runtime (Deno.env, jsr: imports), not part of the
// Next.js TS project.
// Supabase Edge Function: cleanup-chat-photos
//
// Called nightly by the chat-photos-cleanup pg_cron job (migration
// 20261102000002_class_chat_photos.sql). Deletes class chat photos older
// than 30 days through the Storage API — SQL can't delete storage files
// directly (protect_objects_delete). The message rows keep their
// image_path; clients show "photo expired" for anything past 30 days.
//
// Deploy: supabase functions deploy cleanup-chat-photos --no-verify-jwt
// Auth: same PUSH_TRIGGER_SECRET as send-push (the cron job sends it).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const PUSH_TRIGGER_SECRET = Deno.env.get('PUSH_TRIGGER_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BUCKET = 'chat-photos';
const MAX_AGE_DAYS = 30;

Deno.serve(async (req) => {
  if (req.headers.get('Authorization') !== `Bearer ${PUSH_TRIGGER_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  // storage isn't exposed through PostgREST, so a service-role-only RPC
  // lists the expired files.
  const { data: old, error } = await supabase.rpc('chat_photos_expired', { p_days: MAX_AGE_DAYS, p_limit: 1000 });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const names = ((old ?? []) as { name: string }[]).map((o) => o.name);
  let removed = 0;
  for (let i = 0; i < names.length; i += 100) {
    const { data, error: rmError } = await supabase.storage.from(BUCKET).remove(names.slice(i, i + 100));
    if (rmError) return new Response(JSON.stringify({ removed, error: rmError.message }), { status: 500 });
    removed += data?.length ?? 0;
  }
  return new Response(JSON.stringify({ removed }), { status: 200 });
});
