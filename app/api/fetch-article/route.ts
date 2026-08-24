import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import dns from 'dns/promises';
import http from 'http';
import https from 'https';
import zlib from 'zlib';

// In-memory rate limiter: max 10 article fetches per user per minute
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
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

// Blocks SSRF against internal/private infrastructure (including cloud
// metadata endpoints like 169.254.169.254) — a hostname is only safe once
// every IP it resolves to is checked, since DNS can return multiple/mixed
// records and a hostname's public-looking name proves nothing on its own.
function isPrivateOrReservedIP(ip: string): boolean {
  // IPv4
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [parseInt(v4[1], 10), parseInt(v4[2], 10)];
    if (a === 127) return true;                     // loopback
    if (a === 10) return true;                       // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true;          // RFC1918
    if (a === 169 && b === 254) return true;          // link-local incl. cloud metadata
    if (a === 0) return true;                         // "this network"
    if (a >= 224) return true;                        // multicast/reserved
    return false;
  }
  // IPv6
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;                    // loopback
  if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local fe80::/10
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local fc00::/7
  if (lower.startsWith('::ffff:')) return isPrivateOrReservedIP(lower.slice(7)); // IPv4-mapped
  return false;
}

// Resolves hostname once and validates every IP it returns, then hands back
// the specific address+family to connect to. The caller MUST pin the actual
// connection to this exact IP (see requestPinnedToIP below) rather than
// letting the HTTP client re-resolve DNS independently for the request —
// otherwise this validation is a TOCTOU no-op: an attacker-controlled DNS
// server can return a public IP for this lookup and a private/cloud-
// metadata IP a moment later for the real connection (DNS rebinding).
async function resolveValidatedIP(hostname: string): Promise<{ address: string; family: number }> {
  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error('Could not resolve hostname');
  }
  if (records.length === 0 || records.some(r => isPrivateOrReservedIP(r.address))) {
    throw new Error('Target host is not allowed');
  }
  return records[0];
}

function extractText(html: string): string {
  let text = html
    // Remove noisy elements with their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '');

  // Prefer <article> or <main> content when available
  const focused =
    text.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    text.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  if (focused) text = focused;

  // Convert block-level elements to paragraph breaks
  text = text.replace(/<\/?(p|div|h[1-6]|li|br|tr|blockquote|section)\b[^>]*>/gi, '\n');

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&[a-z]+;/gi, ' ');

  // Clean up whitespace — drop lines that are clearly UI noise (< 20 chars)
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 20)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const MAX_REDIRECTS = 5;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB cap on the fetched page

// Decompresses a response body per its Content-Encoding header — global
// fetch()/undici does this transparently, so a raw http/https request
// (used below to pin the connection to a validated IP) has to replicate it
// by hand or every gzip/br-compressed page (the large majority of real
// sites) would come back as garbage binary instead of HTML.
function decodeBody(buffer: Buffer, contentEncoding: string | undefined): Buffer {
  switch ((contentEncoding ?? '').toLowerCase()) {
    case 'gzip': return zlib.gunzipSync(buffer);
    case 'deflate': return zlib.inflateSync(buffer);
    case 'br': return zlib.brotliDecompressSync(buffer);
    default: return buffer;
  }
}

// Makes one GET request pinned to a pre-validated IP via a `lookup`
// override that always resolves to it, regardless of what a fresh DNS query
// for the hostname would return — the hostname/SNI/Host header are still
// the real ones (targetUrl is used as-is), only the actual TCP connection
// target is pinned, closing the DNS-rebinding TOCTOU window described on
// resolveValidatedIP above. Returns a standard Response so the rest of this
// route doesn't need to know it isn't using the global fetch().
function requestPinnedToIP(targetUrl: URL, ip: string, family: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const transport = targetUrl.protocol === 'https:' ? https : http;
    const req = transport.request(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Lexivo/1.0 +https://lexivo.app)',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      timeout: 12000,
      // Node's net module requests the array form (options.all) for
      // Happy-Eyeballs-style dual-stack connection attempts — passing only
      // the 3-arg single-address form there throws ERR_INVALID_IP_ADDRESS
      // (confirmed by an actual test request against a real IPv6 host, not
      // just reading Node's docs). Both forms must be pinned to the same
      // validated IP.
      lookup: (_hostname, options, callback) => {
        if (options.all) {
          (callback as (err: null, addresses: { address: string; family: number }[]) => void)(null, [{ address: ip, family }]);
        } else {
          callback(null, ip, family);
        }
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      let total = 0;
      res.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > MAX_BYTES) {
          req.destroy();
          reject(new Error('Page is too large'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        try {
          const raw = Buffer.concat(chunks);
          const body = decodeBody(raw, res.headers['content-encoding']);
          const headers = new Headers();
          for (const [key, value] of Object.entries(res.headers)) {
            if (key.toLowerCase() === 'content-encoding') continue; // already decoded
            if (typeof value === 'string') headers.set(key, value);
            else if (Array.isArray(value)) headers.set(key, value.join(', '));
          }
          resolve(new Response(new Uint8Array(body), { status: res.statusCode ?? 502, headers }));
        } catch {
          reject(new Error('Failed to decode response body'));
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.on('error', reject);
    req.end();
  });
}

// Fetches with redirects handled manually, so every hop's hostname is
// re-validated (and re-pinned) against private/reserved IP ranges before
// it's followed — otherwise a public URL that 302s to an internal address
// would bypass the initial check entirely.
async function fetchPublicUrl(url: string): Promise<Response> {
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const parsed = new URL(current);
    const { address, family } = await resolveValidatedIP(parsed.hostname);
    const response = await requestPinnedToIP(parsed, address, family);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return response;
      current = new URL(location, current).toString();
      continue;
    }
    return response;
  }
  throw new Error('Too many redirects');
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

  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: 'Rate limit exceeded — try again in a minute' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { url } = body as { url?: string };

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return NextResponse.json({ error: 'Only http/https URLs are supported' }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetchPublicUrl(url);
  } catch {
    return NextResponse.json({ error: 'Could not reach that URL' }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json({ error: `Site returned ${response.status}` }, { status: 502 });
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    return NextResponse.json({ error: 'URL must point to an HTML page' }, { status: 400 });
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    return NextResponse.json({ error: 'Page is too large' }, { status: 413 });
  }

  const html = await response.text();
  if (html.length > MAX_BYTES) {
    return NextResponse.json({ error: 'Page is too large' }, { status: 413 });
  }
  const text = extractText(html);

  if (text.length < 100) {
    return NextResponse.json({ error: 'Could not extract readable text from this page. Try copying the text manually.' }, { status: 422 });
  }

  return NextResponse.json({ text });
}
