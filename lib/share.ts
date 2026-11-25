// encodeURIComponent leaves ! ' ( ) * as-is, and chat apps (Telegram) cut a
// trailing "!" off a link as punctuation — "Don't ask!" arrived as "Don't ask".
// Percent-encode those too so the link survives intact.
export function wordPath(word: string): string {
  return `/word/${encodeURIComponent(word).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())}`;
}

// Lookup key for /word/<word>: case, curly apostrophes and trailing
// punctuation don't matter, so already-truncated links still resolve.
export function wordKey(word: string): string {
  return word.toLowerCase().replace(/[‘’]/g, "'").trim().replace(/[!?.,]+$/, '').trim();
}

// Share a built-in word's /word/<word> page (native share sheet on phones,
// clipboard on desktop). Returns 'copied' so the caller can show a toast.
export async function shareWord(word: string, translation: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = `${window.location.origin}${wordPath(word)}`;
  // Share sheet only on touch devices. On desktop Chrome navigator.share opens
  // the Windows share panel, which is slow and often hangs on a spinner —
  // copying the link is what a desktop user wants anyway.
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (isTouch && navigator.share) {
    try { await navigator.share({ title: `${word} · Lexivo`, text: `${word} — ${translation}`, url }); } catch { /* cancelled */ }
    return 'shared';
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
