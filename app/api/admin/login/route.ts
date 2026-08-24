import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  throw new Error('Missing ADMIN_PASSWORD env var — check .env.local (or the deployment\'s environment variables) and redeploy.');
}

function matchesPassword(candidate: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(ADMIN_PASSWORD!);
  // timingSafeEqual requires equal-length buffers; a length mismatch is itself a safe "no match".
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const { password } = (await req.json()) as { password?: string };
  if (!password || !matchesPassword(password)) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('admin_auth', ADMIN_PASSWORD!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return response;
}
