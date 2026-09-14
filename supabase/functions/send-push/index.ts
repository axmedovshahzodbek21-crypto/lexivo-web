// @ts-nocheck — Deno runtime (Deno.env, jsr: imports), not part of the
// Next.js TS project. VSCode still checks open files against the main
// tsconfig even though supabase/functions is excluded from it.
// Supabase Edge Function: send-push
//
// Called by the `notify_push()` Postgres trigger (see
// supabase/migrations/20260820_push_notifications.sql and
// 20260914_notify_join_request.sql) whenever a row is inserted into
// class_homework, class_targets, class_announcements, or class_members
// (join requests). Resolves the recipients (class students, or the
// teacher for a join request), filters to those who opted into push, and
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
  kind: 'homework' | 'target' | 'announcement' | 'join_request';
  class_id: string;
  student_ids?: string[] | null;
  student_id?: string;
  title?: string;
  message?: string;
}

function buildNotificationText(payload: Payload, className: string, studentName?: string): { heading: string; content: string } {
  switch (payload.kind) {
    case 'homework':
      return { heading: '📚 New homework', content: `${className}: ${payload.title ?? 'New assignment'}` };
    case 'target':
      return { heading: '🎯 New goal set', content: `${className}: ${payload.title ?? 'Check your class page'}` };
    case 'announcement':
      return { heading: '📢 New announcement', content: `${className}: ${payload.message ?? ''}` };
    case 'join_request':
      return { heading: '🙋 New join request', content: `${studentName ?? 'A student'} wants to join ${className}` };
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
    .select('name, teacher_id')
    .eq('id', payload.class_id)
    .maybeSingle();
  const className = classRow?.name ?? 'Your class';

  // join_request is the one kind sent to the teacher, not the class's
  // students — everything else below (recipient list, is_teacher flag)
  // branches on that.
  const isJoinRequest = payload.kind === 'join_request';

  let studentName: string | undefined;
  let recipientIds: string[];
  if (isJoinRequest) {
    if (!classRow?.teacher_id) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no teacher' }), { status: 200 });
    }
    recipientIds = [classRow.teacher_id];
    if (payload.student_id) {
      const { data: studentProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', payload.student_id)
        .maybeSingle();
      studentName = studentProfile?.name ?? undefined;
    }
  } else {
    let studentIds = payload.student_ids ?? null;
    if (!studentIds) {
      const { data: members } = await supabase
        .from('class_members')
        .select('student_id')
        .eq('class_id', payload.class_id);
      studentIds = (members ?? []).map((m) => m.student_id);
    }
    recipientIds = studentIds;
  }
  if (recipientIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no recipients' }), { status: 200 });
  }

  const { data: optedIn } = await supabase
    .from('profiles')
    .select('id')
    .in('id', recipientIds)
    .filter('push_prefs->>class_activity', 'eq', 'true');
  const externalIds = (optedIn ?? []).map((p) => p.id);
  if (externalIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no opted-in recipients' }), { status: 200 });
  }

  const { heading, content } = buildNotificationText(payload, className, studentName);

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
      // to the class instead of just opening the app to Home. is_teacher
      // reflects who the recipient actually is: true only for join_request,
      // which is the one kind sent to the teacher rather than students.
      data: { class_id: payload.class_id, class_name: className, is_teacher: isJoinRequest },
    }),
  });

  const result = await oneSignalResp.json();
  return new Response(JSON.stringify({ sent: externalIds.length, oneSignal: result }), {
    status: oneSignalResp.ok ? 200 : 502,
  });
});
