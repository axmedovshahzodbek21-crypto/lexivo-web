'use client';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { getDebateTopic } from '@/lib/debateMock';
import { getBRSideContent, type BRSide } from '@/lib/battleReadyContent';

export default function BattleReadySidePage() {
  const params = useParams();
  const slug = String(params.topic);
  const side = String(params.side) as BRSide;
  const topic = getDebateTopic(slug);
  const content = getBRSideContent(slug, side);
  if (!topic) notFound();

  const sideColor = side === 'for' ? '#22c55e' : '#ef4444';
  const sideEdge = side === 'for' ? '#15803d' : '#b91c1c';
  const sideLabel = side === 'for' ? 'FOR' : 'AGAINST';

  const cards = [
    { key: 'vocabulary', icon: '📖', label: 'Vocabulary', count: content?.vocab.length ?? 0, unit: 'words' },
    { key: 'phrases', icon: '💬', label: 'Phrases', count: content?.phrases.length ?? 0, unit: 'phrases' },
    { key: 'idioms', icon: '🎭', label: 'Idioms', count: content?.idioms.length ?? 0, unit: 'idioms' },
    { key: 'arguments', icon: '⚔️', label: 'Arguments', count: content?.arguments.length ?? 0, unit: 'arguments' },
  ];

  return (
    <div className="p-4 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <BackButton href={`/battle-ready/${slug}`} label="Topic" />

      <div className="flex items-center gap-3">
        <span className="text-3xl">{topic.emoji}</span>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">{topic.title}</h1>
          <p className="text-xs font-semibold" style={{ color: sideColor }}>{sideLabel} side</p>
        </div>
      </div>

      {!content && (
        <p className="text-sm text-[var(--text-muted)]">No content written for this side yet.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {cards.map(c => (
          <Link
            key={c.key}
            href={`/battle-ready/${slug}/${side}/${c.key}`}
            className="rounded-2xl p-5 text-center border border-[var(--border)] bg-[var(--surface)] hover:-translate-y-0.5 transition-transform"
          >
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="font-bold text-sm text-[var(--text)]">{c.label}</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{c.count} {c.unit}</div>
            <div className="mt-2 h-1 rounded-full" style={{ background: sideColor, opacity: 0.5 }} />
          </Link>
        ))}
      </div>
    </div>
  );
}
