'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { realEnglishSets, type RealEnglishSet } from '@/lib/real-english-data';
import { getSRSWords, getReviewLog } from '@/lib/storage';
import { loadRealEnglishCollection } from '@/lib/data';

const UNLOCK_INTERVAL = 7;

const CARD_COLORS = [
  '#5B8AF0','#FF6B6B','#06D6A0','#FFD166',
  '#A78BFA','#FF9F43','#F72585','#4ECDC4',
  '#3D8BFF','#FF5E57','#00C9A7','#FFC75F',
];
const darken = (hex: string, amt = 0.45) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r*(1-amt))},${Math.round(g*(1-amt))},${Math.round(b*(1-amt))})`;
};
const lighten = (hex: string, amt = 0.3) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r+(255-r)*amt)},${Math.round(g+(255-g)*amt)},${Math.round(b+(255-b)*amt)})`;
};

function getSetUnlocked(set: RealEnglishSet, totalWords: number): { done: number; unlocked: boolean } {
  if (totalWords === 0) return { done: 0, unlocked: false };
  const srsWords = getSRSWords();
  const log = getReviewLog();
  const setWords = srsWords.filter(w => w.collectionName === set.collectionName);
  const done = setWords.filter(w => (log[w.id] ?? []).includes(UNLOCK_INTERVAL)).length;
  const unlocked = setWords.length >= totalWords && done >= totalWords;
  return { done, unlocked };
}

function SetCard({ set, index, wordCount, onClick }: {
  set: RealEnglishSet;
  index: number;
  wordCount: number;
  onClick: () => void;
}) {
  const { done, unlocked } = getSetUnlocked(set, wordCount);
  const pct = wordCount > 0 ? Math.round((done / wordCount) * 100) : 0;
  const color = CARD_COLORS[index % CARD_COLORS.length];

  return (
    <div
      onClick={onClick}
      className="rounded-2xl cursor-pointer hover:-translate-y-1 transition-all duration-200 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${lighten(color)}, ${color})`,
        boxShadow: `0 12px 0 ${darken(color)}, 0 16px 32px ${color}99`,
        minHeight: '140px',
      }}
    >
      {/* Top area */}
      <div className="p-4 text-2xl">{unlocked ? '🔓' : '🎬'}</div>

      {/* Progress bar */}
      {done > 0 && !unlocked && wordCount > 0 && (
        <div className="absolute top-3 right-3 w-16">
          <div className="h-1 rounded-full bg-white/30 overflow-hidden">
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-white/70 text-[9px] text-right mt-0.5">{pct}%</p>
        </div>
      )}

      {/* Label */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3"
        style={{ background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(8px)' }}>
        <p className="text-white font-bold text-sm leading-tight line-clamp-2"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{set.title}</p>
        <div className="flex items-center gap-2 mt-1">
          {wordCount > 0 && (
            <span className="text-white/60 text-[10px]">{wordCount} words</span>
          )}
          {set.duration && wordCount > 0 && <span className="text-white/40 text-[10px]">·</span>}
          {set.duration && (
            <span className="text-white/60 text-[10px]">{set.duration}</span>
          )}
        </div>
      </div>
    </div>
  );
}

type Tab = 'sets' | 'unlocked';

export default function RealEnglishPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('sets');
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadCounts() {
      const counts: Record<string, number> = {};
      await Promise.all(realEnglishSets.map(async set => {
        const col = await loadRealEnglishCollection(set.id);
        counts[set.id] = col ? col.days.reduce((s, d) => s + d.words.length, 0) : 0;
      }));
      setWordCounts(counts);
    }
    loadCounts();
  }, []);

  const unlockedSets = realEnglishSets.filter(s => getSetUnlocked(s, wordCounts[s.id] ?? 0).unlocked);
  const lockedSets   = realEnglishSets.filter(s => !getSetUnlocked(s, wordCounts[s.id] ?? 0).unlocked);

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
        <section>
          {lockedSets.length === 0 && unlockedSets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 flex flex-col items-center justify-center text-center gap-3">
              <span className="text-4xl">🎬</span>
              <p className="text-sm font-bold text-[var(--text)]">No sets yet</p>
              <p className="text-xs text-[var(--text-muted)]">Video sets are coming soon.</p>
            </div>
          ) : lockedSets.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">All sets unlocked — you&apos;re on fire! 🔥</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {lockedSets.map((set, i) => (
                <SetCard key={set.id} set={set} index={i} wordCount={wordCounts[set.id] ?? 0}
                  onClick={() => router.push(`/real-english/${set.id}`)} />
              ))}
            </div>
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
        <section>
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
            <div className="grid grid-cols-2 gap-3">
              {unlockedSets.map((set, i) => (
                <SetCard key={set.id} set={set} index={i} wordCount={wordCounts[set.id] ?? 0}
                  onClick={() => router.push(`/real-english/${set.id}`)} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
