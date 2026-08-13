'use client';

export default function RealEnglishPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <div className="mb-8">
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Listening Skills</p>
        <h1 className="text-2xl font-black text-[var(--text)]">🗣️ Real English</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Learn the words, then understand the real thing.</p>
      </div>

      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 flex flex-col items-center justify-center text-center gap-3">
        <span className="text-4xl">🎬</span>
        <p className="text-sm font-bold text-[var(--text)]">Coming soon</p>
        <p className="text-xs text-[var(--text-muted)]">Interview vocab sets with unlockable YouTube links are on the way.</p>
      </div>
    </div>
  );
}
