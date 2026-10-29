import { supabase } from './supabase';
import { localDateStr } from './storage';
import { registerOfflineWriter, enqueueOfflineWrite } from './offline-queue';

// Class XP is intentionally isolated from the app-wide XP pool (lexivo_xp /
// user_data.total_xp / user_stats.xp) — it only reflects activity done
// inside a specific class, stored per (student, class) on class_members.

interface StudyDayPayload { studentId: string; classId: string }

async function writeClassStudyDay(p: StudyDayPayload): Promise<void> {
  const today = localDateStr(new Date()); // local time, not UTC — matches when the user actually studied
  const { error } = await supabase
    .from('class_study_days')
    .upsert({ student_id: p.studentId, class_id: p.classId, study_date: today },
             { onConflict: 'student_id,class_id,study_date', ignoreDuplicates: true });
  if (error) throw error;
}
registerOfflineWriter('record_class_study_day', writeClassStudyDay);

// Best-effort, and now offline-safe: a failed attempt (offline, network
// error, etc.) is queued by enqueueOfflineWrite and replayed automatically
// once the browser reconnects (see lib/offline-queue.ts), instead of the
// write just vanishing with nothing but a console error.
export async function recordClassStudyDay(studentId: string, classId: string): Promise<void> {
  await enqueueOfflineWrite('record_class_study_day', { studentId, classId } satisfies StudyDayPayload);
}

// Records a finished homework mode; the server re-validates everything and
// computes the class XP itself. Resolves to the XP it awarded — 0 when this
// mode was already completed before (homework pays once) or on error.
export async function recordHomeworkProgress(hwId: string, mode: string, clientWordCount: number): Promise<number> {
  const { data, error } = await supabase.rpc('record_class_homework_progress', {
    p_homework_id: hwId, p_mode: mode, p_client_word_count: clientWordCount,
  });
  if (error) { console.error('[recordHomeworkProgress]', error); return 0; }
  const row = (Array.isArray(data) ? data[0] : data) as { xp_awarded?: number } | null;
  return row?.xp_awarded ?? 0;
}

interface ClassXPPayload { studentId: string; classId: string; xp: number; reason: string }

// Increments class_members.class_xp via the record_class_xp RPC rather than
// a client-side read-then-write — two near-simultaneous awards for the same
// student could otherwise both read the same "current" value and silently
// lose one increment. The RPC does a single atomic UPDATE instead.
async function writeClassXP(p: ClassXPPayload): Promise<void> {
  const { error } = await supabase.rpc('record_class_xp', {
    p_student_id: p.studentId, p_class_id: p.classId, p_xp: p.xp, p_reason: p.reason,
  });
  if (error) throw error;
}
registerOfflineWriter('record_class_xp', writeClassXP);

// Offline-safe: see recordClassStudyDay above. The two writes are queued
// independently (rather than bundled in one Promise.all) so one succeeding
// while the other fails doesn't lose or duplicate either — each retries on
// its own until it lands.
//
// Resolves to the XP the server actually awarded — 0 when a server rule
// skipped it (Words-tab practice pays once per activity per day, Review has
// a daily cap; see 20261029000003_class_practice_xp_daily.sql) — or null
// when unknown (queued offline, or an older server that returns nothing), in
// which case callers keep showing the amount they asked for.
export async function recordClassXP(studentId: string, classId: string, xp: number, reason: string): Promise<number | null> {
  if (xp <= 0) return 0;
  const payload = { studentId, classId, xp, reason } satisfies ClassXPPayload;
  let awarded: number | null = null;
  await Promise.all([
    (async () => {
      try {
        const { data, error } = await supabase.rpc('record_class_xp', {
          p_student_id: studentId, p_class_id: classId, p_xp: xp, p_reason: reason,
        });
        if (error) throw error;
        awarded = typeof data === 'number' ? data : null;
      } catch {
        await enqueueOfflineWrite('record_class_xp', payload);
      }
    })(),
    recordClassStudyDay(studentId, classId),
  ]);
  return awarded;
}
