'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { classifyReview, reviewVerdict, REVIEW_VERDICT_META, REVIEW_WINDOW_DAYS } from '@/lib/reviewPattern';
import { localDateStr, addDaysToDateStr, displayXP } from '@/lib/storage';
import { REASON_ICON } from '@/lib/xp-reason-icons';
import { getAudioCtx, playTone } from '@/lib/web-audio';
import { useTranslation } from '@/lib/useTranslation';
import XpCalendar from './XpCalendar';
import { MessageComposer } from './insights/InsightPopup';
import { MissedHomeworkRows } from './MissedHomework';
import { loadHomeworkRecords, missedFromRecords, type HomeworkRecord } from '@/lib/homework-deadlines';
import { buildStudentSummary, type SentNote } from '@/lib/student-summary';
import { translations } from '@/lib/i18n';

const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
const fmtYmd = (ymd: string) => ymd.split('-').reverse().join('.');

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
// overshoot peak, chime as it settles). No audio file — shares
// lib/web-audio.ts's context/note helpers with the app's other Web Audio
// effects (shuffle tick/reveal, Pomodoro beep); the whoosh/thud below stay
// bespoke since both ramp frequency over time, unlike every other note in
// the app which plays at a constant pitch.
function playPanelOpenSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
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
      playTone(ctx, { type: 'sine', freq, start: t0 + 0.78 + i * 0.1, duration: 0.26, peakGain: 0.11, attack: 0.02 });
    });
  } catch {}
}

