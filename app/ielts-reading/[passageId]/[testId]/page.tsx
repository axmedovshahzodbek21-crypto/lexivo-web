'use client';
import Link from 'next/link';
import { use } from 'react';

export default function TestPage({ params }: { params: Promise<{ passageId: string; testId: string }> }) {
  const { passageId, testId } = use(params);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <Link href={`/ielts-reading/${passageId}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-8">
        ← Back to Tests
      </Link>

      <div className="mb-8">
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">IELTS Reading · Passage {passageId}</p>
        <h1 className="text-2xl font-black text-[var(--text)]">Test {testId}</h1>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 flex flex-col items-center justify-center text-center gap-3">
        <span className="text-4xl">🔒</span>
        <p className="text-lg font-bold text-[var(--text)]">Coming soon</p>
        <p className="text-sm text-[var(--text-muted)]">This test is being prepared. Check back later.</p>
      </div>
    </div>
  );
}
