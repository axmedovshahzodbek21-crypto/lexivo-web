'use client';
import { use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UNIT_SLUGS, getSubUnits } from '@/lib/structures-data';
import { getStructuresSRS } from '@/lib/storage';

// Day-tile grid mirroring components/UnitPicker.tsx's UnitList — same
// gradient-tile treatment, watermark day number, and ✅/🏆 status, so picking
// a "day" of ~5 structures feels like the same ritual as picking a
// vocabulary day. Unlike vocab, Learn has no Flashcards/Quiz prerequisite to
// inherit, so there's no lock state here.
const UNIT_COLORS = [
  { color: '#6366F1', light: '#818CF8', dark: '#4338CA' },
  { color: '#F97316', light: '#FB923C', dark: '#C2410C' },
  { color: '#10B981', light: '#34D399', dark: '#059669' },
  { color: '#EC4899', light: '#F472B6', dark: '#BE185D' },
  { color: '#8B5CF6', light: '#A78BFA', dark: '#6D28D9' },
  { color: '#06B6D4', light: '#22D3EE', dark: '#0891B2' },
  { color: '#EAB308', light: '#FDE047', dark: '#A16207' },
  { color: '#EF4444', light: '#F87171', dark: '#B91C1C' },
];

export default function UnitDayPickerPage({ params }: { params: Promise<{ unit: string }> }) {
  const { unit: slug } = use(params);
  const router = useRouter();
  const unit = UNIT_SLUGS[slug];

  const learnedIds = useMemo(() => new Set(getStructuresSRS().map(s => s.id)), []);
  const days = useMemo(() => unit ? getSubUnits(unit) : [], [unit]);

  if (!unit) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-screen">
        <p className="text-[var(--text-muted)] mb-4">Unknown unit.</p>
        <Link href="/structures" className="btn-primary inline-block">Back to Structures</Link>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 animate-fade-in">
      <div className="flex items-center gap-3 pt-2 mb-5">
        <button onClick={() => router.push(`/structures/${slug}`)} className="btn-icon" aria-label="Go back">←</button>
        <div className="min-w-0">
          <p className="text-xs text-[var(--text-muted)] truncate">{unit}</p>
          <h1 className="text-lg font-bold text-[var(--text)] leading-tight">🔎 Pick a day to learn</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {days.map(({ day, structures }, i) => {
          const done = structures.every(s => learnedIds.has(s.id));
          const numStr = String(day).padStart(2, '0');
          const { color, light, dark } = UNIT_COLORS[i % UNIT_COLORS.length];
          const gradBg = done
            ? 'linear-gradient(135deg, #34D399, #10B981, #059669)'
            : `linear-gradient(135deg, ${light}, ${color}, ${dark})`;
          const shadow = done
            ? '0 4px 0 #059669, 0 8px 20px #10B98155'
            : `0 4px 0 ${dark}, 0 8px 20px ${color}55`;

          return (
            <Link
              key={day}
              href={`/structures/${slug}/learn/${day}`}
              style={{
                display: 'block',
                position: 'relative',
                borderRadius: 20,
                overflow: 'hidden',
                background: gradBg,
                boxShadow: shadow,
                padding: '16px 14px',
                minHeight: 130,
                textDecoration: 'none',
              }}
            >
              <div style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                fontSize: 68, fontWeight: 900, color: 'rgba(255,255,255,0.07)', lineHeight: 1,
                userSelect: 'none', pointerEvents: 'none',
              }}>{numStr}</div>

              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 20, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                  {done ? '✅' : '🔎'}
                </span>
                <div style={{ marginTop: 10 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                    Day {day}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.22)', borderRadius: 6, padding: '2px 8px' }}>
                      {structures.length} structures
                    </span>
                    {done && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.95)', fontWeight: 900 }}>✓</span>}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
