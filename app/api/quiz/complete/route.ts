import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const MAX_QUESTIONS  = 100;
const XP_PER_CORRECT = 3;
const XP_PER_WRONG   = 1;

// In-memory rate limiter: max 10 completions per minute per user
const rateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(uid);
  if (!entry || now >= entry.resetAt) {
    rateLimit.set(uid, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: 'Rate limit exceeded — try again in a minute' }, { status: 429 });
  }

  // Input validation
  let body: { correctCount: unknown; totalCount: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { correctCount, totalCount } = body;
  if (
    typeof correctCount !== 'number' || typeof totalCount !== 'number' ||
    !Number.isInteger(correctCount) || !Number.isInteger(totalCount) ||
    correctCount < 0 || totalCount < 1 ||
    correctCount > totalCount || totalCount > MAX_QUESTIONS
  ) {
    return NextResponse.json({ error: 'Invalid quiz result' }, { status: 400 });
  }

  const xpAwarded = correctCount * XP_PER_CORRECT + (totalCount - correctCount) * XP_PER_WRONG;

  // Update Supabase using the user's JWT so RLS applies
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: stats } = await supabase
    .from('user_stats')
    .select('xp')
    .eq('id', user.id)
    .maybeSingle();
  const currentXp = (stats?.xp as number) ?? 0;

  await supabase.from('user_stats').upsert(
    { id: user.id, xp: currentXp + xpAwarded, xp_updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  );

  return NextResponse.json({ xpAwarded });
}
