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
  },
  {
    name: 'A2',
    label: 'Elementary',
    emoji: '📗',
    color: '#27AE60',
    desc: 'Common vocabulary for simple situations',
  },
  {
    name: 'B1',
    label: 'Intermediate',
    emoji: '📘',
    color: '#3498DB',
    desc: 'Everyday topics and familiar situations',
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
          className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg"
        >
          ←
        </button>
        <h1 className="font-bold text-[var(--text)]">🌱 Foundation</h1>
      </div>

      <div className="p-4 space-y-3">
        {LEVELS.map(level => {
          const col = collections.find(c => c.name === level.name);
          const unitCount = col?.days.length;
          const wordCount = col ? col.days.reduce((a, d) => a + d.words.length, 0) : null;

          return (
            <Link
              key={level.name}
              href={`/collections/${encodeURIComponent(level.name)}`}
              className="flex items-center gap-4 p-5 rounded-2xl bg-[var(--card)] border-2 cursor-pointer hover:opacity-90 transition-opacity"
              style={{
                borderColor: `${level.color}50`,
                boxShadow: `0 4px 14px ${level.color}22`,
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{ background: `${level.color}18` }}
              >
                {level.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold" style={{ color: level.color }}>{level.name}</span>
                  <span className="text-sm font-medium text-[var(--text)]">· {level.label}</span>
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{level.desc}</div>
                {unitCount != null && wordCount != null && (
                  <div className="text-xs font-semibold mt-1" style={{ color: level.color }}>
                    {unitCount} units · {wordCount} words
                  </div>
                )}
              </div>
              <span className="flex-shrink-0 text-sm font-semibold" style={{ color: level.color }}>→</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
