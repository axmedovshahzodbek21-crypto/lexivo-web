// Supabase Edge Function: send-push
//
// Called by the `notify_push()` Postgres trigger (see
// supabase/migrations/20260820_push_notifications.sql) whenever a row is
// inserted into class_homework, class_targets, or class_announcements.
// Resolves the affected students, filters to those who opted into push, and
// sends via the OneSignal REST API using external_id = Supabase auth user id.
//
// Deploy: supabase functions deploy send-push
// Secrets: supabase secrets set ONESIGNAL_REST_API_KEY=... PUSH_TRIGGER_SECRET=...
// (PUSH_TRIGGER_SECRET must match app.settings.push_trigger_secret set on the DB.)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ONESIGNAL_APP_ID = '518b5974-bbf8-4fbf-8c0c-4e434a2f49eb';
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')!;
const PUSH_TRIGGER_SECRET = Deno.env.get('PUSH_TRIGGER_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Payload {
  kind: 'homework' | 'target' | 'announcement';
  class_id: string;
  student_ids?: string[] | null;
  title?: string;
  message?: string;
}

function buildNotificationText(payload: Payload, className: string): { heading: string; content: string } {
  switch (payload.kind) {
    case 'homework':
      return { heading: '📚 New homework', content: `${className}: ${payload.title ?? 'New assignment'}` };
    case 'target':
      return { heading: '🎯 New goal set', content: `${className}: ${payload.title ?? 'Check your class page'}` };
    case 'announcement':
      return { heading: '📢 New announcement', content: `${className}: ${payload.message ?? ''}` };
  }
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${PUSH_TRIGGER_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = (await req.json()) as Payload;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: classRow } = await supabase
    .from('classes')
    .select('name')
    .eq('id', payload.class_id)
    .maybeSingle();
  const className = classRow?.name ?? 'Your class';

  let studentIds = payload.student_ids ?? null;
  if (!studentIds) {
    const { data: members } = await supabase
      .from('class_members')
      .select('student_id')
      .eq('class_id', payload.class_id);
    studentIds = (members ?? []).map((m) => m.student_id);
  }
  if (studentIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no students' }), { status: 200 });
  }

  const { data: optedIn } = await supabase
    .from('profiles')
    .select('id')
    .in('id', studentIds)
    .eq('push_enabled', true);
  const externalIds = (optedIn ?? []).map((p) => p.id);
  if (externalIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no opted-in students' }), { status: 200 });
  }

  const { heading, content } = buildNotificationText(payload, className);

  const oneSignalResp = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { external_id: externalIds },
      target_channel: 'push',
      headings: { en: heading },
      contents: { en: content },
      // Read by the client's notification-click handler (Flutter's
      // onesignal_service.dart, web's OneSignalProvider) to jump straight
      // to the class instead of just opening the app to Home. Recipients
      // here are always students (see the class_members query above), so
      // is_teacher is fixed false.
      data: { class_id: payload.class_id, class_name: className, is_teacher: false },
    }),
  });

  const result = await oneSignalResp.json();
  return new Response(JSON.stringify({ sent: externalIds.length, oneSignal: result }), {
    status: oneSignalResp.ok ? 200 : 502,
  });
});
