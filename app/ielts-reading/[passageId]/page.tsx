'use client';
import Link from 'next/link';
import { use } from 'react';
import { ieltsData } from '@/lib/ielts-data';

const TOTAL_TESTS = 30;

export default function PassagePage({ params }: { params: Promise<{ passageId: string }> }) {
  const { passageId } = use(params);
  const section = ieltsData.find(s => s.passageSection === Number(passageId));
  const availableTests = new Set((section?.tests ?? []).map(t => t.testNumber));

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

      <div className="flex flex-col gap-3">
        {Array.from({ length: TOTAL_TESTS }, (_, i) => i + 1).map(n => {
          const available = availableTests.has(n);
          const test = section?.tests.find(t => t.testNumber === n);
          return available ? (
            <div key={n} className="rounded-2xl border border-[var(--primary)] bg-[var(--surface)] p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider">Test {n}</p>
                <p className="text-sm font-bold text-[var(--text)] mt-0.5 line-clamp-1">{test?.title}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{test?.questions.length} questions · 20 min</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link href={`/ielts-reading/${passageId}/${n}?mode=review`}>
                  <button className="px-3 py-1.5 rounded-xl text-xs font-bold border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">
                    📖 Review
                  </button>
                </Link>
                <Link href={`/ielts-reading/${passageId}/${n}?mode=test`}>
                  <button className="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all" style={{ background: 'var(--primary)' }}>
                    📝 Test
                  </button>
                </Link>
              </div>
            </div>
          ) : (
            <div key={n} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center justify-between opacity-35 cursor-default">
              <div>
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Test {n}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Coming soon</p>
              </div>
              <span className="text-lg">🔒</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
