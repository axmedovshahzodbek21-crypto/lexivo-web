'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['M','T','W','T','F','S','S'];
const REASON_ICON: Record<string, string> = {
  Learn: '📖', learn: '📖',
  Cards: '🃏', flashcard: '🃏',
  Quiz: '🧠', quiz: '🧠',
  Match: '🎯', match: '🎯',
  Reading: '📚', read: '📚',
  'SRS Review': '🔄',
  Homework: '📋',
};

interface XpEntry { id: string; amount: number; reason: string; created_at: string; }

interface Props {
  classId: string;
  userId: string;
  xp: number; // raw (×10)
  studentName?: string; // set when a teacher is viewing a student other than themself
  accentColor?: string;
  onClose: () => void;
}

function exactTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Whoosh-then-land two-parter for when the day-detail panel slides open and
// overshoot-settles — no audio file, same Web Audio approach as
// lib/shuffle.ts's reveal sounds. Timed to roughly match the CSS bounce.
function playPanelOpenSound() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();

    // Whoosh: rising sweep as the panel slides in.
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.connect(sweepGain);
    sweepGain.connect(ctx.destination);
    sweep.type = 'sine';
    sweep.frequency.setValueAtTime(260, ctx.currentTime);
    sweep.frequency.exponentialRampToValueAtTime(720, ctx.currentTime + 0.26);
    sweepGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    sweepGain.gain.linearRampToValueAtTime(0.13, ctx.currentTime + 0.04);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    sweep.start(ctx.currentTime);
    sweep.stop(ctx.currentTime + 0.32);

    // Landing chime: brief bright ping as the overshoot settles.
    const land = ctx.createOscillator();
    const landGain = ctx.createGain();
    land.connect(landGain);
    landGain.connect(ctx.destination);
    land.type = 'sine';
    const landStart = ctx.currentTime + 0.28;
    land.frequency.setValueAtTime(880, landStart);
    landGain.gain.setValueAtTime(0.0001, landStart);
    landGain.gain.linearRampToValueAtTime(0.1, landStart + 0.02);
    landGain.gain.exponentialRampToValueAtTime(0.0001, landStart + 0.22);
    land.start(landStart);
    land.stop(landStart + 0.24);
  } catch {}
}

