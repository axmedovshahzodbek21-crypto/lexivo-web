'use client';
import { useRouter } from 'next/navigation';
import { realEnglishSets } from "@/lib/real-english-data";

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

const STEPS = [
  { icon: '📖', text: 'Learn the words from a real video',          color: '#EC4899', dark: '#BE185D' },
  { icon: '🔄', text: 'Review them with SRS over ~11 days',         color: '#8B5CF6', dark: '#6D28D9' },
  { icon: '🔓', text: 'Complete the +7 day review → link unlocks', color: '#F59E0B', dark: '#B45309' },
  { icon: '🎬', text: 'Watch the video and understand every word',  color: '#10B981', dark: '#059669' },
];

export default function RealEnglishPage() {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">

      {/* Editorial header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>
          Listening Skills
        </p>
        <h1 style={{ fontSize: 40, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>Real English</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
          Learn the words from a real video — then unlock it and actually understand it.
        </p>
      </div>

      {/* Collection cards */}
      {realEnglishSets.length === 0 ? (
        <div style={{
          borderRadius: 20, border: '2px dashed var(--border)',
          background: 'var(--surface)', padding: '48px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', textAlign: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 48 }}>🎬</span>
          <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>No sets yet</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Video sets are coming soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-8">
          {realEnglishSets.map((set, i) => {
            const { color, light, dark } = CARD_COLORS[i % CARD_COLORS.length];
            return (
              <button
                key={set.id}
                onClick={() => router.push(`/real-english/${set.id}`)}
                style={{
                  position: 'relative', overflow: 'hidden',
                  borderRadius: 20,
                  background: `linear-gradient(135deg, ${light}, ${color}, ${dark})`,
                  boxShadow: `0 4px 0 ${dark}, 0 8px 20px ${color}55`,
                  padding: '16px 14px', minHeight: 160,
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  border: 'none', transition: 'transform 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                {/* Watermark */}
                <div style={{
                  position: 'absolute', right: 4, bottom: -8, fontSize: 72,
                  opacity: 0.08, lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
                }}>🎬</div>

                {/* Play circle */}
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, color: '#fff',
                }}>▶</div>

                {/* Title + count */}
                <div>
                  <p style={{
                    fontSize: 13, fontWeight: 900, color: '#fff',
                    lineHeight: 1.3, marginBottom: 8,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }}>{set.title}</p>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
                    background: 'rgba(0,0,0,0.22)', borderRadius: 6, padding: '2px 8px',
                  }}>{set.videos.length} videos</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* How It Works — numbered timeline */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 20 }}>
          How It Works
        </p>

        <div style={{ position: 'relative' }}>
          {/* Connecting line */}
          <div style={{
            position: 'absolute', left: 13, top: 14, bottom: 14,
            width: 2,
            background: 'linear-gradient(to bottom, #EC4899, #10B98144)',
            zIndex: 0,
          }} />

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {STEPS.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', paddingBottom: i < STEPS.length - 1 ? 22 : 0, position: 'relative', zIndex: 1 }}>
                {/* Colored circle */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${step.color}, ${step.dark})`,
                  boxShadow: `0 3px 0 ${step.dark}, 0 4px 12px ${step.color}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13,
                }}>{step.icon}</div>

                {/* Step text */}
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5, paddingTop: 4 }}>
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
