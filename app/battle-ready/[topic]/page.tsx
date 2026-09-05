'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { getDebateTopic } from '@/lib/debateMock';
import { getBRSideContent } from '@/lib/battleReadyContent';
import { isTopicDone, toggleTopicDone } from '@/lib/battleReadyDone';

export default function BattleReadyTopicPage() {
  const params = useParams();
  const slug = String(params.topic);
  const topic = getDebateTopic(slug);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDone(isTopicDone(slug));
  }, [slug]);

  if (!topic) notFound();

  return (
    <div className="p-4 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <BackButton href="/battle-ready" label="Topics" />

      <div className="flex items-center gap-3">
        <span className="text-3xl">{topic.emoji}</span>
        <h1 className="text-2xl font-bold text-[var(--text)] flex-1">{topic.title}</h1>
        <button
          onClick={() => setDone(toggleTopicDone(slug))}
          className="text-xs font-bold px-3 py-1.5 rounded-full border transition-colors shrink-0"
          style={done
            ? { background: '#22c55e', borderColor: '#15803d', color: 'white' }
            : { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          {done ? '✓ Done' : 'Mark as Done'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2">
        <SideCard slug={slug} side="for" label="FOR Side" color="#22c55e" edge="#15803d" />
        <SideCard slug={slug} side="against" label="AGAINST Side" color="#ef4444" edge="#b91c1c" />
      </div>
    </div>
  );
}

function SideCard({ slug, side, label, color, edge }: { slug: string; side: 'for' | 'against'; label: string; color: string; edge: string }) {
  const hasContent = !!getBRSideContent(slug, side);
  return (
    <Link
      href={`/battle-ready/${slug}/${side}`}
      className="rounded-2xl p-6 text-center text-white hover:-translate-y-0.5 transition-transform"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 10px 0 ${edge}, 0 18px 40px ${color}66` }}
    >
      <div className="text-3xl mb-2">{side === 'for' ? '👍' : '👎'}</div>
      <div className="font-bold">{label}</div>
      {!hasContent && <div className="text-[10px] text-white/70 mt-1">content coming soon</div>}
    </Link>
  );
}
