'use client';
import Link from 'next/link';

const TESTS = Array.from({ length: 30 }, (_, i) => i + 1);

export default function IeltsReadingPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[var(--text)]">📝 IELTS Reading</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Choose a test to begin. Each test contains 3 passages.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {TESTS.map(n => (
          <Link key={n} href={`/ielts-reading/${n}`}>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:bg-[var(--primary-bg)] transition-all duration-200 p-5 cursor-pointer group">
              <p className="text-xs font-bold text-[var(--text-muted)] group-hover:text-[var(--primary)] mb-1">TEST</p>
              <p className="text-2xl font-black text-[var(--text)] group-hover:text-[var(--primary)]">{n}</p>
              <p className="text-xs text-[var(--text-muted)] mt-2">3 passages · 40 questions</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