export default function ClassXpHistoryModal({ classId, userId, xp, studentName, accentColor = 'var(--primary)', onClose }: Props) {
  const { user } = useAuth();
  const [history, setHistory] = useState<XpEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const isSelf = user?.id === userId;
      const { data } = isSelf
        ? await supabase.from('class_xp_history').select('id, amount, reason, created_at').eq('user_id', userId).eq('class_id', classId).order('created_at', { ascending: false })
        : await supabase.rpc('get_student_xp_history', { p_class_id: classId, p_student_id: userId });
      if (!cancelled) { setHistory((data ?? []) as XpEntry[]); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [classId, userId, user?.id]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (selectedDay) playPanelOpenSound();
  }, [selectedDay]);

  const byDate: Record<string, XpEntry[]> = {};
  for (const e of history) {
    const key = e.created_at.slice(0, 10);
    (byDate[key] ??= []).push(e);
  }
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const isCurrentMonth = calMonth.getFullYear() === now.getFullYear() && calMonth.getMonth() === now.getMonth();
  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  const firstWeekday = (new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay() + 6) % 7;
  const mm = String(calMonth.getMonth() + 1).padStart(2, '0');

  const dayEntries = selectedDay
    ? (byDate[selectedDay] ?? []).slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];
  const dayTotal = dayEntries.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative rounded-t-3xl shadow-2xl animate-slide-up flex flex-col"
        style={{
          maxHeight: '90vh',
          background: 'var(--surface)',
          width: '100%',
          maxWidth: selectedDay ? '680px' : '384px',
          transition: 'max-width 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left column: calendar */}
          <div className="flex flex-col overflow-y-auto px-6 pb-6 space-y-4" style={{ width: selectedDay ? '360px' : '100%', flexShrink: 0 }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black" style={{ color: 'var(--text)' }}>📅 XP History</h3>
              <div className="text-right min-w-0">
                <p className="text-[10px] truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>{studentName ?? 'Total class XP'}</p>
                <p className="text-2xl font-black" style={{ color: accentColor }}>{(xp / 10).toFixed(1)}</p>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="py-10 text-center" style={{ color: 'var(--text-muted)' }}>
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm">No XP earned in this class yet</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                {/* Month nav */}
                <div className="flex items-center justify-between px-3 pt-3 pb-1">
                  <button
                    onClick={() => { setSelectedDay(null); setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)); }}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--border)] transition-colors text-lg"
                    style={{ color: accentColor }}>‹</button>
                  <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                    {MONTH_NAMES[calMonth.getMonth()]} {calMonth.getFullYear()}
                  </span>
                  <button
                    onClick={() => { if (!isCurrentMonth) { setSelectedDay(null); setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)); } }}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--border)] transition-colors text-lg"
                    style={{ color: isCurrentMonth ? 'var(--border)' : accentColor, cursor: isCurrentMonth ? 'default' : 'pointer' }}>›</button>
                </div>
                {/* Day labels */}
                <div className="grid grid-cols-7 px-2 pb-1">
                  {DAY_LABELS.map((d, i) => (
                    <div key={i} className="text-center text-[10px] font-bold py-1" style={{ color: 'var(--text-muted)' }}>{d}</div>
                  ))}
                </div>
                {/* Day grid */}
                <div className="grid grid-cols-7 gap-1 px-2 pb-3">
                  {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${calMonth.getFullYear()}-${mm}-${String(day).padStart(2, '0')}`;
                    const isToday = dateStr === todayStr;
                    const entries = byDate[dateStr];
                    const hasXp = !!entries;
                    const dayXp = hasXp ? entries.reduce((s, e) => s + e.amount, 0) : 0;
                    const hasReview = hasXp && entries.some(e => e.reason === 'SRS Review');
                    const isSelected = selectedDay === dateStr;
                    return (
                      <button key={day}
                        onClick={() => hasXp && setSelectedDay(isSelected ? null : dateStr)}
                        title={hasReview ? 'Did SRS Review this day' : undefined}
                        className="relative flex flex-col items-center justify-center rounded-full aspect-square transition-all"
                        style={{
                          background: isSelected ? accentColor : hasXp ? `color-mix(in srgb, ${accentColor} 85%, transparent)` : 'transparent',
                          outline: isToday ? `2px solid ${accentColor}` : 'none',
                          outlineOffset: 1,
                          cursor: hasXp ? 'pointer' : 'default',
                        }}>
                        <span className="text-[11px] font-bold leading-none" style={{ color: hasXp ? 'white' : 'var(--text)' }}>{day}</span>
                        {hasXp && <span className="text-[7px] leading-none mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>+{(dayXp / 10).toFixed(1)}</span>}
                        {hasReview && (
                          <span
                            className="absolute top-0 right-0 w-3 h-3 rounded-full flex items-center justify-center"
                            style={{ background: '#06b6d4', boxShadow: '0 0 0 1.5px var(--surface-2)', fontSize: 6 }}
                          >🔄</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-4 pb-3 text-[10px] flex-wrap" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ background: `color-mix(in srgb, ${accentColor} 85%, transparent)` }} />
                    XP earned
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span style={{ fontSize: 11 }}>🔄</span>
                    Did Review
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: accentColor }}
            >
              Got it
            </button>
          </div>

          {/* Right column: day detail */}
          {selectedDay && (
            <div className="flex-1 flex flex-col min-w-0 border-l overflow-y-auto animate-slide-in-right" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{selectedDay}</p>
                  <p className="text-lg font-black" style={{ color: accentColor }}>+{(dayTotal / 10).toFixed(1)} XP</p>
                </div>
                <button onClick={() => setSelectedDay(null)} className="text-lg" style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>
              <div className="overflow-y-auto overscroll-contain pb-6">
                {dayEntries.map((e, j) => (
                  <div key={e.id}>
                    {j > 0 && <div style={{ height: 1, background: 'var(--border)', marginLeft: 52 }} />}
                    <div className="flex items-center gap-3 px-5 py-3">
                      <span className="text-xl shrink-0">{REASON_ICON[e.reason] ?? '⚡'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{e.reason}</p>
                        <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{exactTime(e.created_at)}</p>
                      </div>
                      <span className="text-sm font-black shrink-0" style={{ color: accentColor }}>+{(e.amount / 10).toFixed(1)} XP</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
