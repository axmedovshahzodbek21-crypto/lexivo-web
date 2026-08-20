'use client';
import { useState } from 'react';
import { displayXP, type XpEntry } from '@/lib/storage';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['M','T','W','T','F','S','S'];

interface Props {
  history: XpEntry[];
  // Lifetime per-day totals (see storage.ts's getXPByDate) — unlike
  // `history` (getXPHistory, capped at 500 raw events), this never loses
  // old days, so the calendar's coloring/totals stay consistent with the
  // lifetime XP total shown elsewhere instead of early days silently
  // going blank once enough recent activity pushes them out of the capped
  // history. Optional/falls back to summing `history` if omitted.
  xpByDate?: Record<string, number>;
  // Fired whenever the selected day changes (including being cleared), with
  // that day's entries (newest first, possibly empty if this day's raw
  // events already aged out of the cap) and total XP — the two callers
  // render the day-detail panel very differently (inline below vs. a side
  // column), so that markup stays in each caller rather than being
  // extracted here.
  onSelectDay?: (day: string | null, entries: XpEntry[], total: number) => void;
  // XpHistoryModal clears the selected day when the month changes (it can't
  // stay selected if it's no longer visible in the grid); XpModal doesn't,
  // matching each one's original behavior before this was extracted.
  resetSelectionOnMonthChange?: boolean;
}

export default function XpCalendar({ history, xpByDate, onSelectDay, resetSelectionOnMonthChange = false }: Props) {
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  if (history.length === 0 && !xpByDate) return null;

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
  const firstWeekday = (new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay() + 6) % 7; // Mon=0
  const mm = String(calMonth.getMonth()+1).padStart(2,'0');

  function selectDay(day: string | null) {
    setSelectedDay(day);
    const entries = day ? (byDate[day] ?? []).slice().sort((a,b) => b.timestamp - a.timestamp) : [];
    const total = day ? (xpByDate?.[day] ?? entries.reduce((s,e) => s + e.amount, 0)) : 0;
    onSelectDay?.(day, entries, total);
  }

  function changeMonth(delta: 1 | -1) {
    if (resetSelectionOnMonthChange) selectDay(null);
    setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-2)' }}>
      {/* Month nav */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <button onClick={() => changeMonth(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--border)] transition-colors text-lg"
          style={{ color: 'var(--primary)' }}>‹</button>
        <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
          {MONTH_NAMES[calMonth.getMonth()]} {calMonth.getFullYear()}
        </span>
        <button onClick={() => !isCurrentMonth && changeMonth(1)}
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
          const dayXp = xpByDate?.[dateStr] ?? (entries ? entries.reduce((s,e) => s+e.amount, 0) : 0);
          const hasXp = dayXp > 0;
          const isSelected = selectedDay === dateStr;
          return (
            <button key={day} onClick={() => hasXp && selectDay(isSelected ? null : dateStr)}
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
  );
}
