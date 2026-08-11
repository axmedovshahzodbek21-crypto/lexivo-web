'use client';
import { useState, useEffect } from 'react';
import { getLevelInfo } from '@/lib/gamification';
import { LEVEL_THRESHOLDS } from '@/lib/types';
import { displayXP, fetchXPHistory, type XpEntry } from '@/lib/storage';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['M','T','W','T','F','S','S'];
const REASON_ICONS: Record<string, string> = { Learn:'📖', Flashcard:'🃏', Quiz:'🧠', Match:'🎯', 'SRS Review':'🔄', 'Streak Bonus':'🔥', 'Level Complete':'🏆' };

interface Props {
  xp: number;
  onClose: () => void;
}

export default function XpModal({ xp, onClose }: Props) {
  const [peekLevel, setPeekLevel] = useState<string | null>(null);
  const [history, setHistory] = useState<XpEntry[]>([]);
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const levelInfo = getLevelInfo(xp);

  useEffect(() => {
    fetchXPHistory().then(setHistory).catch(() => {});
  }, []);

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
              <p className="text-3xl font-black" style={{ color: 'var(--primary)' }}>{displayXP(xp)}</p>
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
                  <span>{displayXP(cur.min)} XP</span>
                  <span className="font-semibold" style={{ color: 'var(--primary)' }}>{Math.round(levelInfo.progress)}% there</span>
                  <span>{displayXP(nxt.min)} XP</span>
                </div>
              </div>
            );
          })()}

          {/* Next-level callout */}
          {levelInfo.next ? (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--primary-bg)' }}>
              <div className="text-center">
                <p className="text-4xl font-black" style={{ color: 'var(--primary)' }}>
                  {displayXP(levelInfo.xpToNext)} XP
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  to reach <strong style={{ color: 'var(--text)' }}>{levelInfo.next}</strong>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                <div className="rounded-xl py-2 px-3" style={{ background: 'var(--surface-2)' }}>
                  <p className="text-lg font-black" style={{ color: 'var(--text)' }}>{Math.ceil(levelInfo.xpToNext / 10)}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>words to learn</p>
                </div>
                <div className="rounded-xl py-2 px-3" style={{ background: 'var(--surface-2)' }}>
                  <p className="text-lg font-black" style={{ color: 'var(--text)' }}>{Math.ceil(levelInfo.xpToNext / 7)}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Day 7 reviews</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--primary-bg)' }}>
              <p className="text-3xl mb-1">🏆</p>
              <p className="font-bold" style={{ color: 'var(--primary)' }}>Legend Level reached!</p>
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
                          {displayXP(t.min)} XP
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
                          {displayXP(xpNeeded)} more XP
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'var(--surface)' }}>
                            <p className="text-base font-black" style={{ color: 'var(--text)' }}>{Math.ceil(xpNeeded / 10)}</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>words to learn</p>
                          </div>
                          <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'var(--surface)' }}>
                            <p className="text-base font-black" style={{ color: 'var(--text)' }}>{Math.ceil(xpNeeded / 7)}</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Day 7 reviews</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* XP History Calendar */}
          {history.length > 0 && (() => {
            const byDate: Record<string, XpEntry[]> = {};
            for (const e of history) {
              const d = new Date(e.timestamp);
              const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
              (byDate[key] ??= []).push(e);
            }
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
            const canNext = calMonth.getFullYear() === now.getFullYear() && calMonth.getMonth() === now.getMonth();
            const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth()+1, 0).getDate();
            const firstWeekday = (new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay() + 6) % 7; // Mon=0
            const mm = String(calMonth.getMonth()+1).padStart(2,'0');

            const dayEntries = selectedDay ? (byDate[selectedDay] ?? []).slice().sort((a,b) => b.timestamp - a.timestamp) : [];
            const dayTotal = dayEntries.reduce((s,e) => s + e.amount, 0);

            return (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>XP History</p>
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  {/* Month nav */}
                  <div className="flex items-center justify-between px-3 pt-3 pb-1">
                    <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth()-1, 1))}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--border)] transition-colors text-lg"
                      style={{ color: 'var(--primary)' }}>‹</button>
                    <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                      {MONTH_NAMES[calMonth.getMonth()]} {calMonth.getFullYear()}
                    </span>
                    <button onClick={() => !canNext && setCalMonth(m => new Date(m.getFullYear(), m.getMonth()+1, 1))}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--border)] transition-colors text-lg"
                      style={{ color: canNext ? 'var(--border)' : 'var(--primary)', cursor: canNext ? 'default' : 'pointer' }}>›</button>
                  </div>
                  {/* Day labels */}
                  <div className="grid grid-cols-7 px-2 pb-1">
                    {DAY_LABELS.map((d,i) => (
                      <div key={i} className="text-center text-[10px] font-bold py-1" style={{ color: 'var(--text-muted)' }}>{d}</div>
                    ))}
                  </div>
                  {/* Day grid */}
                  <div className="grid grid-cols-7 gap-1 px-2 pb-3">
                    {Array.from({ length: firstWeekday }).map((_,i) => <div key={`e${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = `${calMonth.getFullYear()}-${mm}-${String(day).padStart(2,'0')}`;
                      const isToday = dateStr === todayStr;
                      const entries = byDate[dateStr];
                      const hasXp = !!entries;
                      const dayXp = hasXp ? entries.reduce((s,e) => s+e.amount, 0) : 0;
                      const isSelected = selectedDay === dateStr;
                      return (
                        <button key={day} onClick={() => hasXp && setSelectedDay(isSelected ? null : dateStr)}
                          className="flex flex-col items-center justify-center rounded-full aspect-square transition-all"
                          style={{
                            background: isSelected ? 'var(--primary)' : hasXp ? 'color-mix(in srgb, var(--primary) 85%, transparent)' : 'transparent',
                            outline: isToday ? '2px solid var(--primary)' : 'none',
                            outlineOffset: 1,
                            cursor: hasXp ? 'pointer' : 'default',
                          }}>
                          <span className="text-[11px] font-bold leading-none" style={{ color: hasXp ? 'white' : 'var(--text)' }}>{day}</span>
                          {hasXp && <span className="text-[7px] leading-none mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>+{displayXP(dayXp)}</span>}
                        </button>
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div className="flex items-center justify-center gap-2 pb-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <span className="w-3 h-3 rounded-full inline-block" style={{ background: 'color-mix(in srgb, var(--primary) 85%, transparent)' }} />
                    XP earned
                  </div>
                </div>

                {/* Day detail */}
                {selectedDay && (
                  <div className="mt-2 rounded-2xl overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                    <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--primary)' }}>{selectedDay}</span>
                      <span className="text-sm font-black" style={{ color: 'var(--primary)' }}>+{displayXP(dayTotal)} XP</span>
                    </div>
                    {dayEntries.map((e, j) => {
                      const d = new Date(e.timestamp);
                      const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                      return (
                        <div key={j}>
                          {j > 0 && <div style={{ height: 1, background: 'var(--border)', marginLeft: 48 }} />}
                          <div className="flex items-center gap-3 px-4 py-2.5">
                            <span className="text-lg shrink-0">{REASON_ICONS[e.reason] ?? '⭐'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{e.reason}</p>
                              <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                                {e.source ? e.source : time}
                              </p>
                            </div>
                            <span className="text-xs font-black shrink-0" style={{ color: 'var(--primary)' }}>+{displayXP(e.amount)} XP</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

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
