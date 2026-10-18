'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/useTranslation';
import {
  type ChipAction, type Lang, type LearnTask, type ReviewDay, type StudentInsight,
  fmtDate, homeworkName, weekdayName,
} from '@/lib/class-insights';

interface ReviewEvent { word: string; knew: boolean; response_ms: number | null; }

const STATUS_ICON: Record<string, string> = { done: '✅', late: '⏰', open: '❌', missed: '❌' };

// Ready-made text the teacher can send as is, edit, or replace with their
// own. Sends through class_notes — the same teacher notes the dashboard's
// Notes button writes, which students see on their Classes page.
function MessageComposer({ draft, classId, studentId }: { draft: string; classId: string; studentId: string }) {
  const { user } = useAuth();
  const t = useTranslation().classInsights;
  const [text, setText] = useState(draft);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const send = async () => {
    if (!user || !text.trim()) return;
    setState('sending');
    const { error } = await supabase.from('class_notes').insert({
      class_id: classId, student_id: studentId, teacher_id: user.id, message: text.trim(),
    });
    setState(error ? 'failed' : 'sent');
  };

  if (state === 'sent') {
    return <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>{t.sent}</p>;
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={e => { setText(e.target.value); if (state === 'failed') setState('idle'); }}
        rows={4}
        className="w-full text-sm rounded-xl p-3 resize-y text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setText(text === draft ? '' : draft)}
          className="text-xs font-semibold text-[var(--primary)]"
        >
          {text === draft ? t.writeOwn : t.useDraft}
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={send}
          disabled={state === 'sending' || !text.trim()}
          className="text-sm font-bold text-white px-4 py-2 rounded-xl disabled:opacity-50"
          style={{ background: 'var(--primary)' }}
        >
          {state === 'sending' ? t.sending : t.send}
        </button>
      </div>
      {state === 'failed' && <p className="text-xs" style={{ color: 'var(--danger)' }}>{t.sendFailed}</p>}
    </div>
  );
}

function fmtSeconds(ms: number): string {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}

