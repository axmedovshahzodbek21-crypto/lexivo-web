'use client';
import { useState, useEffect } from 'react';
import { displayXP, fetchXPHistory, type XpEntry } from '@/lib/storage';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['M','T','W','T','F','S','S'];
const REASON_ICONS: Record<string, string> = { Learn:'📖', Flashcard:'🃏', Quiz:'🧠', Match:'🎯', 'SRS Review':'🔄', 'Streak Bonus':'🔥', 'Level Complete':'🏆' };

interface Props {
  xp: number;
  onClose: () => void;
}

export default function XpHistoryModal({ xp, onClose }: Props) {
  const [history, setHistory] = useState<XpEntry[]>([]);
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    fetchXPHistory().then(setHistory).catch(() => {});
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const byDate: Record<string, XpEntry[]> = {};
  for (const e of history) {
    const d = new Date(e.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    (byDate[key] ??= []).push(e);
  }
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const isCurrentMonth = calMonth.getFullYear() === now.getFullYear() && calMonth.getMonth() === now.getMonth();
  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth()+1, 0).getDate();
  const firstWeekday = (new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay() + 6) % 7;
  const mm = String(calMonth.getMonth()+1).padStart(2,'0');

  const dayEntries = selectedDay ? (byDate[selectedDay] ?? []).slice().sort((a,b) => b.timestamp - a.timestamp) : [];
  const dayTotal = dayEntries.reduce((s,e) => s + e.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
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
            <h3 className="text-xl font-black" style={{ color: 'var(--text)' }}>📅 XP History</h3>
            <div className="text-right">
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Total XP</p>
              <p className="text-2xl font-black" style={{ color: 'var(--primary)' }}>{displayXP(xp)}</p>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="py-10 text-center" style={{ color: 'var(--text-muted)' }}>
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">No XP earned yet.<br/>Start learning to see your history!</p>
            </div>
          ) : (
            <>
              {/* Calendar */}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                {/* Month nav */}
                <div className="flex items-center justify-between px-3 pt-3 pb-1">
                  <button
                    onClick={() => { setSelectedDay(null); setCalMonth(m => new Date(m.getFullYear(), m.getMonth()-1, 1)); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--border)] transition-colors text-lg"
                    style={{ color: 'var(--primary)' }}>‹</button>
                  <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                    {MONTH_NAMES[calMonth.getMonth()]} {calMonth.getFullYear()}
                  </span>
                  <button
                    onClick={() => { if (!isCurrentMonth) { setSelectedDay(null); setCalMonth(m => new Date(m.getFullYear(), m.getMonth()+1, 1)); } }}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--border)] transition-colors text-lg"
                    style={{ color: isCurrentMonth ? 'var(--border)' : 'var(--primary)', cursor: isCurrentMonth ? 'default' : 'pointer' }}>›</button>
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
                      <button key={day}
                        onClick={() => hasXp && setSelectedDay(dateStr)}
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

              {/* Day detail — inline below calendar */}
              {selectedDay && (
                <div className="rounded-2xl overflow-hidden mt-0" style={{ background: 'var(--surface-2)' }}>
                  <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-xs font-black tracking-wide" style={{ color: 'var(--primary)' }}>{selectedDay}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black" style={{ color: 'var(--primary)' }}>+{displayXP(dayTotal)} XP</span>
                      <button onClick={() => setSelectedDay(null)} className="text-sm leading-none" style={{ color: 'var(--text-muted)' }}>✕</button>
                    </div>
                  </div>
                  {dayEntries.map((e, j) => {
                    const d = new Date(e.timestamp);
                    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                    return (
                      <div key={j}>
                        {j > 0 && <div style={{ height: 1, background: 'var(--border)', marginLeft: 52 }} />}
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-lg shrink-0">{REASON_ICONS[e.reason] ?? '⭐'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{e.reason}</p>
                            <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{e.source ? e.source : time}</p>
                          </div>
                          <span className="text-sm font-black shrink-0" style={{ color: 'var(--primary)' }}>+{displayXP(e.amount)} XP</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </>
          )}

          <button
            onClick={onClose}
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
