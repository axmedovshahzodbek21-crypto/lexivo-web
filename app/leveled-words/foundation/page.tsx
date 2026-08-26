'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';

const LEVELS = [
  {
    name: 'A1',
    label: 'Beginner',
    emoji: '🌱',
    color: '#2ECC71',
    desc: 'Basic everyday words and phrases',
    gradient: 'linear-gradient(135deg, #1a9a50, #2ECC71)',
    edge: '#0f6634',
    glow: 'rgba(46,204,113,0.4)',
  },
  {
    name: 'A2',
    label: 'Elementary',
    emoji: '📗',
    color: '#27AE60',
    desc: 'Common vocabulary for simple situations',
    gradient: 'linear-gradient(135deg, #15803d, #27AE60)',
    edge: '#14532d',
    glow: 'rgba(39,174,96,0.4)',
  },
  {
    name: 'B1',
    label: 'Intermediate',
    emoji: '📘',
    color: '#3498DB',
    desc: 'Everyday topics and familiar situations',
    gradient: 'linear-gradient(135deg, #1d4ed8, #3498DB)',
    edge: '#1e3a8a',
    glow: 'rgba(52,152,219,0.4)',
  },
];

export default function FoundationPage() {
  const router = useRouter();
  const { collections } = useAppStore();

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button
          onClick={() => router.back()}
          className="btn-icon text-lg"
          aria-label="Go back"
        >
          ←
        </button>
        <h1 className="font-bold text-[var(--text)]">🌱 Foundation</h1>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {LEVELS.map(level => {
          const col = collections.find(c => c.name === level.name);
          const unitCount = col?.days.length;
          const wordCount = col ? col.days.reduce((a, d) => a + d.words.length, 0) : null;

          return (
            <Link
              key={level.name}
              href={`/collections/${encodeURIComponent(level.name)}`}
              className="group relative rounded-3xl p-5 flex flex-col justify-between min-h-[168px] transition-all duration-200 hover:-translate-y-1"
              style={{
                background: level.gradient,
                boxShadow: `0 10px 0 ${level.edge}, 0 18px 40px ${level.glow}`,
                textShadow: '0 1px 3px rgba(0,0,0,0.35)',
              }}
            >
              <div className="flex items-start justify-between">
                <span className="text-4xl" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }}>{level.emoji}</span>
                <span className="text-xs font-black px-2 py-1 rounded-full text-white" style={{ background: 'rgba(0,0,0,0.25)' }}>
                  {level.name}
                </span>
              </div>
              <div>
                <div className="text-xl font-black text-white leading-tight">{level.label}</div>
                <div className="text-xs text-white/80 mt-1">{level.desc}</div>
                {unitCount != null && wordCount != null && (
                  <div className="text-[11px] font-bold text-white/70 mt-2">
                    {unitCount} units · {wordCount} words
                  </div>
                )}
              </div>
              <span className="absolute bottom-5 right-5 text-lg font-black text-white opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
