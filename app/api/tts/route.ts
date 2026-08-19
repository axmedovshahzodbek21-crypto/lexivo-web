import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Max requests per authenticated user per minute — generous for interactive
// study use (many single-word lookups in a session), but bounds abuse since
// each call is billed against our own Google Cloud quota. Keyed by user id,
// same in-memory-per-user pattern used by /api/digest.
const RATE_LIMIT = 60;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now - entry.windowStart > 60_000) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json();
    const { text, languageCode } = body as { text?: string; languageCode?: string };

    if (!text || typeof text !== 'string' || text.length > 200) {
      return NextResponse.json({ error: 'Invalid text' }, { status: 400 });
    }
    if (!languageCode || typeof languageCode !== 'string') {
      return NextResponse.json({ error: 'Invalid languageCode' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_TTS_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_TTS_API_KEY env var is not set');
      return NextResponse.json({ error: 'TTS unavailable' }, { status: 500 });
    }

    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode, ssmlGender: 'FEMALE' },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.85 },
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'TTS request failed' }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json({ audioContent: data.audioContent });
  } catch (err) {
    console.error('tts route error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
