'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { realEnglishSets, type RealEnglishSet } from '@/lib/real-english-data';
import { getSRSWords, getReviewLog } from '@/lib/storage';

const UNLOCK_INTERVAL = 7; // +7 day SRS review completes the unlock

function getSetProgress(set: RealEnglishSet): { done: number; total: number; unlocked: boolean } {
  const srsWords = getSRSWords();
  const log = getReviewLog();
  const setWords = srsWords.filter(w => w.collectionName === set.collectionName);
  const total = set.wordCount;
  const done = setWords.filter(w => {
    const completed = log[w.id] ?? [];
    return completed.includes(UNLOCK_INTERVAL);
  }).length;
  const unlocked = setWords.length >= total && done >= total;
  return { done, total, unlocked };
}

function LevelBadge({ level }: { level: string }) {
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>
      {level}
    </span>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[var(--text-muted)]">{done}/{total} words at +7</span>
        <span className="text-[10px] font-bold" style={{ color: 'var(--primary)' }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'var(--primary)' }} />
      </div>
    </div>
  );
}

function UnlockedCard({ set }: { set: RealEnglishSet }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold" style={{ color: '#10b981' }}>🔓 Unlocked</span>
            <LevelBadge level={set.level} />
          </div>
          <p className="font-black text-sm text-[var(--text)] leading-tight">{set.title}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{set.source}</p>
          {set.description && (
            <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-snug">{set.description}</p>
          )}
        </div>
        <div className="text-3xl shrink-0">🎬</div>
      </div>
      <div className="flex gap-2">
        <a href={set.youtubeUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
          <button className="w-full py-2 rounded-xl text-xs font-bold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #dc2626, #ef4444)' }}>
            ▶ Watch on YouTube
          </button>
        </a>
        <Link href={`/flashcards?collection=${encodeURIComponent(set.collectionName)}`} className="flex-1">
          <button className="w-full py-2 rounded-xl text-xs font-bold border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">
            🃏 Flashcards
          </button>
        </Link>
      </div>
    </div>
  );
}

function SetCard({ set }: { set: RealEnglishSet }) {
  const [progress, setProgress] = useState({ done: 0, total: set.wordCount, unlocked: false });

  useEffect(() => {
    setProgress(getSetProgress(set));
  }, [set]);

  const started = progress.done > 0;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <LevelBadge level={set.level} />
            <span className="text-[10px] text-[var(--text-muted)]">{set.wordCount} words</span>
          </div>
          <p className="font-black text-sm text-[var(--text)] leading-tight">{set.title}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{set.source}</p>
          {set.description && (
            <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-snug">{set.description}</p>
          )}
        </div>
        <div className="text-2xl shrink-0 opacity-40">🔒</div>
      </div>

      {started && <ProgressBar done={progress.done} total={progress.total} />}

      <Link href={`/learn?collection=${encodeURIComponent(set.collectionName)}`}>
        <button className="w-full py-2 rounded-xl text-xs font-bold text-white transition-all"
          style={{ background: 'var(--primary)' }}>
          {started ? '→ Continue Learning' : '→ Start Learning'}
        </button>
      </Link>
    </div>
  );
}

export default function RealEnglishPage() {
  const [unlockedSets, setUnlockedSets] = useState<RealEnglishSet[]>([]);
  const [lockedSets, setLockedSets] = useState<RealEnglishSet[]>([]);

  useEffect(() => {
    const unlocked: RealEnglishSet[] = [];
    const locked: RealEnglishSet[] = [];
    for (const set of realEnglishSets) {
      if (getSetProgress(set).unlocked) unlocked.push(set);
      else locked.push(set);
    }
    setUnlockedSets(unlocked);
    setLockedSets(locked);
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Listening Skills</p>
        <h1 className="text-2xl font-black text-[var(--text)]">🗣️ Real English</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Learn the words from a real video — then unlock it and actually understand it.
        </p>
      </div>

      {/* Unlocked videos */}
      <section className="mb-8">
        <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          🎬 My Unlocked Videos
        </h2>
        {unlockedSets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 flex flex-col items-center justify-center text-center gap-2">
            <span className="text-3xl">🔒</span>
            <p className="text-sm font-bold text-[var(--text)]">No unlocked videos yet</p>
            <p className="text-xs text-[var(--text-muted)]">Learn all the words in a set and complete your SRS reviews — the YouTube link unlocks automatically.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {unlockedSets.map(set => (
              <UnlockedCard key={set.id} set={set} />
            ))}
          </div>
        )}
      </section>

      {/* Available sets */}
      <section>
        <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          📚 Video Sets
        </h2>
        {lockedSets.length === 0 && unlockedSets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 flex flex-col items-center justify-center text-center gap-3">
            <span className="text-4xl">🎬</span>
            <p className="text-sm font-bold text-[var(--text)]">No sets yet</p>
            <p className="text-xs text-[var(--text-muted)]">Interview vocab sets are coming soon.</p>
          </div>
        ) : lockedSets.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-4">
            All sets unlocked — you&apos;re on fire! 🔥
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {lockedSets.map(set => (
              <SetCard key={set.id} set={set} />
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">How it works</p>
        <div className="flex flex-col gap-2.5">
          {[
            ['📖', 'Learn the words from a real video'],
            ['🔄', 'Review them with SRS over ~11 days'],
            ['🔓', 'Complete the +7 day review → link unlocks'],
            ['🎬', 'Watch the video and understand every word'],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-3">
              <span className="text-lg">{icon}</span>
              <span className="text-xs text-[var(--text-muted)]">{text}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
