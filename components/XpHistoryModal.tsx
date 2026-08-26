'use client';
import { useState, useEffect } from 'react';
import { displayXP, fetchXPHistory, getXPByDate, type XpEntry } from '@/lib/storage';
import { REASON_ICON as REASON_ICONS } from '@/lib/xp-reason-icons';
import XpCalendar from './XpCalendar';

interface Props {
  xp: number;
  onClose: () => void;
}

export default function XpHistoryModal({ xp, onClose }: Props) {
  const [history, setHistory] = useState<XpEntry[]>([]);
  const [xpByDate, setXpByDate] = useState<Record<string, number>>({});
  const [dayDetail, setDayDetail] = useState<{ day: string; entries: XpEntry[]; total: number } | null>(null);

  useEffect(() => {
    fetchXPHistory().then(setHistory).catch(() => {});
    setXpByDate(getXPByDate());
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const selectedDay = dayDetail?.day ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative rounded-t-3xl shadow-2xl animate-slide-up flex flex-col"
        style={{
          maxHeight: '90vh',
          background: 'var(--surface)',
          width: '100%',
          maxWidth: selectedDay ? '680px' : '384px',
          transition: 'max-width 0.25s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left column: calendar */}
          <div className="flex flex-col overflow-y-auto px-6 pb-6 space-y-4" style={{ width: selectedDay ? '360px' : '100%', flexShrink: 0 }}>
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
              <XpCalendar
                history={history}
                xpByDate={xpByDate}
                resetSelectionOnMonthChange
                onSelectDay={(day, entries, total) => setDayDetail(day ? { day, entries, total } : null)}
              />
            )}

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: 'var(--primary)' }}
            >
              Got it
            </button>
          </div>

          {/* Right column: day detail */}
          {dayDetail && (
            <div className="flex-1 flex flex-col min-w-0 border-l overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
              {/* Detail header */}
              <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{dayDetail.day}</p>
                  <p className="text-lg font-black" style={{ color: 'var(--primary)' }}>+{displayXP(dayDetail.total)} XP</p>
                </div>
                <button onClick={() => setDayDetail(null)} className="text-lg" style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>
              {/* Entries */}
              <div className="overflow-y-auto overscroll-contain pb-6">
                {dayDetail.entries.length === 0 && (
                  <p className="text-[11px] text-center px-5 py-4" style={{ color: 'var(--text-muted)' }}>
                    Detailed breakdown no longer available for this day — only recent activity is kept.
                  </p>
                )}
                {dayDetail.entries.map((e, j) => {
                  const d = new Date(e.timestamp);
                  const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                  return (
                    <div key={j}>
                      {j > 0 && <div style={{ height: 1, background: 'var(--border)', marginLeft: 52 }} />}
                      <div className="flex items-center gap-3 px-5 py-3">
                        <span className="text-xl shrink-0">{REASON_ICONS[e.reason] ?? '⭐'}</span>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
