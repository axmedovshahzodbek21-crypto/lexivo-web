'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { type RealEnglishVideo } from '@/lib/real-english-data';
import { realEnglishSets } from "@/lib/real-english-data";
import { loadRealEnglishCollection } from '@/lib/data';
import { getSRSWords, getReviewLog } from '@/lib/storage';

const UNLOCK_INTERVAL = 7;

const CARD_COLORS = [
  { color: '#EC4899', light: '#F472B6', dark: '#BE185D' },
  { color: '#8B5CF6', light: '#A78BFA', dark: '#6D28D9' },
  { color: '#06B6D4', light: '#22D3EE', dark: '#0891B2' },
  { color: '#F97316', light: '#FB923C', dark: '#C2410C' },
  { color: '#10B981', light: '#34D399', dark: '#059669' },
  { color: '#EF4444', light: '#F87171', dark: '#B91C1C' },
  { color: '#6366F1', light: '#818CF8', dark: '#4338CA' },
  { color: '#F59E0B', light: '#FCD34D', dark: '#B45309' },
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
  const { color, light, dark } = CARD_COLORS[index % CARD_COLORS.length];
  const numStr = String(index + 1).padStart(2, '0');

  if (wordCount === 0) {
    return (
      <div style={{
        borderRadius: 18, padding: '14px 12px', minHeight: 120,
        background: 'var(--surface)', border: '1.5px solid var(--border)',
        opacity: 0.38, display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: 4, bottom: -4, fontSize: 52,
          opacity: 0.08, lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
        }}>{numStr}</div>
        <span style={{ fontSize: 20 }}>⏳</span>
        <div>
          <p style={{ fontSize: 11, fontWeight: 900, color: 'var(--text)', lineHeight: 1.2 }}>{video.title}</p>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>Coming soon</p>
        </div>
      </div>
    );
  }

  const gradBg = unlocked
    ? 'linear-gradient(135deg, #34D399, #10B981, #059669)'
    : `linear-gradient(135deg, ${light}, ${color}, ${dark})`;
  const shadow = unlocked
    ? '0 4px 0 #059669, 0 8px 20px #10B98155'
    : `0 4px 0 ${dark}, 0 8px 20px ${color}55`;

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: 18, background: gradBg, boxShadow: shadow,
        padding: '14px 12px', minHeight: 120,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        cursor: 'pointer', textAlign: 'left', width: '100%', border: 'none',
        transition: 'transform 0.15s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {/* Watermark number */}
      <div style={{
        position: 'absolute', right: 4, bottom: -4, fontSize: 52,
        color: 'rgba(255,255,255,0.08)', fontWeight: 900,
        lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
      }}>{numStr}</div>

      {/* Status icon */}
      <span style={{ fontSize: 20, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
        {unlocked ? '🔓' : '▶'}
      </span>

      {/* Info */}
      <div>
        <p style={{
          fontSize: 12, fontWeight: 900, color: '#fff',
          lineHeight: 1.25, marginBottom: 7,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
          textShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}>{video.title}</p>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
            background: 'rgba(0,0,0,0.22)', borderRadius: 6, padding: '2px 7px',
          }}>{wordCount} words</span>
          {video.duration && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)',
              background: 'rgba(0,0,0,0.15)', borderRadius: 6, padding: '2px 7px',
            }}>{video.duration}</span>
          )}
          {unlocked && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>✓ Unlocked</span>
          )}
        </div>
      </div>
    </button>
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
      // Each video's count is caught individually — one malformed/missing
      // collection used to reject the whole Promise.all (an unhandled
      // rejection, since load() isn't awaited or .catch()'d by anyone),
      // which meant setWordCounts never ran and every video on the page
      // stayed stuck showing "Coming soon" forever, not just the bad one.
      await Promise.all(set!.videos.map(async v => {
        try {
          const col = await loadRealEnglishCollection(v.id);
          counts[v.id] = col ? col.days.reduce((s, d) => s + d.words.length, 0) : 0;
        } catch (err) {
          console.error(`[real-english] failed to load word count for ${v.id}`, err);
          counts[v.id] = 0;
        }
      }));
      setWordCounts(counts);
    }
    load();
  }, [set]);

  if (!set) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Set not found.</p>
        <BackButton className="mt-4" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      {/* Back */}
      <button
        onClick={() => router.back()}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 24 }}
      >
        ← Real English
      </button>

      {/* Editorial header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>
          Video Set · {set.videos.length} episodes
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--text)', lineHeight: 1.1 }}>{set.title}</h1>
      </div>

      {/* Video grid */}
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
