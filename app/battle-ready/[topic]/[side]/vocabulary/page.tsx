'use client';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { getDebateTopic } from '@/lib/debateMock';
import { getBRSideContent, type BRSide } from '@/lib/battleReadyContent';

export default function VocabularyHubPage() {
  const params = useParams();
  const slug = String(params.topic);
  const side = String(params.side) as BRSide;
  const topic = getDebateTopic(slug);
  const content = getBRSideContent(slug, side);
  if (!topic) notFound();

  const sideColor = side === 'for' ? '#22c55e' : '#ef4444';
  const modes = [
    { key: 'learn', icon: '📖', label: 'Learn' },
    { key: 'flashcards', icon: '🃏', label: 'Flashcards' },
    { key: 'quiz', icon: '❓', label: 'Quiz' },
    { key: 'match', icon: '🎯', label: 'Match' },
  ];

  return (
    <div className="p-4 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <BackButton href={`/battle-ready/${slug}/${side}`} label="Categories" />

      <div>
        <h1 className="text-xl font-bold text-[var(--text)]">Vocabulary</h1>
        <p className="text-xs text-[var(--text-muted)]">{content?.vocab.length ?? 0} words · {topic.title}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {modes.map(m => (
          <Link
            key={m.key}
            href={`/battle-ready/${slug}/${side}/vocabulary/${m.key}`}
            className="rounded-2xl p-5 text-center border border-[var(--border)] bg-[var(--surface)] hover:-translate-y-0.5 transition-transform"
          >
            <div className="text-2xl mb-1">{m.icon}</div>
            <div className="font-bold text-sm" style={{ color: sideColor }}>{m.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
