// Share a built-in word's /word/<word> page (native share sheet on phones,
// clipboard on desktop). Returns 'copied' so the caller can show a toast.
export async function shareWord(word: string, translation: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = `${window.location.origin}/word/${encodeURIComponent(word)}`;
  if (navigator.share) {
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
