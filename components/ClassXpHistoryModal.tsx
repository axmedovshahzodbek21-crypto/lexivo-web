'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { classifyReview, REVIEW_LABEL_META } from '@/lib/reviewPattern';

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

// Whoosh, overshoot-thud, then a two-note landing chime — timed to the
// 1.1s slideInRight keyframe (whoosh through the fly-in, thud at the 60%
// overshoot peak, chime as it settles). No audio file, same Web Audio
// approach as lib/shuffle.ts's reveal sounds.
function playPanelOpenSound() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const t0 = ctx.currentTime;

    // Whoosh: long rising sweep as the panel flies in.
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.connect(sweepGain);
    sweepGain.connect(ctx.destination);
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(120, t0);
    sweep.frequency.exponentialRampToValueAtTime(680, t0 + 0.62);
    sweepGain.gain.setValueAtTime(0.0001, t0);
    sweepGain.gain.linearRampToValueAtTime(0.05, t0 + 0.08);
    sweepGain.gain.linearRampToValueAtTime(0.09, t0 + 0.55);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.68);
    sweep.start(t0);
    sweep.stop(t0 + 0.7);

    // Thud: soft low impact right at the overshoot peak (~60% of 1.1s).
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.type = 'sine';
    const thudStart = t0 + 0.62;
    thud.frequency.setValueAtTime(180, thudStart);
    thud.frequency.exponentialRampToValueAtTime(70, thudStart + 0.16);
    thudGain.gain.setValueAtTime(0.0001, thudStart);
    thudGain.gain.linearRampToValueAtTime(0.16, thudStart + 0.015);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, thudStart + 0.18);
    thud.start(thudStart);
    thud.stop(thudStart + 0.2);

    // Landing chime: two bright notes as it settles into place (~80%–100%).
    [880, 1174.66].forEach((freq, i) => {
      const start = t0 + 0.78 + i * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.11, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.26);
      osc.start(start);
      osc.stop(start + 0.28);
    });
  } catch {}
}

