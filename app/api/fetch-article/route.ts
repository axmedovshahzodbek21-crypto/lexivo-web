import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import dns from 'dns/promises';

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

async function assertPublicHostname(hostname: string): Promise<void> {
  let records: { address: string }[];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error('Could not resolve hostname');
  }
  if (records.length === 0 || records.some(r => isPrivateOrReservedIP(r.address))) {
    throw new Error('Target host is not allowed');
  }
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

// Fetches with redirects handled manually (not by the fetch client), so
// every hop's hostname is re-validated against private/reserved IP ranges
// before it's followed — otherwise a public URL that 302s to an internal
// address would bypass the initial check entirely.
async function fetchPublicUrl(url: string): Promise<Response> {
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const parsed = new URL(current);
    await assertPublicHostname(parsed.hostname);
    const response = await fetch(current, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Lexivo/1.0 +https://lexivo.app)' },
      signal: AbortSignal.timeout(12000),
      redirect: 'manual',
    });
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
