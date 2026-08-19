import { supabase } from './supabase';

// Single source of truth for join-code generation and class-row creation —
// previously copy-pasted independently in app/classes/page.tsx and
// app/classes/created/page.tsx (and again, separately, in the Flutter app),
// so a format change meant updating multiple call sites in sync and no code
// path retried on a join_code collision (classes.join_code has a unique
// constraint in Postgres).

export function generateClassJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'LEXI-' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function createClass(name: string, teacherId: string): Promise<{ error: string | null }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from('classes').insert({
      name, join_code: generateClassJoinCode(), teacher_id: teacherId,
    });
    if (!error) return { error: null };
    if (error.code !== '23505' || attempt === 4) return { error: error.message };
  }
  return { error: 'Failed to create class.' };
}
