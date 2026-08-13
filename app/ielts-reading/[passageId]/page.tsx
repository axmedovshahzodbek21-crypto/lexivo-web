'use client';
import Link from 'next/link';
import { use } from 'react';

const TESTS = Array.from({ length: 30 }, (_, i) => i + 1);

export default function PassagePage({ params }: { params: Promise<{ passageId: string }> }) {
  const { passageId } = use(params);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <Link href="/ielts-reading" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-8">
        ← Back to Passages
      </Link>

      <div className="mb-8">
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">IELTS Reading</p>
        <h1 className="text-2xl font-black text-[var(--text)]">Passage {passageId}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Choose a test to begin.</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {TESTS.map(n => (
          <Link key={n} href={`/ielts-reading/${passageId}/${n}`}>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:bg-[var(--primary-bg)] transition-all duration-200 p-4 cursor-pointer group text-center">
              <p className="text-[10px] font-bold text-[var(--text-muted)] group-hover:text-[var(--primary)] uppercase tracking-wider">Test</p>
              <p className="text-xl font-black text-[var(--text)] group-hover:text-[var(--primary)]">{n}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
