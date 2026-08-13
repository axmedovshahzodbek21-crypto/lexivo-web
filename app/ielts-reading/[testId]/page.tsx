'use client';
import Link from 'next/link';
import { use } from 'react';

export default function IeltsTestPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = use(params);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <Link href="/ielts-reading" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-8">
        ← Back to Tests
      </Link>

      <div className="mb-8">
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">IELTS Reading</p>
        <h1 className="text-2xl font-black text-[var(--text)]">Test {testId}</h1>
      </div>

      <div className="flex flex-col gap-4">
        {[1, 2, 3].map(p => (
          <div key={p} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Passage {p}</p>
              <p className="text-base font-bold text-[var(--text-muted)]">Coming soon</p>
            </div>
            <span className="text-2xl">🔒</span>
          </div>
        ))}
      </div>
    </div>
  );
}
