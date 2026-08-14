'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type RealEnglishVideo } from '@/lib/real-english-data';
import { realEnglishSets } from "@/lib/real-english-data";
import { loadRealEnglishCollection } from '@/lib/data';
import { getSRSWords, getReviewLog } from '@/lib/storage';

const UNLOCK_INTERVAL = 7;

const CARD_COLORS = [
  '#5B8AF0','#FF6B6B','#06D6A0','#FFD166',
  '#A78BFA','#FF9F43','#F72585','#4ECDC4',
  '#3D8BFF','#FF5E57','#00C9A7','#FFC75F',
];

function getVideoUnlocked(collectionName: string, wordCount: number) {
  if (wordCount === 0) return false;
  const srsWords = getSRSWords();
  const log = getReviewLog();
  const words = srsWords.filter(w => w.collectionName === collectionName);
  const done = words.filter(w => (log[w.id] ?? []).includes(UNLOCK_INTERVAL)).length;
  return words.length >= wordCount && done >= wordCount;
}

function VideoCard({ video, index, wordCount, onClick }: {
  video: RealEnglishVideo;
  index: number;
  wordCount: number;
  onClick: () => void;
}) {
  const unlocked = getVideoUnlocked(video.collectionName, wordCount);
  const color = CARD_COLORS[index % CARD_COLORS.length];

  return (
    <div
      onClick={onClick}
      className="rounded-2xl border cursor-pointer hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
      style={{ borderColor: unlocked ? '#86efac' : 'var(--border)', background: 'var(--surface)' }}
    >
      {/* Color accent strip */}
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-black text-sm text-[var(--text)]">{video.title}</p>
          {unlocked && <span className="text-sm">🔓</span>}
        </div>
        <div className="flex items-center gap-2 mt-2">
          {wordCount > 0 ? (
            <span className="text-xs text-[var(--text-muted)]">{wordCount} words</span>
          ) : (
            <span className="text-xs text-[var(--text-muted)] italic">No words yet</span>
          )}
          {video.duration && wordCount > 0 && (
            <>
              <span className="text-[var(--border)] text-xs">·</span>
              <span className="text-xs text-[var(--text-muted)]">{video.duration}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RealEnglishSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const set = realEnglishSets.find(s => s.id === id);
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!set) return;
    async function load() {
      const counts: Record<string, number> = {};
      await Promise.all(set!.videos.map(async v => {
        const col = await loadRealEnglishCollection(v.id);
        counts[v.id] = col ? col.days.reduce((s, d) => s + d.words.length, 0) : 0;
      }));
      setWordCounts(counts);
    }
    load();
  }, [set]);

  if (!set) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-[var(--text-muted)] text-sm">Set not found.</p>
        <button onClick={() => router.back()} className="mt-4 text-xs text-[var(--primary)] hover:underline">← Back</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-5">
        ← Real English
      </button>

      <div className="mb-6">
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Video Set</p>
        <h1 className="text-xl font-black text-[var(--text)] leading-snug">{set.title}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {set.videos.map((video, i) => (
          <VideoCard
            key={video.id}
            video={video}
            index={i}
            wordCount={wordCounts[video.id] ?? 0}
            onClick={() => router.push(`/real-english/${id}/${video.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
