'use client';
import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';

const LEVEL_META: Record<string, { icon: string; color: string; bg: string }> = {
  'Beginner':            { icon: '🌱', color: 'var(--success)', bg: '#d1fae5' },
  'Elementary':          { icon: '📗', color: '#3B82F6', bg: '#dbeafe' },
  'Intermediate':        { icon: '⭐', color: '#8B5CF6', bg: '#ede9fe' },
  'Upper-Intermediate':  { icon: '🔥', color: 'var(--warning)', bg: '#fef3c7' },
  'Advanced':            { icon: '💎', color: 'var(--primary)', bg: '#ede9fe' },
  'Master':              { icon: '👑', color: 'var(--danger)', bg: '#fee2e2' },
};

const CONFETTI_COLORS = ['#6C63FF', '#FF6B35', '#10B981', '#F59E0B', '#EC4899', '#3B82F6'];

function Confetti() {
  const pieces = Array.from({ length: 28 }, (_, i) => {
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const left = `${(i / 28) * 100 + Math.sin(i * 1.7) * 3}%`;
    const delay = `${(i * 0.07).toFixed(2)}s`;
    const duration = `${1.2 + (i % 5) * 0.18}s`;
    const size = i % 3 === 0 ? 10 : i % 3 === 1 ? 7 : 5;
    const isCircle = i % 2 === 0;
    return { color, left, delay, duration, size, isCircle, key: i };
  });

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map(p => (
        <div
          key={p.key}
          style={{
            position: 'absolute',
            left: p.left,
            top: '-10px',
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.isCircle ? '50%' : '2px',
            animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

export default function LevelUpOverlay() {
  const { pendingLevelUp, clearLevelUp } = useAppStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pendingLevelUp) return;
    timerRef.current = setTimeout(clearLevelUp, 4500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [pendingLevelUp, clearLevelUp]);

  if (!pendingLevelUp) return null;

  const meta = LEVEL_META[pendingLevelUp.level] ?? LEVEL_META['Intermediate'];

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0)    rotate(0deg);   opacity: 1; }
          100% { transform: translateY(100vh) rotate(540deg); opacity: 0; }
        }
        @keyframes levelCardPop {
          0%   { transform: scale(0.5) translateY(40px); opacity: 0; }
          65%  { transform: scale(1.06) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes iconSpin {
          0%   { transform: scale(0) rotate(-180deg); }
          70%  { transform: scale(1.2) rotate(10deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes shimmerText {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .level-card { animation: levelCardPop 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .level-icon { animation: iconSpin 0.6s 0.2s cubic-bezier(0.34,1.56,0.64,1) both; }
        .shimmer-text {
          background: linear-gradient(90deg, #6C63FF 0%, #FF6B35 30%, #F59E0B 60%, #6C63FF 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmerText 2s linear infinite;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={clearLevelUp}
      >
        <Confetti />

        {/* Card */}
        <div
          className="level-card relative z-10 flex flex-col items-center text-center rounded-3xl p-8 mx-6 shadow-2xl"
          style={{ background: meta.bg, maxWidth: 320, width: '100%' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Icon */}
          <div className="level-icon text-7xl mb-4 select-none">{meta.icon}</div>

          {/* "LEVEL UP!" */}
          <p className="text-xs font-bold tracking-widest uppercase text-[var(--text-muted)] mb-1">
            Achievement Unlocked
          </p>
          <h2 className="shimmer-text text-4xl font-black mb-2">LEVEL UP!</h2>

          {/* New level name */}
          <div
            className="px-5 py-2 rounded-full text-white font-bold text-lg mb-4"
            style={{ background: meta.color }}
          >
            {meta.icon} {pendingLevelUp.level}
          </div>

          {/* XP milestone */}
          <p className="text-sm font-medium mb-6" style={{ color: meta.color }}>
            {pendingLevelUp.xp} XP total
          </p>

          <button
            onClick={clearLevelUp}
            className="w-full py-3 rounded-xl font-bold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: meta.color }}
          >
            Let's keep going! 🚀
          </button>

          <p className="text-xs text-[var(--text-muted)] mt-3">Tap anywhere to dismiss</p>
        </div>
      </div>
    </>
  );
}
