'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { realEnglishSets } from "@/lib/real-english-data";
import { loadRealEnglishCollection } from '@/lib/data';
import { getUnitProgress } from '@/lib/storage';
import type { WordCollection, UnitProgress } from '@/lib/types';

const CARD_COLORS = [
  '#5B8AF0','#FF6B6B','#06D6A0','#FFD166',
  '#A78BFA','#FF9F43','#F72585','#4ECDC4',
];

interface UnitRow {
  dayNumber: number;
  topic: string;
  wordCount: number;
  progress: UnitProgress;
}

function ModeButton({ href, icon, label, done, locked = false }: {
  href: string; icon: string; label: string; done: boolean; locked?: boolean;
}) {
  if (locked) {
    return (
      <div className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl opacity-40 cursor-not-allowed select-none"
        style={{ background: 'var(--surface-2)' }}>
        <span className="text-sm">🔒</span>
        <span className="text-[10px] font-semibold text-[var(--text-muted)]">{label}</span>
      </div>
    );
  }
  return (
    <Link href={href}
      className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all hover:opacity-80 active:scale-95"
      style={{ background: done ? 'rgba(34,197,94,0.12)' : 'var(--surface-2)' }}>
      <span className="text-sm">{done ? '✅' : icon}</span>
      <span className="text-[10px] font-semibold"
        style={{ color: done ? '#16a34a' : 'var(--text-muted)' }}>{label}</span>
    </Link>
  );
}

function UnitCard({ unit, collectionName, accentColor }: {
  unit: UnitRow; collectionName: string; accentColor: string;
}) {
  const enc = encodeURIComponent(collectionName);
  const learnUrl = `/learn?collection=${enc}&day=${unit.dayNumber}`;
  const flashUrl = `/flashcards?collection=${enc}&day=${unit.dayNumber}`;
  const quizUrl  = `/quiz?collection=${enc}&day=${unit.dayNumber}`;
  const matchUrl = `/matching?collection=${enc}&day=${unit.dayNumber}`;

  const { learnDone, flashcardDone, quizDone } = unit.progress;
  const allDone = learnDone && flashcardDone && quizDone;
  const pct = Math.round(([learnDone, flashcardDone, quizDone].filter(Boolean).length / 3) * 100);

  return (
    <div className="rounded-2xl overflow-hidden border"
      style={{ borderColor: allDone ? '#86efac' : 'var(--border)', background: 'var(--surface)' }}>
      <div className="h-1" style={{
        background: allDone
          ? 'linear-gradient(90deg,#22c55e,#4ade80)'
          : `linear-gradient(90deg,${accentColor}88,${accentColor})`,
      }} />
      <div className="p-3">
        <div className="flex items-start justify-between gap-1 mb-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5"
              style={{ color: 'var(--text-muted)' }}>Unit {unit.dayNumber}</p>
            <p className="text-xs font-bold leading-snug line-clamp-2"
              style={{ color: allDone ? '#16a34a' : 'var(--text)' }}>{unit.topic}</p>
          </div>
          <span className="text-[10px] whitespace-nowrap shrink-0 mt-0.5"
            style={{ color: 'var(--text-muted)' }}>{unit.wordCount} words</span>
        </div>
        <div className="h-1 rounded-full mb-2 overflow-hidden" style={{ background: 'var(--border)' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: allDone ? '#22c55e' : accentColor }} />
        </div>
        <div className="flex gap-1">
          <ModeButton href={learnUrl} icon="📖" label="Learn"  done={learnDone} />
          <ModeButton href={flashUrl} icon="🃏" label="Cards"  done={flashcardDone} locked={!learnDone} />
          <ModeButton href={quizUrl}  icon="🧠" label="Quiz"   done={quizDone}     locked={!learnDone} />
          <ModeButton href={matchUrl} icon="🔀" label="Match"  done={false}         locked={!learnDone} />
        </div>
      </div>
    </div>
  );
}

export default function RealEnglishVideoPage({ params }: { params: Promise<{ id: string; videoId: string }> }) {
  const { id, videoId } = use(params);
  const router = useRouter();

  const set = realEnglishSets.find(s => s.id === id);
  const video = set?.videos.find(v => v.id === videoId);
  const videoIndex = set?.videos.findIndex(v => v.id === videoId) ?? 0;

  const [collection, setCollection] = useState<WordCollection | null>(null);
  const [units, setUnits] = useState<UnitRow[]>([]);

  useEffect(() => {
    if (!video) return;
    loadRealEnglishCollection(videoId).then(col => {
      if (!col) return;
      setCollection(col);
      setUnits(col.days.map(day => ({
        dayNumber: day.dayNumber,
        topic: day.topic || `Unit ${day.dayNumber}`,
        wordCount: day.words.length,
        progress: getUnitProgress(col.name, day.dayNumber),
      })));
    });
  }, [videoId, video]);

  if (!set || !video) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-[var(--text-muted)] text-sm">Video not found.</p>
        <button onClick={() => router.back()} className="mt-4 text-xs text-[var(--primary)] hover:underline">← Back</button>
      </div>
    );
  }

  const totalWords = collection ? collection.days.reduce((s, d) => s + d.words.length, 0) : 0;
  const accentColor = CARD_COLORS[videoIndex % CARD_COLORS.length];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <button onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-5">
        ← {set.title}
      </button>

      {/* Hero */}
      <div className="rounded-2xl p-5 mb-6 text-white"
        style={{ background: `linear-gradient(135deg, ${accentColor}bb, ${accentColor})` }}>
        <div className="text-2xl mb-2">🎬</div>
        <h1 className="text-xl font-black leading-snug mb-3">{video.title}</h1>
        <div className="flex flex-wrap gap-2">
          {totalWords > 0 && (
            <span className="text-xs font-semibold bg-black/20 rounded-full px-3 py-1">{totalWords} words</span>
          )}
          {video.duration && (
            <span className="text-xs font-semibold bg-black/20 rounded-full px-3 py-1">⏱ {video.duration}</span>
          )}
          {units.length > 0 && (
            <span className="text-xs font-semibold bg-black/20 rounded-full px-3 py-1">{units.length} units</span>
          )}
        </div>
      </div>

      {/* Units */}
      {units.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <span className="text-4xl">📭</span>
          <p className="text-sm font-bold text-[var(--text)] mt-3">Units coming soon</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {units.map(unit => (
            <UnitCard key={unit.dayNumber} unit={unit} collectionName={collection!.name} accentColor={accentColor} />
          ))}
        </div>
      )}
    </div>
  );
}
