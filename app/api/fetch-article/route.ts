import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(req: NextRequest) {
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
    response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Lexivo/1.0 +https://lexivo.app)' },
      signal: AbortSignal.timeout(12000),
    });
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

  const html = await response.text();
  const text = extractText(html);

  if (text.length < 100) {
    return NextResponse.json({ error: 'Could not extract readable text from this page. Try copying the text manually.' }, { status: 422 });
  }

  return NextResponse.json({ text });
}
