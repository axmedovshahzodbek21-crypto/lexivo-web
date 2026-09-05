'use client';
import { use, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { STRUCTURES, UNIT_SLUGS } from '@/lib/structures-data';
import { getStructuresSRS, getSentenceProgress, getSentenceTotal } from '@/lib/storage';

export default function StructureUnitHubPage({ params }: { params: Promise<{ unit: string }> }) {
  const { unit: slug } = use(params);
  const router = useRouter();
  const unit = UNIT_SLUGS[slug];

  const structuresInUnit = useMemo(() => unit ? STRUCTURES.filter(s => s.unit === unit) : [], [unit]);
  const learnedIds = useMemo(() => new Set(getStructuresSRS().map(s => s.id)), []);
  const learnedInUnit = structuresInUnit.filter(s => learnedIds.has(s.id)).length;
  const sentenceProgress = unit ? getSentenceProgress(unit) : 0;
  const sentenceTotal = unit ? getSentenceTotal(unit) : 0;

  if (!unit) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen">
        <p className="text-[var(--text-muted)] mb-4">Unknown unit.</p>
        <Link href="/structures" className="btn-primary inline-block">Back to Structures</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      <div className="p-4 border-b border-[var(--border)]">
        <button onClick={() => router.push('/structures')} className="btn-icon mb-3" aria-label="Go back">←</button>
        <h1 className="text-xl font-bold text-[var(--text)]">{unit}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          {learnedInUnit}/{structuresInUnit.length} structures learned · {sentenceProgress}/{sentenceTotal} sentences translated
        </p>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-3">
        <Link
          href={`/structures/${slug}/learn`}
          className="card flex items-center gap-4 p-4 hover:bg-[var(--surface-2)] transition-colors"
        >
          <span className="text-3xl">🔎</span>
          <div>
            <div className="font-bold text-[var(--text)]">Learn</div>
            <div className="text-xs text-[var(--text-muted)]">Discover structures for this unit, one at a time</div>
          </div>
        </Link>

        <Link
          href={`/structures/${slug}/flashcards`}
          className="card flex items-center gap-4 p-4 hover:bg-[var(--surface-2)] transition-colors"
        >
          <span className="text-3xl">🃏</span>
          <div>
            <div className="font-bold text-[var(--text)]">Flashcards</div>
            <div className="text-xs text-[var(--text-muted)]">Drill what you've learned in this unit</div>
          </div>
        </Link>

        <Link
          href={`/structures/${slug}/translate`}
          className="card flex items-center gap-4 p-4 hover:bg-[var(--surface-2)] transition-colors"
        >
          <span className="text-3xl">✍️</span>
          <div>
            <div className="font-bold text-[var(--text)]">Translate</div>
            <div className="text-xs text-[var(--text-muted)]">Translate Uzbek sentences yourself, then check your answer</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
