import { NextRequest, NextResponse } from 'next/server';

// Generates a fresh nonce per request so script-src can drop 'unsafe-inline'
// without breaking Next.js's own hydration scripts — Next automatically
// applies this nonce to the scripts it injects when it sees the x-nonce
// request header set below, so no component code needs to reference it.
// (Content-Security-Policy used to be static in next.config.ts, but a static
// config can't generate a per-request nonce — that's why this lives here.)
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://cdn.onesignal.com${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.onesignal.com",
    "img-src 'self' data: blob: https:",
    "style-src 'self' 'unsafe-inline' https://onesignal.com",
    "font-src 'self' data:",
    "worker-src 'self' blob: https://cdn.onesignal.com",
    "frame-ancestors 'none'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    // Skip static assets and Next internals — no need to CSP-nonce those.
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-.*\\.png|sw.js|OneSignalSDKWorker.js).*)',
  ],
};
