import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// In-memory rate limiter: max 20 transcriptions per user per minute
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(uid);
  if (!entry || now >= entry.resetAt) {
    rateLimit.set(uid, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  // Auth check — must be a logged-in user
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit per user
  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: 'Rate limit exceeded — try again in a minute' }, { status: 429 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured on server' }, { status: 503 });
  }

  let body: FormData;
  try {
    body = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const audio = body.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
  }

  const form = new FormData();
  form.append('file', new File([audio], 'audio.webm', { type: audio.type || 'audio/webm' }));
  form.append('model', 'whisper-1');
  form.append('language', 'en');

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!resp.ok) {
    const text = await resp.text();
    return NextResponse.json({ error: text }, { status: resp.status });
  }

  const data = await resp.json();
  return NextResponse.json({ text: (data.text as string).trim() });
}
