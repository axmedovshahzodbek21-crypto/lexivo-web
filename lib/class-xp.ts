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
export async function recordClassXP(studentId: string, classId: string, xp: number, reason: string): Promise<void> {
  if (xp <= 0) return;
  await Promise.all([
    enqueueOfflineWrite('record_class_xp', { studentId, classId, xp, reason } satisfies ClassXPPayload),
    recordClassStudyDay(studentId, classId),
  ]);
}