export default function ClassXpHistoryModal({ classId, userId, xp, studentName, accentColor = 'var(--primary)', onClose }: Props) {
  const { user } = useAuth();
  const [history, setHistory] = useState<XpEntry[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showReviewDetail, setShowReviewDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const isSelf = user?.id === userId;
      const today = new Date().toISOString().slice(0, 10);
      const [{ data }, { data: srs }] = await Promise.all([
        isSelf
          ? supabase.from('class_xp_history').select('id, amount, reason, created_at').eq('user_id', userId).eq('class_id', classId).order('created_at', { ascending: false })
          : supabase.rpc('get_student_xp_history', { p_class_id: classId, p_student_id: userId }),
        supabase.from('class_srs_states').select('stage, next_due').eq('user_id', userId).eq('class_id', classId).lt('next_due', today),
      ]);
      if (!cancelled) {
        setHistory((data ?? []) as XpEntry[]);
        setOverdueCount(((srs ?? []) as { stage: number }[]).filter(r => r.stage < 5).length);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [classId, userId, user?.id]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (selectedDay || showReviewDetail) playPanelOpenSound();
  }, [selectedDay, showReviewDetail]);

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
  const reviewOnly = history.filter(e => e.reason === 'SRS Review');
  const reviewPattern = classifyReview(reviewOnly, overdueCount);
  const reviewMeta = REVIEW_LABEL_META[reviewPattern.label];

  const reviewCountByDay = new Map<string, number>();
  for (const e of reviewOnly) {
    const d = e.created_at.slice(0, 10);
    reviewCountByDay.set(d, (reviewCountByDay.get(d) ?? 0) + 1);
  }
  const last30Days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last30Days.push(d.toISOString().slice(0, 10));
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative rounded-t-3xl shadow-2xl animate-slide-up flex flex-col"
        style={{
          maxHeight: '90vh',
          background: 'var(--surface)',
          width: '100%',
          maxWidth: '980px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <div className="flex flex-1 min-h-0 justify-center">
          {/* Calendar (right column once a day is selected) */}
          <div className="flex flex-col overflow-y-auto px-6 pb-6 space-y-4" style={{ width: '300px', flexShrink: 0, order: 2 }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black" style={{ color: 'var(--text)' }}>📅 XP History</h3>
              <div className="text-right min-w-0">
                <p className="text-[10px] truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>{studentName ?? 'Total class XP'}</p>
                <p className="text-2xl font-black" style={{ color: accentColor }}>{(xp / 10).toFixed(1)}</p>
              </div>
            </div>

            {!loading && (
              <button
                onClick={() => setShowReviewDetail(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:opacity-85 transition-opacity"
                style={{ background: `color-mix(in srgb, ${reviewMeta.color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${reviewMeta.color} 30%, transparent)` }}
                title={reviewMeta.blurb}
              >
                <span>{reviewMeta.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate" style={{ color: reviewMeta.color }}>Review: {reviewMeta.text}</p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">
                    {reviewPattern.daysReviewed}/30 days · {reviewPattern.streak}d streak
                    {overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
                  </p>
                </div>
                <span className="text-xs shrink-0" style={{ color: reviewMeta.color }}>ⓘ</span>
              </button>
            )}

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
                        onClick={() => { if (!hasXp) return; setSelectedDay(isSelected ? null : dateStr); }}
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

          {/* Day detail (left column) */}
          {selectedDay && (
            <div className="flex-1 flex flex-col min-w-0 border-r overflow-y-auto animate-slide-in-left" style={{ borderColor: 'var(--border)', order: 1 }}>
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

          {/* Review Pattern detail (right column) */}
          {showReviewDetail && (
            <div className="flex-1 flex flex-col min-w-0 border-l overflow-y-auto animate-slide-in-right" style={{ borderColor: 'var(--border)', order: 3 }}>
              <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{reviewMeta.emoji}</span>
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Review Pattern</p>
                    <p className="text-sm font-black" style={{ color: reviewMeta.color }}>{reviewMeta.text}</p>
                  </div>
                </div>
                <button onClick={() => setShowReviewDetail(false)} className="text-lg" style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>

              <div className="overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
                <p className="text-sm" style={{ color: 'var(--text)' }}>{reviewMeta.blurb}</p>

                {/* Stat breakdown */}
                <div className="rounded-xl divide-y" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                  {[
                    { label: 'Days reviewed (last 30)', value: `${reviewPattern.daysReviewed}/30 (${Math.round(reviewPattern.coverage * 100)}%)` },
                    { label: 'Current streak', value: `${reviewPattern.streak} day${reviewPattern.streak === 1 ? '' : 's'}` },
                    { label: 'Longest gap', value: `${reviewPattern.longestGap} day${reviewPattern.longestGap === 1 ? '' : 's'}` },
                    { label: 'Avg words / active day', value: reviewPattern.totalReviews > 0 ? reviewPattern.avgPerActiveDay.toFixed(1) : '—' },
                    { label: 'Total reviews (30d)', value: `${reviewPattern.totalReviews}` },
                    { label: 'Currently overdue', value: `${overdueCount}` },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-2.5 text-xs">
                      <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                      <span className="font-bold" style={{ color: 'var(--text)' }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* 30-day review strip */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Last 30 days</p>
                  <div className="grid grid-cols-10 gap-1">
                    {last30Days.map(d => {
                      const count = reviewCountByDay.get(d) ?? 0;
                      const isToday = d === todayStr;
                      return (
                        <div
                          key={d}
                          title={`${d}${count > 0 ? ` · reviewed ${count} word${count === 1 ? '' : 's'}` : ' · no review'}`}
                          className="aspect-square rounded"
                          style={{
                            background: count > 0 ? reviewMeta.color : 'var(--surface-2)',
                            border: count > 0 ? 'none' : '1px solid var(--border)',
                            outline: isToday ? `1.5px solid ${accentColor}` : 'none',
                            outlineOffset: 1,
                            opacity: count > 0 ? Math.min(1, 0.45 + count * 0.15) : 1,
                          }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: reviewMeta.color }} />reviewed</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ border: '1px solid var(--border)' }} />no review</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
