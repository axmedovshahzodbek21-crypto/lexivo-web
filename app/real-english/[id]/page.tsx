'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { realEnglishSets, type RealEnglishSet } from '@/lib/real-english-data';
import { getSRSWords, getReviewLog } from '@/lib/storage';

const UNLOCK_INTERVAL = 7;

function getSetProgress(set: RealEnglishSet) {
  const srsWords = getSRSWords();
  const log = getReviewLog();
  const setWords = srsWords.filter(w => w.collectionName === set.collectionName);
  const done = setWords.filter(w => (log[w.id] ?? []).includes(UNLOCK_INTERVAL)).length;
  const unlocked = setWords.length >= set.wordCount && done >= set.wordCount;
  return { done, total: set.wordCount, unlocked };
}

const ACTIVITY_CARDS = [
  {
    key: 'learn',
    icon: '📖',
    label: 'Learn',
    description: 'Study words one by one with translations and examples.',
    gradient: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
    edge: '#4c1d95',
    href: (col: string) => `/learn?collection=${encodeURIComponent(col)}`,
  },
  {
    key: 'flashcards',
    icon: '🃏',
    label: 'Flashcards',
    description: 'Flip through the words to test your recall.',
    gradient: 'linear-gradient(135deg, #0e7490, #06b6d4)',
    edge: '#164e63',
    href: (col: string) => `/flashcards?collection=${encodeURIComponent(col)}`,
  },
  {
    key: 'quiz',
    icon: '✏️',
    label: 'Quiz',
    description: 'Multiple-choice questions to check your memory.',
    gradient: 'linear-gradient(135deg, #b45309, #f59e0b)',
    edge: '#78350f',
    href: (col: string) => `/quiz?collection=${encodeURIComponent(col)}`,
  },
  {
    key: 'match',
    icon: '🔗',
    label: 'Match',
    description: 'Match words to their translations against the clock.',
    gradient: 'linear-gradient(135deg, #047857, #10b981)',
    edge: '#064e3b',
    href: (col: string) => `/match?collection=${encodeURIComponent(col)}`,
  },
];

export default function RealEnglishDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const set = realEnglishSets.find(s => s.id === id);

  const [progress, setProgress] = useState({ done: 0, total: 0, unlocked: false });

  useEffect(() => {
    if (!set) return;
    setProgress(getSetProgress(set));
  }, [set]);

  if (!set) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-[var(--text-muted)] text-sm">Set not found.</p>
        <button onClick={() => router.back()} className="mt-4 text-xs text-[var(--primary)]">← Back</button>
      </div>
    );
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      {/* Back */}
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-6">
        ← Real English
      </button>

      {/* Header */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0"
            style={{ background: 'var(--primary-bg)' }}>
            🎬
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>
                {set.level}
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">{set.wordCount} words</span>
              {progress.unlocked && (
                <span className="text-[10px] font-bold" style={{ color: '#10b981' }}>🔓 Unlocked</span>
              )}
            </div>
            <h1 className="font-black text-base text-[var(--text)] leading-tight">{set.title}</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{set.source}</p>
            {set.description && (
              <p className="text-xs text-[var(--text-muted)] mt-2 leading-snug">{set.description}</p>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[var(--text-muted)]">
              {progress.unlocked ? 'Completed' : `${progress.done}/${progress.total} words at +7 review`}
            </span>
            <span className="text-[10px] font-bold" style={{ color: 'var(--primary)' }}>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: progress.unlocked ? '#10b981' : 'var(--primary)' }} />
          </div>
        </div>

        {/* Unlock status */}
        {!progress.unlocked && (
          <p className="mt-3 text-[10px] text-[var(--text-muted)] text-center">
            🔒 Complete the +7 day SRS review for all {set.wordCount} words to unlock the video
          </p>
        )}

        {/* Watch button — only when unlocked */}
        {progress.unlocked && (
          <a href={set.youtubeUrl} target="_blank" rel="noopener noreferrer" className="block mt-4">
            <button className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #dc2626, #ef4444)' }}>
              ▶ Watch on YouTube
            </button>
          </a>
        )}
      </div>

      {/* Activity cards */}
      <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Activities</p>
      <div className="grid grid-cols-2 gap-3">
        {ACTIVITY_CARDS.map(card => (
          <Link key={card.key} href={card.href(set.collectionName)}>
            <div className="rounded-2xl p-4 flex flex-col gap-2 cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: card.gradient,
                boxShadow: `0 4px 20px ${card.edge}55`,
              }}>
              <span className="text-2xl">{card.icon}</span>
              <div>
                <p className="font-black text-sm text-white">{card.label}</p>
                <p className="text-[10px] text-white/70 mt-0.5 leading-snug">{card.description}</p>
              </div>
              <p className="text-[10px] font-bold text-white/60 mt-1">{set.wordCount} words</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