export default function ClassXpHistoryModal({ classId, userId, xp, studentName, accentColor = 'var(--primary)', onClose }: Props) {
  const { user } = useAuth();
  const t = useTranslation();
  const [history, setHistory] = useState<XpEntry[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showReviewDetail, setShowReviewDetail] = useState(false);
  const [showSummary, setShowSummary] = useState(false); // shares the right column with Review Pattern
  const [composing, setComposing] = useState(false);
  const [joinDate, setJoinDate] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [hwRecords, setHwRecords] = useState<HomeworkRecord[] | null>(null);
  const [notes, setNotes] = useState<SentNote[]>([]);

  // Teacher viewing a student only — a student can't read a classmate's
  // homework progress, so every past-due assignment would look missed.
  const teacherView = studentName !== undefined && user?.id !== userId;
  useEffect(() => {
    if (!teacherView || loading) return;
    let cancelled = false;
    Promise.all([
      loadHomeworkRecords(classId, [{ id: userId, joinDate }], t),
      supabase.from('class_notes').select('created_at, read_at').eq('class_id', classId).eq('student_id', userId)
        .order('created_at', { ascending: false }).limit(20),
    ])
      .then(([records, { data: n }]) => {
        if (cancelled) return;
        setHwRecords(records);
        setNotes((n ?? []) as SentNote[]);
      })
      .catch(e => console.error('[ClassXpHistoryModal] homework/notes', e));
    return () => { cancelled = true; };
  }, [teacherView, loading, classId, userId, joinDate, t]);
  const missed = hwRecords ? missedFromRecords(hwRecords) : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const isSelf = user?.id === userId;
      const today = localDateStr();
      const [{ data }, { data: srs }, { data: member }] = await Promise.all([
        isSelf
          ? supabase.from('class_xp_history').select('id, amount, reason, created_at').eq('user_id', userId).eq('class_id', classId).order('created_at', { ascending: false })
          : supabase.rpc('get_student_xp_history', { p_class_id: classId, p_student_id: userId }),
        supabase.from('class_srs_states').select('stage, next_due').eq('user_id', userId).eq('class_id', classId).lte('next_due', today),
        supabase.from('class_members').select('joined_at').eq('class_id', classId).eq('student_id', userId).maybeSingle(),
      ]);
      if (!cancelled) {
        setHistory((data ?? []) as XpEntry[]);
        const joinedAt = (member as { joined_at: string | null } | null)?.joined_at;
        setJoinDate(joinedAt ? localDateStr(new Date(joinedAt)) : null);
        const pending = ((srs ?? []) as { stage: number; next_due: string }[]).filter(r => r.stage < 5);
        setDueCount(pending.length);
        setOverdueCount(pending.filter(r => r.next_due < today).length);
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
    if (selectedDay || showReviewDetail || showSummary) playPanelOpenSound();
  }, [selectedDay, showReviewDetail, showSummary]);

  const byDate: Record<string, XpEntry[]> = {};
  for (const e of history) {
    const key = localDateStr(new Date(e.created_at));
    (byDate[key] ??= []).push(e);
  }
  const todayStr = localDateStr(new Date());
  // XpCalendar's XpEntry uses `timestamp: number`, not this component's own
  // richer shape (id/created_at/reason) needed for the day-detail panel
  // below — mapped once here so the shared grid can sum/group by date.
  const calendarEntries = history.map(e => ({ amount: e.amount, reason: e.reason, timestamp: new Date(e.created_at).getTime() }));

  const dayEntries = selectedDay
    ? (byDate[selectedDay] ?? []).slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];
  const dayTotal = dayEntries.reduce((s, e) => s + e.amount, 0);

  // Review and Learn write one history row per word, so a session showed up
  // as dozens of identical "+0.2 XP" lines. Collapse back-to-back rows with
  // the same reason (less than GROUP_GAP_MS apart) into one row per session.
  const GROUP_GAP_MS = 30 * 60 * 1000;
  const dayGroups: { id: string; reason: string; amount: number; count: number; from: string; to: string }[] = [];
  for (const e of dayEntries) { // newest first
    const g = dayGroups[dayGroups.length - 1];
    if (g && g.reason === e.reason && new Date(g.from).getTime() - new Date(e.created_at).getTime() < GROUP_GAP_MS) {
      g.amount += e.amount; g.count += 1; g.from = e.created_at;
    } else {
      dayGroups.push({ id: e.id, reason: e.reason, amount: e.amount, count: 1, from: e.created_at, to: e.created_at });
    }
  }
  const reviewOnly = history.filter(e => e.reason === 'SRS Review');
  const reviewPattern = classifyReview(reviewOnly, overdueCount, joinDate);
  const h = t.classXpHistory;
  const reasonLabel = (r: string) =>
    h.reasonLabels[r] ?? (r.startsWith('Reading: ') ? `${h.readingPrefix}: ${r.slice('Reading: '.length)}` : r);

  // Verdict first (is this student OK?), then one plain sentence: when they
  // last reviewed and how many words are waiting. A student viewing themself
  // gets a nudge, not a red label.
  const isSelf = user?.id === userId;
  const name = studentName ?? t.classesPage.defaultStudentName;
  const ds = reviewPattern.daysSinceLast;
  const verdict = reviewVerdict(reviewOnly.length, ds, dueCount, overdueCount);
  const verdictMeta = REVIEW_VERDICT_META[verdict];
  const lastLine = verdict === 'new' ? (isSelf ? h.verdictNewSelf : fill(h.verdictNewOther, { name }))
    : ds === null ? (isSelf ? h.sumNeverSelf : fill(h.sumNeverOther, { name }))
    : ds === 0 ? (isSelf ? h.sumTodaySelf : fill(h.sumTodayOther, { name }))
    : ds === 1 ? (isSelf ? h.sumYesterdaySelf : fill(h.sumYesterdayOther, { name }))
    : fill(isSelf ? h.sumDaysSelf : h.sumDaysOther, { name, n: ds });
  const waitingLine = overdueCount > 0
    ? (overdueCount === dueCount ? fill(h.waitingAllOverdue, { n: dueCount }) : fill(h.waitingSomeOverdue, { n: dueCount, m: overdueCount }))
    : dueCount > 0 ? fill(h.waitingToday, { n: dueCount }) : '';
  const summary = [lastLine, waitingLine, isSelf && dueCount > 0 ? h.selfNudge : ''].filter(Boolean).join(' ');
  // Teacher card: review lines + the homework/reminder sentences (lib/student-summary.ts).
  const activity = history.map(e => new Date(e.created_at).getTime());
  const activeDays7 = new Set(history.filter(e => e.created_at && localDateStr(new Date(e.created_at)) > addDaysToDateStr(todayStr, -7))
    .map(e => localDateStr(new Date(e.created_at)))).size;
  const smart = teacherView && hwRecords ? buildStudentSummary({
    studentId: userId, name, lang: t === translations.uz ? 'uz' : 'en',
    today: todayStr, now: Date.now(),
    homework: hwRecords, notes, activity, activeDays7,
    daysInClass: joinDate ? Math.round((new Date(todayStr).getTime() - new Date(joinDate).getTime()) / 86400000) : null,
  }) : [];
  const pillColor = isSelf ? accentColor : verdictMeta.color;
  const lastReviewValue = reviewPattern.lastReviewDate === null || ds === null ? '—'
    : `${fmtYmd(reviewPattern.lastReviewDate)} (${ds === 0 ? h.statToday : fill(h.statDaysAgo, { n: ds })})`;
  const daysInClass = joinDate ? Math.round((new Date(todayStr).getTime() - new Date(joinDate).getTime()) / 86400000) : null;
  const inClassSinceValue = joinDate === null || daysInClass === null ? '—'
    : `${fmtYmd(joinDate)} (${daysInClass <= 0 ? h.statToday : fill(h.statDaysAgo, { n: daysInClass })})`;

  const reviewCountByDay = new Map<string, number>();
  for (const e of reviewOnly) {
    const d = localDateStr(new Date(e.created_at));
    reviewCountByDay.set(d, (reviewCountByDay.get(d) ?? 0) + 1);
  }
  const last30Days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    last30Days.push(addDaysToDateStr(todayStr, -i));
  }

  const statTable = (rows: { label: string; value: string; color?: string }[]) => (
    <div className="rounded-xl divide-y" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
      {rows.map(row => (
        <div key={row.label} className="flex items-center justify-between px-4 py-2.5 text-xs">
          <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
          <span className="font-bold" style={{ color: row.color ?? 'var(--text)' }}>{row.value}</span>
        </div>
      ))}
    </div>
  );

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
              <h3 className="text-xl font-black" style={{ color: 'var(--text)' }}>{t.classXpHistory.title}</h3>
              <div className="text-right min-w-0">
                <p className="text-[10px] truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>{studentName ?? t.classXpHistory.totalClassXp}</p>
                <p className="text-2xl font-black" style={{ color: accentColor }}>{displayXP(xp)}</p>
              </div>
            </div>

            {!loading && (
              <button
                onClick={() => { setShowSummary(false); setShowReviewDetail(true); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:opacity-85 transition-opacity"
                style={{ background: `color-mix(in srgb, ${pillColor} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${pillColor} 30%, transparent)` }}
              >
                <span>{isSelf ? '🔄' : verdictMeta.emoji}</span>
                <div className="min-w-0 flex-1">
                  {!isSelf && (
                    <p className="text-xs font-bold truncate" style={{ color: verdictMeta.color }}>{h.verdictTitle[verdict]}</p>
                  )}
                  <p className="text-xs leading-snug" style={{ color: 'var(--text)' }}>{summary}</p>
                </div>
                <span className="text-xs shrink-0" style={{ color: pillColor }}>›</span>
              </button>
            )}

            {/* Summary — one tap away, opens in the right column */}
            {teacherView && hwRecords && (
              <button
                onClick={() => { setShowReviewDetail(false); setShowSummary(true); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:opacity-85 transition-opacity"
                style={{ background: `color-mix(in srgb, ${accentColor} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${accentColor} 30%, transparent)` }}
              >
                <span>✨</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold" style={{ color: accentColor }}>{h.summaryTitle}</p>
                  <p className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>{h.summarySub}</p>
                </div>
                <span className="text-xs shrink-0" style={{ color: accentColor }}>›</span>
              </button>
            )}

            {/* Homework deadlines — always shown to the teacher, even when nothing is missed */}
            {teacherView && missed && (() => {
              const bad = missed.items.some(m => m.missingModes.length > 0);
              const c = bad ? 'var(--danger)' : missed.items.length > 0 ? '#d97706' : REVIEW_VERDICT_META.ontrack.color;
              return (
                <div className="px-3 py-2 rounded-xl space-y-2"
                  style={{ background: `color-mix(in srgb, ${c} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 30%, transparent)` }}>
                  <p className="text-xs font-bold" style={{ color: c }}>⏰ {t.missedHomework.header}</p>
                  {missed.items.length > 0
                    ? <MissedHomeworkRows items={missed.items} />
                    : <p className="text-xs" style={{ color: 'var(--text)' }}>{missed.checked > 0 ? t.missedHomework.allOnTime : t.missedHomework.noneDue}</p>}
                </div>
              );
            })()}

            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="py-10 text-center" style={{ color: 'var(--text-muted)' }}>
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm">{t.classXpHistory.noXpYet}</p>
              </div>
            ) : (
              <XpCalendar
                history={calendarEntries}
                onSelectDay={day => setSelectedDay(day)}
                resetSelectionOnMonthChange
                accentColor={accentColor}
                dayBadge={(dateStr, hasXp) => {
                  const hasReview = hasXp && (byDate[dateStr] ?? []).some(e => e.reason === 'SRS Review');
                  if (!hasReview) return null;
                  return (
                    <span
                      title={t.classXpHistory.didReviewTitle}
                      className="absolute top-0 right-0 w-3 h-3 rounded-full flex items-center justify-center"
                      style={{ background: '#06b6d4', boxShadow: '0 0 0 1.5px var(--surface-2)', fontSize: 6 }}
                    >🔄</span>
                  );
                }}
                legendExtra={
                  <span className="flex items-center gap-1.5">
                    <span style={{ fontSize: 11 }}>🔄</span>
                    {t.classXpHistory.didReview}
                  </span>
                }
              />
            )}

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: accentColor }}
            >
              {t.common.gotIt}
            </button>
          </div>

          {/* Day detail (left column) */}
          {selectedDay && (
            <div className="flex-1 flex flex-col min-w-0 border-r overflow-y-auto animate-slide-in-left" style={{ borderColor: 'var(--border)', order: 1 }}>
              <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{selectedDay}</p>
                  <p className="text-lg font-black" style={{ color: accentColor }}>+{displayXP(dayTotal)} XP</p>
                </div>
                <button onClick={() => setSelectedDay(null)} className="text-lg" style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>
              <div className="overflow-y-auto overscroll-contain pb-6">
                {dayGroups.map((g, j) => {
                  const fromTime = exactTime(g.from);
                  const toTime = exactTime(g.to);
                  const time = fromTime === toTime ? fromTime : `${fromTime} – ${toTime}`;
                  const perWord = g.reason === 'SRS Review' || g.reason === 'Learn';
                  const countText = g.count > 1 ? (perWord ? h.wordsCount(g.count) : `×${g.count}`) : '';
                  return (
                    <div key={g.id}>
                      {j > 0 && <div style={{ height: 1, background: 'var(--border)', marginLeft: 52 }} />}
                      <div className="flex items-center gap-3 px-5 py-3">
                        <span className="text-xl shrink-0">{REASON_ICON[g.reason] ?? REASON_ICON[g.reason.split(/[ :(]/)[0]] ?? '⚡'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{reasonLabel(g.reason)}</p>
                          <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{countText ? `${countText} · ${time}` : time}</p>
                        </div>
                        <span className="text-sm font-black shrink-0" style={{ color: accentColor }}>+{displayXP(g.amount)} XP</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary detail (right column) */}
          {showSummary && (
            <div className="flex-1 flex flex-col min-w-0 border-l overflow-y-auto animate-slide-in-right" style={{ borderColor: 'var(--border)', order: 3 }}>
              <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">✨</span>
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{name}</p>
                    <p className="text-sm font-black" style={{ color: accentColor }}>{h.summaryTitle}</p>
                  </div>
                </div>
                <button onClick={() => setShowSummary(false)} className="text-lg" style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>
              <div className="overflow-y-auto overscroll-contain px-5 py-4 space-y-3">
                {[summary, ...smart].map((s, i) => (
                  <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{s}</p>
                ))}
              </div>
            </div>
          )}

          {/* Review Pattern detail (right column) */}
          {showReviewDetail && (
            <div className="flex-1 flex flex-col min-w-0 border-l overflow-y-auto animate-slide-in-right" style={{ borderColor: 'var(--border)', order: 3 }}>
              <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{verdictMeta.emoji}</span>
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{t.classXpHistory.reviewPatternLabel}</p>
                    <p className="text-sm font-black" style={{ color: verdictMeta.color }}>{h.verdictTitle[verdict]}</p>
                  </div>
                </div>
                <button onClick={() => setShowReviewDetail(false)} className="text-lg" style={{ color: 'var(--text-muted)' }}>✕</button>
              </div>

              <div className="overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
                <p className="text-base font-bold leading-snug" style={{ color: 'var(--text)' }}>{summary}</p>

                {/* 30-day review strip — days before joining are faded out */}
                {verdict !== 'new' && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>{t.classXpHistory.last30Days}</p>
                    <div className="grid grid-cols-10 gap-1">
                      {last30Days.map(d => {
                        const count = reviewCountByDay.get(d) ?? 0;
                        const isToday = d === todayStr;
                        const beforeJoin = d < reviewPattern.windowStart;
                        return (
                          <div
                            key={d}
                            title={`${d}${beforeJoin ? ` · ${h.legendBeforeJoin}` : count > 0 ? t.classXpHistory.tooltipReviewedCount(count) : t.classXpHistory.tooltipNoReview}`}
                            className="aspect-square rounded"
                            style={{
                              background: count > 0 ? verdictMeta.color : 'var(--surface-2)',
                              border: count > 0 ? 'none' : beforeJoin ? '1px dashed var(--border)' : '1px solid var(--border)',
                              outline: isToday ? `1.5px solid ${accentColor}` : 'none',
                              outlineOffset: 1,
                              opacity: beforeJoin ? 0.3 : count > 0 ? Math.min(1, 0.45 + count * 0.15) : 1,
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: verdictMeta.color }} />{t.classXpHistory.legendReviewed}</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ border: '1px solid var(--border)' }} />{t.classXpHistory.legendNoReview}</span>
                      {reviewPattern.windowDays < REVIEW_WINDOW_DAYS && (
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ border: '1px dashed var(--border)', opacity: 0.5 }} />{h.legendBeforeJoin}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* The three numbers a teacher acts on */}
                {statTable(verdict === 'new'
                  ? [{ label: h.statInClassSince, value: inClassSinceValue }]
                  : [
                    { label: h.statLastReview, value: lastReviewValue },
                    { label: h.statWaiting, value: overdueCount > 0 ? fill(h.statWaitingValue, { n: dueCount, m: overdueCount }) : `${dueCount}`, color: overdueCount > 0 ? REVIEW_VERDICT_META.stopped.color : undefined },
                    { label: h.statDaysPracticed, value: fill(h.statDaysPracticedValue, { n: reviewPattern.daysReviewed, w: reviewPattern.windowDays }) },
                  ])}

                {!isSelf && (
                  composing ? (
                    <MessageComposer draft={fill(dueCount > 0 ? h.draftReview : h.draftReviewNoDue, { name, n: dueCount })} classId={classId} studentId={userId} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setComposing(true)}
                      className="text-sm font-bold text-white px-4 py-2 rounded-xl"
                      style={{ background: accentColor }}
                    >
                      {h.sendReminder}
                    </button>
                  )
                )}

                {/* Everything else stays one tap away */}
                {verdict !== 'new' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowDetails(v => !v)}
                      className="text-xs font-bold"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {showDetails ? h.hideDetails : h.moreDetails} {showDetails ? '▴' : '▾'}
                    </button>
                    {showDetails && (
                      <div className="mt-2">
                        {statTable([
                          { label: h.statCurrentStreak, value: fill(h.statDays, { n: reviewPattern.streak }) },
                          { label: h.statLongestGap, value: reviewPattern.lastReviewDate === null ? '—' : fill(h.statDays, { n: reviewPattern.longestGap }) },
                          { label: h.statAvgWordsPerDay, value: reviewPattern.totalReviews > 0 ? reviewPattern.avgPerActiveDay.toFixed(1) : '—' },
                          { label: h.statTotalReviews, value: `${reviewPattern.totalReviews}` },
                          { label: h.statPattern, value: h.patternText[reviewPattern.label] },
                          { label: h.statInClassSince, value: inClassSinceValue },
                        ])}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