export default function InsightPopup({ action, student, name, lang, classId, classHard, onClose }: {
  action: ChipAction;
  student: StudentInsight;
  name: string;
  lang: Lang;
  classId: string;
  classHard: Record<string, number>;
  onClose: () => void;
}) {
  const tt = useTranslation();
  const t = tt.classInsights;
  const thisWeek = student.tasks?.this_week;
  const dayLabel = (iso: string) => `${weekdayName(iso, lang)}, ${fmtDate(iso)}`;

  const statusText = (s: string) =>
    s === 'done' ? t.statusDone : s === 'late' ? t.statusLate : s === 'open' ? t.statusOpen : t.statusMissed;

  const taskRow = (task: LearnTask) => (
    <li key={task.homework_id} className="flex items-start gap-2 text-sm">
      <span className="shrink-0">{STATUS_ICON[task.status]}</span>
      <div className="min-w-0">
        <p className="text-[var(--text)] font-semibold truncate">{homeworkName(task)}</p>
        <p className="text-xs text-[var(--text-muted)]">
          {t.due}: {dayLabel(task.due_date)} · {statusText(task.status)}
          {task.status === 'late' && task.completed_at ? ` · ${t.finished}: ${fmtDate(task.completed_at)}` : ''}
        </p>
      </div>
    </li>
  );

  const reviewRow = (r: ReviewDay) => (
    <li key={r.date} className="flex items-start gap-2 text-sm">
      <span className="shrink-0">{STATUS_ICON[r.status]}</span>
      <div className="min-w-0">
        <p className="text-[var(--text)] font-semibold">{dayLabel(r.date)}</p>
        <p className="text-xs text-[var(--text-muted)]">{t.wordsDue.replace('{n}', String(r.due_count))} · {statusText(r.status)}</p>
      </div>
    </li>
  );

  // A day's reviews, read live — class_review_events lets the teacher read
  // their class. Days are Asia/Tashkent (UTC+5, no DST).
  const [events, setEvents] = useState<ReviewEvent[] | null>(null);
  const dayDate = action.type === 'day' ? action.date : null;
  useEffect(() => {
    if (!dayDate) return;
    let cancelled = false;
    const next = new Date(dayDate + 'T00:00:00+05:00');
    next.setUTCDate(next.getUTCDate() + 1);
    supabase
      .from('class_review_events')
      .select('word, knew, response_ms')
      .eq('class_id', classId)
      .eq('user_id', student.student_id)
      .gte('created_at', `${dayDate}T00:00:00+05:00`)
      .lt('created_at', next.toISOString())
      .order('created_at')
      .then(({ data }) => { if (!cancelled) setEvents((data as ReviewEvent[]) ?? []); });
    return () => { cancelled = true; };
  }, [dayDate, classId, student.student_id]);

  let title = '';
  let body: React.ReactNode = null;

  if (action.type === 'week') {
    const w = action.week === 'this' ? thisWeek : student.tasks?.last_week;
    title = action.week === 'this' ? t.thisWeek : t.lastWeek;
    body = !w || (w.learn.length === 0 && w.review.length === 0) ? (
      <p className="text-sm text-[var(--text-muted)]">{t.noTasks}</p>
    ) : (
      <div className="space-y-4">
        {w.learn.length > 0 && (
          <section>
            <p className="text-xs font-bold text-[var(--text-muted)] mb-2">{t.learnTasksTitle}</p>
            <ul className="space-y-2">{w.learn.map(taskRow)}</ul>
          </section>
        )}
        {w.review.length > 0 && (
          <section>
            <p className="text-xs font-bold text-[var(--text-muted)] mb-2">{t.reviewDaysTitle}</p>
            <ul className="space-y-2">{w.review.map(reviewRow)}</ul>
          </section>
        )}
      </div>
    );
  } else if (action.type === 'day') {
    title = dayLabel(action.date);
    const learn = (thisWeek?.learn ?? []).filter(x => x.due_date === action.date);
    const review = (thisWeek?.review ?? []).find(r => r.date === action.date);
    const timed = (events ?? []).filter(e => e.response_ms !== null);
    const totalMs = timed.reduce((sum, e) => sum + (e.response_ms ?? 0), 0);
    body = (
      <div className="space-y-4">
        {learn.length > 0 && (
          <section>
            <p className="text-xs font-bold text-[var(--text-muted)] mb-2">{t.learnTasksTitle}</p>
            <ul className="space-y-2">{learn.map(taskRow)}</ul>
          </section>
        )}
        {review && (
          <section>
            <p className="text-xs font-bold text-[var(--text-muted)] mb-1">{t.reviewDaysTitle}</p>
            <p className="text-sm text-[var(--text)]">{STATUS_ICON[review.status]} {t.wordsDue.replace('{n}', String(review.due_count))}</p>
            {review.remaining_words.length > 0 && (
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {t.notReviewed}: <span className="italic text-[var(--text)]">{review.remaining_words.join(', ')}</span>
              </p>
            )}
          </section>
        )}
        <section>
          <p className="text-xs font-bold text-[var(--text-muted)] mb-2">{t.reviewedThatDay}</p>
          {events === null ? (
            <p className="text-sm text-[var(--text-muted)]">…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">—</p>
          ) : (
            <>
              <ul className="flex flex-wrap gap-1.5">
                {events.map((e, i) => (
                  <li key={i} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                    {e.knew ? '✅' : '❌'} {e.word}{e.response_ms !== null ? ` · ${fmtSeconds(e.response_ms)}` : ''}
                  </li>
                ))}
              </ul>
              {timed.length > 0 && (
                <dl className="mt-3 grid grid-cols-[auto_auto] justify-start gap-x-6 gap-y-1 text-xs">
                  <dt className="text-[var(--text-muted)]">{t.answerTimeTotal}</dt>
                  <dd className="text-[var(--text)] font-semibold">{fmtSeconds(totalMs)}</dd>
                  <dt className="text-[var(--text-muted)]">{t.answerTimeAvg}</dt>
                  <dd className="text-[var(--text)] font-semibold">{fmtSeconds(totalMs / timed.length)}</dd>
                </dl>
              )}
              <p className="text-[10px] text-[var(--text-muted)] mt-2">{t.answerTimeNote}</p>
            </>
          )}
        </section>
        {learn.length === 0 && !review && events !== null && events.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">{t.nothingThatDay}</p>
        )}
      </div>
    );
  } else if (action.type === 'open' || action.type === 'late') {
    const status = action.type === 'open' ? 'open' : 'late';
    title = action.type === 'open' ? t.openTitle : t.lateTitle;
    const list = (thisWeek?.learn ?? []).filter(x => x.status === status);
    const draft = (action.type === 'open' ? t.draftReminder : t.draftLate).replace('{name}', name);
    body = (
      <div className="space-y-4">
        <ul className="space-y-2">{list.map(taskRow)}</ul>
        <section>
          <p className="text-xs font-bold text-[var(--text-muted)] mb-2">{action.type === 'open' ? t.actionReminder : t.actionLate}</p>
          <MessageComposer draft={draft} classId={classId} studentId={student.student_id} />
        </section>
      </div>
    );
  } else if (action.type === 'hard') {
    title = t.hardOwn;
    const own = student.hard_words?.own ?? [];
    const shared = new Set(student.hard_words?.shared ?? []);
    body = own.length === 0 ? (
      <p className="text-sm text-[var(--text-muted)]">{t.noHard}</p>
    ) : (
      <div className="space-y-3">
        <ul className="flex flex-wrap gap-1.5">
          {own.map(w => (
            <li key={w} className="text-sm px-2.5 py-1 rounded-lg italic"
              style={{ background: shared.has(w) ? 'var(--primary-bg)' : 'var(--surface-2)', border: shared.has(w) ? '1px solid var(--primary)' : '1px solid transparent' }}>
              {w}{shared.has(w) && classHard[w] ? ` · ${t.studentsCount.replace('{n}', String(classHard[w]))}` : ''}
            </li>
          ))}
        </ul>
        {shared.size > 0 && <p className="text-xs text-[var(--text-muted)]">▢ {t.hardShared}</p>}
        <Link href={`/classes/${classId}/hard-words`} className="inline-block text-sm font-semibold text-[var(--primary)]">{t.hardPageLink}</Link>
      </div>
    );
  } else {
    const titles = { reminder: t.actionReminder, checkin: t.actionCheckin, praise: t.actionPraise, message: t.actionMessage };
    const drafts = { reminder: t.draftReminder, checkin: t.draftCheckin, praise: t.draftPraise, message: t.draftMessage };
    title = titles[action.action];
    body = <MessageComposer draft={drafts[action.action].replace('{name}', name)} classId={classId} studentId={student.student_id} />;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl p-5 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-bold text-[var(--text)]">{title}</p>
          <button onClick={onClose} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]" aria-label={t.close}>✕</button>
        </div>
        {body}
      </div>
    </div>
  );
}
