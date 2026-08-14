'use client';
import Link from 'next/link';
import { useState } from 'react';

const PASSAGES = [
  {
    id: 1, num: '01',
    color: '#6366F1', light: '#818CF8', dark: '#4338CA',
    description: 'Varied question types and academic texts',
    tests: 30,
  },
  {
    id: 2, num: '02',
    color: '#F97316', light: '#FB923C', dark: '#C2410C',
    description: 'Complex texts and nuanced comprehension',
    tests: 30,
  },
  {
    id: 3, num: '03',
    color: '#10B981', light: '#34D399', dark: '#059669',
    description: 'Advanced vocabulary and abstract reasoning',
    tests: 30,
  },
];

function PassageCard({ passage, isHero }: { passage: typeof PASSAGES[0]; isHero?: boolean }) {
  const [flipped, setFlipped] = useState(false);
  const { id, num, color, light, dark, description, tests } = passage;

  const height = isHero ? 220 : 160;

  return (
    <div
      style={{ perspective: '1200px', height, cursor: 'pointer' }}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
      onClick={() => setFlipped(f => !f)}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front */}
        <div
          style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: 20,
            overflow: 'hidden',
            background: `linear-gradient(135deg, ${light}, ${color}, ${dark})`,
            boxShadow: `0 8px 24px ${color}55, 0 2px 8px rgba(0,0,0,0.3)`,
            border: `3px solid ${dark}`,
            padding: isHero ? '28px 32px' : '20px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Watermark number */}
          <div
            style={{
              position: 'absolute',
              right: isHero ? 24 : 12,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: isHero ? 140 : 90,
              fontWeight: 900,
              color: 'rgba(255,255,255,0.07)',
              lineHeight: 1,
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            {num}
          </div>

          <div>
            <p style={{
              fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.65)',
              textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8,
            }}>
              IELTS Reading
            </p>
            <p style={{
              fontSize: isHero ? 38 : 24, fontWeight: 900,
              color: '#fff', lineHeight: 1.1,
            }}>
              Passage {id}
            </p>
            {isHero && (
              <p style={{
                fontSize: 13, color: 'rgba(255,255,255,0.7)',
                marginTop: 8, maxWidth: 260, lineHeight: 1.5,
              }}>
                {description}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
              background: 'rgba(0,0,0,0.2)', borderRadius: 8,
              padding: '4px 10px',
            }}>
              {tests} tests
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              hover to begin →
            </span>
          </div>
        </div>

        {/* Back */}
        <div
          style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: 20,
            background: `linear-gradient(135deg, ${light}33, ${color}22)`,
            border: `2px solid ${color}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
          }}
        >
          <p style={{ fontSize: isHero ? 22 : 16, fontWeight: 900, color: 'var(--text)' }}>
            Passage {id}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 200 }}>
            {description}
          </p>
          <Link href={`/ielts-reading/${id}`} onClick={e => e.stopPropagation()}>
            <button
              style={{
                padding: '10px 28px', borderRadius: 14,
                fontSize: 13, fontWeight: 800,
                background: color, color: '#fff', border: 'none',
                cursor: 'pointer',
                boxShadow: `0 4px 16px ${color}66`,
              }}
            >
              Begin →
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function IeltsReadingPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <div className="mb-10">
        <p style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>
          Practice
        </p>
        <h1 style={{ fontSize: 40, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>
          IELTS Reading
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
          Choose a passage to begin. Each section has 30 practice tests.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Hero card */}
        <PassageCard passage={PASSAGES[0]} isHero />

        {/* Smaller cards row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <PassageCard passage={PASSAGES[1]} />
          <PassageCard passage={PASSAGES[2]} />
        </div>
      </div>
    </div>
  );
}
