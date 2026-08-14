'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { realEnglishSets, type RealEnglishSet } from '@/lib/real-english-data';
import { getSRSWords, getReviewLog } from '@/lib/storage';

const UNLOCK_INTERVAL = 7;

function getSetProgress(set: RealEnglishSet): { done: number; total: number; unlocked: boolean } {
  const srsWords = getSRSWords();
  const log = getReviewLog();
  const setWords = srsWords.filter(w => w.collectionName === set.collectionName);
  const total = set.wordCount;
  const done = setWords.filter(w => (log[w.id] ?? []).includes(UNLOCK_INTERVAL)).length;
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

function SetCard({ set, onClick }: { set: RealEnglishSet; onClick: () => void }) {
  const [progress, setProgress] = useState({ done: 0, total: set.wordCount, unlocked: false });

  useEffect(() => {
    setProgress(getSetProgress(set));
  }, [set]);

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const started = progress.done > 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center gap-4 hover:border-[var(--primary)] transition-all group"
    >
      {/* Icon */}
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl"
        style={{ background: 'var(--primary-bg)' }}>
        {progress.unlocked ? '🔓' : '🎬'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <LevelBadge level={set.level} />
          <span className="text-[10px] text-[var(--text-muted)]">{set.wordCount} words</span>
          {progress.unlocked && (
            <span className="text-[10px] font-bold" style={{ color: '#10b981' }}>Unlocked</span>
          )}
        </div>
        <p className="font-black text-sm text-[var(--text)] leading-tight truncate">{set.title}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{set.source}</p>

        {started && !progress.unlocked && (
          <div className="mt-2 h-1 rounded-full bg-[var(--border)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--primary)' }} />
          </div>
        )}
      </div>

      {/* Arrow */}
      <span className="text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors shrink-0">›</span>
    </button>
  );
}

type Tab = 'sets' | 'unlocked';

export default function RealEnglishPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('sets');
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
      <div className="mb-6">
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Listening Skills</p>
        <h1 className="text-2xl font-black text-[var(--text)]">🗣️ Real English</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Learn the words from a real video — then unlock it and actually understand it.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] mb-6">
        {(['sets', 'unlocked'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            style={tab === t ? {
              background: 'var(--primary)',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(108,99,255,0.35)',
            } : { color: 'var(--text-muted)' }}
          >
            {t === 'sets' ? '📚 Video Sets' : '🎬 My Unlocked Videos'}
            {t === 'unlocked' && unlockedSets.length > 0 && (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: tab === 'unlocked' ? 'rgba(255,255,255,0.25)' : 'var(--primary-bg)', color: tab === 'unlocked' ? '#fff' : 'var(--primary)' }}>
                {unlockedSets.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Video Sets tab */}
      {tab === 'sets' && (
        <section className="flex flex-col gap-3">
          {lockedSets.length === 0 && unlockedSets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 flex flex-col items-center justify-center text-center gap-3">
              <span className="text-4xl">🎬</span>
              <p className="text-sm font-bold text-[var(--text)]">No sets yet</p>
              <p className="text-xs text-[var(--text-muted)]">Interview vocab sets are coming soon.</p>
            </div>
          ) : lockedSets.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">All sets unlocked — you&apos;re on fire! 🔥</p>
          ) : (
            lockedSets.map(set => (
              <SetCard key={set.id} set={set} onClick={() => router.push(`/real-english/${set.id}`)} />
            ))
          )}

          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
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
          </div>
        </section>
      )}

      {/* My Unlocked Videos tab */}
      {tab === 'unlocked' && (
        <section className="flex flex-col gap-3">
          {unlockedSets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 flex flex-col items-center justify-center text-center gap-3">
              <span className="text-4xl">🔒</span>
              <p className="text-sm font-bold text-[var(--text)]">No unlocked videos yet</p>
              <p className="text-xs text-[var(--text-muted)] max-w-xs">
                Learn all the words in a set and complete your SRS reviews — the YouTube link unlocks automatically.
              </p>
              <button onClick={() => setTab('sets')}
                className="mt-1 px-4 py-2 rounded-xl text-xs font-bold text-white"
                style={{ background: 'var(--primary)' }}>
                → Browse Video Sets
              </button>
            </div>
          ) : (
            unlockedSets.map(set => (
              <SetCard key={set.id} set={set} onClick={() => router.push(`/real-english/${set.id}`)} />
            ))
          )}
        </section>
      )}
    </div>
  );
}
