import { supabase } from './supabase';
import { localDateStr } from './storage';

// Class XP is intentionally isolated from the app-wide XP pool (lexivo_xp /
// user_data.total_xp / user_stats.xp) — it only reflects activity done
// inside a specific class, stored per (student, class) on class_members.
export async function recordClassStudyDay(studentId: string, classId: string): Promise<void> {
  const today = localDateStr(new Date()); // local time, not UTC — matches when the user actually studied
  try {
    await supabase
      .from('class_study_days')
      .upsert({ student_id: studentId, class_id: classId, study_date: today },
               { onConflict: 'student_id,class_id,study_date', ignoreDuplicates: true });
  } catch (e) {
    // best-effort — logged so a failure is at least debuggable from
    // reports instead of vanishing with no trace.
    console.error('[class-xp] recordClassStudyDay failed:', e);
  }
}

// Increments class_members.class_xp via the record_class_xp RPC rather than
// a client-side read-then-write — two near-simultaneous awards for the same
// student could otherwise both read the same "current" value and silently
// lose one increment. The RPC does a single atomic UPDATE instead.
export async function recordClassXP(studentId: string, classId: string, xp: number, reason: string): Promise<void> {
  if (xp <= 0) return;
  try {
    await Promise.all([
      supabase.rpc('record_class_xp', {
        p_student_id: studentId, p_class_id: classId, p_xp: xp, p_reason: reason,
      }),
      recordClassStudyDay(studentId, classId),
    ]);
  } catch (e) {
    // best-effort; don't block the study flow on xp bookkeeping — but
    // logged so a failure is at least debuggable from reports.
    console.error('[class-xp] recordClassXP failed:', e);
  }
}
