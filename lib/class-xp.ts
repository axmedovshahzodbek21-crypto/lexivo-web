import { supabase } from './supabase';

// Class XP is intentionally isolated from the app-wide XP pool (lexivo_xp /
// user_data.total_xp / user_stats.xp) — it only reflects activity done
// inside a specific class, stored per (student, class) on class_members.
export async function recordClassStudyDay(studentId: string, classId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    await supabase
      .from('class_study_days')
      .upsert({ student_id: studentId, class_id: classId, study_date: today },
               { onConflict: 'student_id,class_id,study_date', ignoreDuplicates: true });
  } catch {
    // best-effort
  }
}

export async function recordClassXP(studentId: string, classId: string, xp: number, reason: string): Promise<void> {
  if (xp <= 0) return;
  try {
    const { data: row } = await supabase
      .from('class_members')
      .select('class_xp')
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .maybeSingle();
    const current = (row?.class_xp as number | null) ?? 0;
    await Promise.all([
      supabase
        .from('class_members')
        .update({ class_xp: current + xp })
        .eq('student_id', studentId)
        .eq('class_id', classId),
      supabase
        .from('class_xp_history')
        .insert({ user_id: studentId, class_id: classId, amount: xp, reason }),
      recordClassStudyDay(studentId, classId),
    ]);
  } catch {
    // best-effort; don't block the study flow on xp bookkeeping
  }
}
