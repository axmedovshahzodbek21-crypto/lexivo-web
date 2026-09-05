'use client';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { getBRSideContent, type BRSide } from '@/lib/battleReadyContent';

export default function PhrasesPage() {
  const params = useParams();
  const slug = String(params.topic);
  const side = String(params.side) as BRSide;
  const content = getBRSideContent(slug, side);
  if (!content) notFound();

  const sideColor = side === 'for' ? '#22c55e' : '#ef4444';

  return (
    <div className="p-4 space-y-5 animate-fade-in max-w-2xl mx-auto">
      <BackButton href={`/battle-ready/${slug}/${side}`} label="Categories" />
      <div>
        <h1 className="text-lg font-bold text-[var(--text)]">Phrases</h1>
        <p className="text-xs text-[var(--text-muted)]">{content.phrases.length} ready-to-use lines, each with examples.</p>
      </div>

      <div className="space-y-3">
        {content.phrases.map((p, idx) => (
          <div key={idx} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="font-bold text-[var(--text)] mb-2">“{p.phrase}”</div>
            <ul className="space-y-1.5">
              {p.examples.map((ex, i) => (
                <li key={i} className="text-sm text-[var(--text-muted)] pl-3 border-l-2" style={{ borderColor: sideColor }}>
                  {ex}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
