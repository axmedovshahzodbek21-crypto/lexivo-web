'use client';
import { useState, useEffect } from 'react';
import { getLevelInfo } from '@/lib/gamification';
import { LEVEL_THRESHOLDS, XP_PER_LEARN, XP_PER_QUIZ } from '@/lib/types';

interface Props {
  xp: number;
  onClose: () => void;
}

export default function XpModal({ xp, onClose }: Props) {
  const [peekLevel, setPeekLevel] = useState<string | null>(null);
  const levelInfo = getLevelInfo(xp);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function close() {
    setPeekLevel(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={close}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-sm rounded-t-3xl shadow-2xl animate-slide-up flex flex-col"
        style={{ maxHeight: '90vh', background: 'var(--surface)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <div className="px-6 pb-6 space-y-4 overflow-y-auto overscroll-contain">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Your Level</p>
              <h3 className="text-2xl font-black mt-0.5" style={{ color: 'var(--text)' }}>⭐ {levelInfo.level}</h3>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total XP</p>
              <p className="text-3xl font-black" style={{ color: 'var(--primary)' }}>{xp}</p>
            </div>
          </div>

          {/* Progress bar */}
          {levelInfo.next && (() => {
            const cur = LEVEL_THRESHOLDS.find(t => t.level === levelInfo.level)!;
            const nxt = LEVEL_THRESHOLDS.find(t => t.level === levelInfo.next)!;
            return (
              <div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${levelInfo.progress}%`, background: 'var(--primary)' }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <span>{cur.min} XP</span>
                  <span className="font-semibold" style={{ color: 'var(--primary)' }}>{Math.round(levelInfo.progress)}% there</span>
                  <span>{nxt.min} XP</span>
                </div>
              </div>
            );
          })()}

          {/* Next-level callout */}
          {levelInfo.next ? (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--primary-bg)' }}>
              <div className="text-center">
                <p className="text-4xl font-black" style={{ color: 'var(--primary)' }}>
                  {levelInfo.xpToNext} XP
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  to reach <strong style={{ color: 'var(--text)' }}>{levelInfo.next}</strong>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                <div className="rounded-xl py-2 px-3" style={{ background: 'var(--surface-2)' }}>
                  <p className="text-lg font-black" style={{ color: 'var(--text)' }}>{Math.ceil(levelInfo.xpToNext / XP_PER_LEARN)}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>words to learn</p>
                </div>
                <div className="rounded-xl py-2 px-3" style={{ background: 'var(--surface-2)' }}>
                  <p className="text-lg font-black" style={{ color: 'var(--text)' }}>{Math.ceil(levelInfo.xpToNext / XP_PER_QUIZ)}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>quiz answers</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--primary-bg)' }}>
              <p className="text-3xl mb-1">🏆</p>
              <p className="font-bold" style={{ color: 'var(--primary)' }}>Master Level reached!</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>You&apos;ve conquered all levels.</p>
            </div>
          )}

          {/* Level ladder */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              XP to reach each level
            </p>
            <div className="space-y-1">
              {LEVEL_THRESHOLDS.map((t, i) => {
                const isCurrentLevel = t.level === levelInfo.level;
                const isPast   = xp > t.max && t.max !== Infinity;
                const isFuture = !isPast && !isCurrentLevel;
                const isPeeked = peekLevel === t.level;
                const xpNeeded = Math.max(0, t.min - xp);
                return (
                  <div key={t.level}>
                    <button
                      onClick={() => isFuture && setPeekLevel(isPeeked ? null : t.level)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left ${
                        isFuture ? 'cursor-pointer' : 'cursor-default'
                      }`}
                      style={{
                        background: isCurrentLevel
                          ? 'var(--primary-bg)'
                          : isPeeked
                          ? 'var(--surface-2)'
                          : 'transparent',
                        border: isCurrentLevel
                          ? '1px solid color-mix(in srgb, var(--primary) 30%, transparent)'
                          : isPeeked
                          ? '1px solid var(--border)'
                          : '1px solid transparent',
                        opacity: isFuture && !isPeeked ? 0.6 : 1,
                      }}
                    >
                      <span className="text-base w-5 text-center shrink-0">
                        {isPast ? '✅' : isCurrentLevel ? '⭐' : isFuture ? '🔒' : `${i + 1}`}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold" style={{ color: isCurrentLevel ? 'var(--primary)' : 'var(--text)' }}>
                            {t.level}
                          </span>
                          {isCurrentLevel && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}>
                              You
                            </span>
                          )}
                        </div>
                        {isFuture && (
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {isPeeked ? 'tap to close' : 'tap to preview'}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] font-semibold" style={{
                          color: isCurrentLevel ? 'var(--primary)' : isPast ? 'var(--success)' : 'var(--text-muted)'
                        }}>
                          {t.min} XP
                        </span>
                        {isFuture && (
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{isPeeked ? '▲' : '▼'}</span>
                        )}
                      </div>
                    </button>

                    {/* Peek panel */}
                    {isPeeked && isFuture && (
                      <div className="mx-1 mb-1 px-3 py-3 rounded-xl space-y-2"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>
                          To reach <span style={{ color: 'var(--primary)' }}>{t.level}</span>
                        </p>
                        <p className="text-2xl font-black" style={{ color: 'var(--primary)' }}>
                          {xpNeeded} more XP
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'var(--surface)' }}>
                            <p className="text-base font-black" style={{ color: 'var(--text)' }}>{Math.ceil(xpNeeded / XP_PER_LEARN)}</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>words to learn</p>
                          </div>
                          <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'var(--surface)' }}>
                            <p className="text-base font-black" style={{ color: 'var(--text)' }}>{Math.ceil(xpNeeded / XP_PER_QUIZ)}</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>quiz answers</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={close}
            className="w-full py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: 'var(--primary)' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
