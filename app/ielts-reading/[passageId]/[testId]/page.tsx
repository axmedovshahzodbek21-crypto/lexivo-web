'use client';
import { use, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { ieltsData } from '@/lib/ielts-data';
import { TestRenderer } from '@/components/ielts/TestRenderer';

function TestPageInner({ passageId, testId }: { passageId: string; testId: string }) {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'test' ? 'test' : 'review';

  const section = ieltsData.find(s => s.passageSection === Number(passageId));
  const test = section?.tests.find(t => t.testNumber === Number(testId));

  if (!test) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
        <BackButton href={`/ielts-reading/${passageId}`} label="Back to Tests" className="mb-8" />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 flex flex-col items-center text-center gap-3">
          <span className="text-4xl">🔒</span>
          <p className="text-lg font-bold text-[var(--text)]">Coming soon</p>
          <p className="text-sm text-[var(--text-muted)]">This test is being prepared. Check back later.</p>
        </div>
      </div>
    );
  }

  return <TestRenderer passageId={passageId} testId={testId} test={test} mode={mode} />;
}

export default function TestPage({ params }: { params: Promise<{ passageId: string; testId: string }> }) {
  const { passageId, testId } = use(params);
  return (
    <Suspense>
      <TestPageInner passageId={passageId} testId={testId} />
    </Suspense>
  );
}
