import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and/or ' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. Check .env.local ' +
    '(or the deployment\'s environment variables) and redeploy.'
  );
}

// Some browsers/networks have been observed throwing "Failed to execute
// 'fetch' on 'Window': ... String contains non ISO-8859-1 code point" on
// every single auth call (signInWithPassword, OAuth callback session
// exchange) — reproducible on multiple devices/networks but NOT in a plain
// Node script hitting the same URL/key, so the request itself is fine and
// something is injecting an invisible non-Latin1 character into a header
// value between our code and the browser's native fetch (a Chromium quirk,
// or a proxy/extension rewriting requests — never conclusively pinned down).
// Stripping any character outside the header-safe range before the real
// fetch runs makes sign-in work regardless of where it's coming from.
function sanitizeHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[^\x00-\xFF]/g, '');
}

const sanitizingFetch: typeof fetch = (input, init) => {
  if (init?.headers) {
    const clean: Record<string, string> = {};
    const entries = init.headers instanceof Headers
      ? Array.from(init.headers.entries())
      : Array.isArray(init.headers)
      ? init.headers
      : Object.entries(init.headers);
    for (const [k, v] of entries) clean[k] = sanitizeHeaderValue(String(v));
    init = { ...init, headers: clean };
  }
  return fetch(input, init);
};

export const supabase = createClient(url, key, {
  global: { fetch: sanitizingFetch },
});
