// @ts-nocheck — Deno runtime (Deno.env, jsr: imports), not part of the
// Next.js TS project. VSCode still checks open files against the main
// tsconfig even though supabase/functions is excluded from it.
// Supabase Edge Function: send-scheduled-push
//
// Called once a day by the `send-scheduled-push-daily` pg_cron job (see
// supabase/migrations/20260914_push_prefs_and_scheduled_push.sql), not by
// any row insert — this is the time/inaction-driven counterpart to
// notify_push()/send-push (event-triggered). Runs four independent checks:
// due_reviews, streak_risk, homework_reminders, class_idle. Each is wrapped
// in its own try/catch so one failing (e.g. a schema drift on the
// hand-created `classes` table) never blocks the other three.
//
// Every send is logged to push_notification_log first via an upsert with
// ignoreDuplicates (= `insert ... on conflict do nothing`) — only rows the
// database actually inserted come back from `.select()` afterwards, so
// "was this a duplicate" falls out of the upsert result instead of a
// separate read-then-write. class_idle is the one exception: its throttle
// window is 7 days, not "today", so it can't rely on the same-day unique
// constraint and instead does an explicit lookback check before inserting.
//
// `classes`, `class_targets`, and `class_announcements` predate tracked
// migrations (see 20260820_push_notifications.sql's own caveat) — the column
// names used below were confirmed against information_schema.columns on
// 2026-09-14.
//
// Deploy: supabase functions deploy send-scheduled-push
// Secrets: same as send-push (ONESIGNAL_REST_API_KEY, PUSH_TRIGGER_SECRET) —
// no new secrets needed.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ONESIGNAL_APP_ID = '518b5974-bbf8-4fbf-8c0c-4e434a2f49eb';
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')!;
const PUSH_TRIGGER_SECRET = Deno.env.get('PUSH_TRIGGER_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Asia/Tashkent is UTC+5 year-round (no DST) — plain millisecond math is
// enough, no need for an Intl/timezone library.
const DAY_MS = 24 * 60 * 60 * 1000;
function tashkentDateStr(offsetDays = 0): string {
  const ms = Date.now() + 5 * 60 * 60 * 1000 + offsetDays * DAY_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

async function sendOneSignal(externalIds: string[], heading: string, content: string, data: Record<string, unknown> = {}) {
  if (externalIds.length === 0) return null;
  const resp = await fetch('https://onesignal.com/api/v1/notifications', {
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
      data,
    }),
  });
  return resp.json();
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${PUSH_TRIGGER_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const today = tashkentDateStr(0);
  const sent = { due_reviews: 0, streak_risk: 0, homework_reminders: 0, class_idle: 0 };

  // ── 1. Due reviews ──────────────────────────────────────────────────────
  try {
    const { data: dueRows } = await supabase
      .from('user_data')
      .select('id, due_words_count')
      .gt('due_words_count', 0);
    const candidateIds = (dueRows ?? []).map((r) => r.id);

    if (candidateIds.length > 0) {
      const { data: optedIn } = await supabase
        .from('profiles')
        .select('id')
        .in('id', candidateIds)
        .filter('push_prefs->>due_reviews', 'eq', 'true');
      const optedInIds = new Set((optedIn ?? []).map((p) => p.id));
      const countById = new Map((dueRows ?? []).map((r) => [r.id, r.due_words_count]));

      for (const userId of optedInIds) {
        const { data: inserted } = await supabase
          .from('push_notification_log')
          .upsert(
            [{ user_id: userId, notification_type: 'due_reviews', class_id: null, sent_on: today }],
            { onConflict: 'user_id,notification_type,class_id,sent_on', ignoreDuplicates: true },
          )
          .select('user_id');
        if ((inserted ?? []).length === 0) continue; // already sent today
        const n = countById.get(userId) ?? 0;
        await sendOneSignal([userId], '📖 Words waiting', `You have ${n} word${n === 1 ? '' : 's'} to review today.`, { kind: 'due_reviews' });
        sent.due_reviews++;
      }
    }
  } catch (e) {
    console.error('[send-scheduled-push] due_reviews check failed:', e);
  }

  // ── 2. Streak at risk ───────────────────────────────────────────────────
  try {
    const { data: streakRows } = await supabase
      .from('user_data')
      .select('id, streak, last_study_date')
      .gt('streak', 0);
    const atRisk = (streakRows ?? []).filter((r) => (r.last_study_date ?? '') !== today);
    const candidateIds = atRisk.map((r) => r.id);

    if (candidateIds.length > 0) {
      const { data: optedIn } = await supabase
        .from('profiles')
        .select('id')
        .in('id', candidateIds)
        .filter('push_prefs->>streak_risk', 'eq', 'true');
      const optedInIds = new Set((optedIn ?? []).map((p) => p.id));
      const streakById = new Map(atRisk.map((r) => [r.id, r.streak]));

      for (const userId of optedInIds) {
        const { data: inserted } = await supabase
          .from('push_notification_log')
          .upsert(
            [{ user_id: userId, notification_type: 'streak_risk', class_id: null, sent_on: today }],
            { onConflict: 'user_id,notification_type,class_id,sent_on', ignoreDuplicates: true },
          )
          .select('user_id');
        if ((inserted ?? []).length === 0) continue;
        const n = streakById.get(userId) ?? 0;
        await sendOneSignal([userId], '🔥 Streak at risk', `Study today to keep your ${n}-day streak alive.`, { kind: 'streak_risk' });
        sent.streak_risk++;
      }
    }
  } catch (e) {
    console.error('[send-scheduled-push] streak_risk check failed:', e);
  }

  // ── 3. Homework due-soon / skipped ──────────────────────────────────────
  try {
    const tomorrow = tashkentDateStr(1);
    const yesterday = tashkentDateStr(-1);

    const { data: homeworkRows } = await supabase
      .from('class_homework')
      .select('id, class_id, modes, due_date, student_ids, collection_name')
      .in('due_date', [tomorrow, yesterday]);

    if (homeworkRows && homeworkRows.length > 0) {
      const homeworkIds = homeworkRows.map((h) => h.id);
      const classIds = [...new Set(homeworkRows.map((h) => h.class_id))];

      const [{ data: progressRows }, { data: classRows }, { data: memberRows }] = await Promise.all([
        supabase.from('class_homework_progress').select('homework_id, student_id, mode').in('homework_id', homeworkIds),
        supabase.from('classes').select('id, name').in('id', classIds),
        supabase.from('class_members').select('class_id, student_id').in('class_id', classIds).eq('status', 'approved'),
      ]);

      const classNameById = new Map((classRows ?? []).map((c) => [c.id, c.name]));
      const membersByClass = new Map<string, string[]>();
      for (const m of memberRows ?? []) {
        const arr = membersByClass.get(m.class_id) ?? [];
        arr.push(m.student_id);
        membersByClass.set(m.class_id, arr);
      }
      // completedModes.get(`${homeworkId}:${studentId}`) -> Set of modes done
      const completedModes = new Map<string, Set<string>>();
      for (const p of progressRows ?? []) {
        const key = `${p.homework_id}:${p.student_id}`;
        const set = completedModes.get(key) ?? new Set<string>();
        set.add(p.mode);
        completedModes.set(key, set);
      }

      for (const hw of homeworkRows) {
        const notificationType = hw.due_date === tomorrow ? 'homework_due_soon' : 'homework_overdue';
        const students: string[] = hw.student_ids && hw.student_ids.length > 0
          ? hw.student_ids
          : membersByClass.get(hw.class_id) ?? [];
        if (students.length === 0) continue;

        // Mirror isHomeworkFullyDone (lexivo/lib/screens/class_models.dart):
        // a student is done only once every assigned mode has a progress row.
        const modes: string[] = hw.modes ?? [];
        const notDone = students.filter((studentId) => {
          const done = completedModes.get(`${hw.id}:${studentId}`) ?? new Set<string>();
          return !(modes.length > 0 && modes.every((m) => done.has(m)));
        });
        if (notDone.length === 0) continue;

        const { data: optedIn } = await supabase
          .from('profiles')
          .select('id')
          .in('id', notDone)
          .filter('push_prefs->>homework_reminders', 'eq', 'true');
        const optedInIds = (optedIn ?? []).map((p) => p.id);
        if (optedInIds.length === 0) continue;

        const { data: inserted } = await supabase
          .from('push_notification_log')
          .upsert(
            optedInIds.map((userId) => ({ user_id: userId, notification_type: notificationType, class_id: hw.class_id, sent_on: today })),
            { onConflict: 'user_id,notification_type,class_id,sent_on', ignoreDuplicates: true },
          )
          .select('user_id');
        const newIds = (inserted ?? []).map((r) => r.user_id);
        if (newIds.length === 0) continue;

        const className = classNameById.get(hw.class_id) ?? 'Your class';
        const title = hw.collection_name ?? 'assignment';
        const heading = notificationType === 'homework_due_soon' ? '📚 Homework due tomorrow' : '⏰ Homework overdue';
        const content = `${className}: ${title}`;
        await sendOneSignal(newIds, heading, content, { kind: notificationType, class_id: hw.class_id });
        sent.homework_reminders += newIds.length;
      }
    }
  } catch (e) {
    console.error('[send-scheduled-push] homework_reminders check failed:', e);
  }

  // ── 3b. Class target (ad-hoc per-student goal) due-soon / skipped ───────
  // class_targets is a separate assignable item from class_homework (its own
  // due_date/completed_at, one row per student rather than a modes[] gate),
  // so it needs its own — simpler — completion check: done iff completed_at
  // is set. Shares the homework_reminders opt-in flag since both are
  // "something your teacher assigned isn't done" nudges.
  try {
    const tomorrow = tashkentDateStr(1);
    const yesterday = tashkentDateStr(-1);

    const { data: targetRows } = await supabase
      .from('class_targets')
      .select('id, class_id, student_id, title, due_date, completed_at')
      .in('due_date', [tomorrow, yesterday])
      .is('completed_at', null);

    if (targetRows && targetRows.length > 0) {
      const classIds = [...new Set(targetRows.map((t) => t.class_id))];
      const { data: classRows } = await supabase.from('classes').select('id, name').in('id', classIds);
      const classNameById = new Map((classRows ?? []).map((c) => [c.id, c.name]));

      const studentIds = [...new Set(targetRows.map((t) => t.student_id))];
      const { data: optedIn } = await supabase
        .from('profiles')
        .select('id')
        .in('id', studentIds)
        .filter('push_prefs->>homework_reminders', 'eq', 'true');
      const optedInIds = new Set((optedIn ?? []).map((p) => p.id));

      for (const target of targetRows) {
        if (!optedInIds.has(target.student_id)) continue;
        const notificationType = target.due_date === tomorrow ? 'target_due_soon' : 'target_overdue';

        const { data: inserted } = await supabase
          .from('push_notification_log')
          .upsert(
            [{ user_id: target.student_id, notification_type: notificationType, class_id: target.class_id, sent_on: today }],
            { onConflict: 'user_id,notification_type,class_id,sent_on', ignoreDuplicates: true },
          )
          .select('user_id');
        if ((inserted ?? []).length === 0) continue;

        const className = classNameById.get(target.class_id) ?? 'Your class';
        const heading = notificationType === 'target_due_soon' ? '🎯 Goal due tomorrow' : '⏰ Goal overdue';
        const content = `${className}: ${target.title ?? 'Check your class page'}`;
        await sendOneSignal([target.student_id], heading, content, { kind: notificationType, class_id: target.class_id });
        sent.homework_reminders++;
      }
    }
  } catch (e) {
    console.error('[send-scheduled-push] target_reminders check failed:', e);
  }

  // ── 4. Idle class (teacher-facing) ──────────────────────────────────────
  try {
    const { data: classRows } = await supabase.from('classes').select('id, name, teacher_id');
    const cutoff = new Date(Date.now() - 5 * DAY_MS).toISOString();
    const throttleCutoff = tashkentDateStr(-7);

    for (const cls of classRows ?? []) {
      const [{ data: hwLast }, { data: targetLast }, { data: annLast }] = await Promise.all([
        supabase.from('class_homework').select('created_at').eq('class_id', cls.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('class_targets').select('created_at').eq('class_id', cls.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('class_announcements').select('created_at').eq('class_id', cls.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      const lastActivity = [hwLast?.created_at, targetLast?.created_at, annLast?.created_at]
        .filter(Boolean)
        .sort()
        .pop();
      const isIdle = !lastActivity || lastActivity < cutoff;
      if (!isIdle) continue;

      const { data: teacherPrefs } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', cls.teacher_id)
        .filter('push_prefs->>class_idle', 'eq', 'true')
        .maybeSingle();
      if (!teacherPrefs) continue;

      // 7-day throttle: unlike due_reviews/streak_risk/homework_reminders,
      // this can't rely on the same-day unique constraint alone (sent_on
      // differs every day) — check the lookback window explicitly first.
      const { data: recentLog } = await supabase
        .from('push_notification_log')
        .select('id')
        .eq('notification_type', 'class_idle')
        .eq('class_id', cls.id)
        .gte('sent_on', throttleCutoff)
        .maybeSingle();
      if (recentLog) continue;

      await supabase.from('push_notification_log').insert({
        user_id: cls.teacher_id,
        notification_type: 'class_idle',
        class_id: cls.id,
        sent_on: today,
      });
      await sendOneSignal(
        [cls.teacher_id],
        `🌱 ${cls.name} is quiet`,
        `You haven't assigned anything to ${cls.name} in a while.`,
        { kind: 'class_idle', class_id: cls.id, is_teacher: true },
      );
      sent.class_idle++;
    }
  } catch (e) {
    console.error('[send-scheduled-push] class_idle check failed:', e);
  }

  return new Response(JSON.stringify({ sent }), { status: 200 });
});
