'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useClassInsights } from '@/components/insights/useClassInsights';
import InsightText from '@/components/insights/InsightText';
import InsightPopup from '@/components/insights/InsightPopup';
import {
  type ChipAction, type DayInfo, type LearnTask, type ReviewDay,
  dotColor, fmtDate, homeworkName, renderParagraph, trendArrow, weekCounts, weekdayName, weekdayShort,
} from '@/lib/class-insights';

const STATUS_ICON: Record<string, string> = { done: '✅', late: '⏰', open: '❌', missed: '❌' };

function dayIcon(d: DayInfo): string {
  if (d.before_join) return '·';
  if (d.missed) return '❌';
  if ((d.learn_due ?? 0) > 0 || d.review_due) return '✅';
  return d.active ? '🔹' : '⬜';
}

export default function StudentInsightPage() {
  const { id, studentId } = useParams<{ id: string; studentId: string }>();
  const { loading, notTeacher, data, sorted, lang, nameOf, tt, query } = useClassInsights(id);
  const t = tt.classInsights;
  const [popup, setPopup] = useState<ChipAction | null>(null);

  if (loading) {
    return <div className="flex justify-center py-16"><div className="text-4xl animate-bounce">✨</div></div>;
  }
  if (notTeacher) {
    return <p className="p-8 text-center text-[var(--text-muted)]">{tt.classesPage.onlyTeacherDashboard}</p>;
  }

  const index = sorted.findIndex(r => r.student_id === studentId);
  const s = index >= 0 ? sorted[index] : null;
  const back = (
    <Link href={`/classes/${id}/insights${query}`} className="text-sm font-semibold text-[var(--primary)]">← {t.title}</Link>
  );

  if (!data || !s) {
    return (
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {back}
        <div className="card"><p className="text-sm text-[var(--text-muted)]">{t.notReady}</p></div>
      </div>
    );
  }

  const name = nameOf(s.student_id);
  const paragraph = renderParagraph(s, data.templates, name, lang);
  const prev = index > 0 ? sorted[index - 1] : null;
  const next = index < sorted.length - 1 ? sorted[index + 1] : null;
  const classHard = Object.fromEntries(data.classRow.hard_words.map(h => [h.word, h.students]));
  const thisWeek = s.tasks?.this_week;
  const lastCounts = weekCounts(s.tasks?.last_week);

  const learnRow = (task: LearnTask) => (
    <li key={task.homework_id} className="flex items-center gap-2 text-sm">
      <span>{STATUS_ICON[task.status]}</span>
      <span className="flex-1 min-w-0 truncate text-[var(--text)]">{homeworkName(task)}</span>
      <span className="text-xs text-[var(--text-muted)] shrink-0">{weekdayShort(task.due_date, lang)} {fmtDate(task.due_date).slice(0, 5)}</span>
    </li>
  );
  const reviewRow = (r: ReviewDay) => (
    <li key={r.date}>
      <button onClick={() => setPopup({ type: 'day', date: r.date })} className="w-full flex items-center gap-2 text-sm text-left hover:opacity-80">
        <span>{STATUS_ICON[r.status]}</span>
        <span className="flex-1 text-[var(--text)]">{weekdayName(r.date, lang)}</span>
        <span className="text-xs text-[var(--text-muted)]">{t.wordsDue.replace('{n}', String(r.due_count))}</span>
      </button>
    </li>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        {back}
        <div className="flex gap-3 text-sm font-semibold">
          {prev
            ? <Link href={`/classes/${id}/insights/${prev.student_id}${query}`} className="text-[var(--primary)]">‹ {t.prev}</Link>
            : <span className="text-[var(--text-muted)] opacity-50">‹ {t.prev}</span>}
          {next
            ? <Link href={`/classes/${id}/insights/${next.student_id}${query}`} className="text-[var(--primary)]">{t.next} ›</Link>
            : <span className="text-[var(--text-muted)] opacity-50">{t.next} ›</span>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: dotColor(s) }} />
        <h1 className="text-2xl font-black text-[var(--text)] truncate">{name}</h1>
        <p className="text-sm text-[var(--text-muted)] shrink-0">{s.score !== null ? `${s.score}%` : '—'} {trendArrow(s.trend)}</p>
      </div>

      <div className="card space-y-2" style={{ padding: 18 }}>
        <p className="text-base leading-relaxed text-[var(--text)]">
          {paragraph.map((segs, i) => (
            <span key={i} className={i === 0 ? 'font-bold' : ''}>
              <InsightText segments={segs} onChip={setPopup} />{' '}
            </span>
          ))}
        </p>
      </div>

      <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] pt-2">{t.rawData}</h2>

      {s.days && (
        <div className="card space-y-2" style={{ padding: 14 }}>
          <p className="text-xs font-bold text-[var(--text-muted)]">{t.weekStrip}</p>
          <div className="grid grid-cols-7 gap-1.5">
            {s.days.map(d => (
              <button
                key={d.date}
                disabled={d.before_join}
                onClick={() => setPopup({ type: 'day', date: d.date })}
                className="flex flex-col items-center gap-1 py-2 rounded-xl disabled:opacity-40 hover:bg-[var(--surface-2)] transition-colors"
              >
                <span className="text-[10px] font-bold text-[var(--text-muted)]">{weekdayShort(d.date, lang)}</span>
                <span className="text-lg leading-none">{dayIcon(d)}</span>
                <span className="text-[10px] text-[var(--text-muted)]">{fmtDate(d.date).slice(0, 5)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card space-y-3" style={{ padding: 14 }}>
          <button onClick={() => setPopup({ type: 'week', week: 'this' })} className="w-full flex justify-between text-left">
            <span className="text-xs font-bold text-[var(--text-muted)]">{t.thisWeek}</span>
            <span className="text-xs font-bold text-[var(--text)]">{s.done}/{s.total}{s.score !== null ? ` (${s.score}%)` : ''}</span>
          </button>
          {thisWeek && thisWeek.learn.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-[var(--text-muted)] mb-1">{t.learnTasksTitle}</p>
              <ul className="space-y-1.5">{thisWeek.learn.map(learnRow)}</ul>
            </div>
          )}
          {thisWeek && thisWeek.review.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-[var(--text-muted)] mb-1">{t.reviewDaysTitle}</p>
              <ul className="space-y-1.5">{thisWeek.review.map(reviewRow)}</ul>
            </div>
          )}
          {(!thisWeek || (thisWeek.learn.length === 0 && thisWeek.review.length === 0)) && (
            <p className="text-sm text-[var(--text-muted)]">{t.noTasks}</p>
          )}
        </div>

        <div className="card space-y-3" style={{ padding: 14 }}>
          <button onClick={() => setPopup({ type: 'week', week: 'last' })} className="w-full flex justify-between text-left">
            <span className="text-xs font-bold text-[var(--text-muted)]">{t.lastWeek}</span>
            <span className="text-xs font-bold text-[var(--text)]">
              {lastCounts.done}/{lastCounts.total}{lastCounts.pct !== null ? ` (${lastCounts.pct}%)` : ''}
            </span>
          </button>
          <button onClick={() => setPopup({ type: 'hard' })} className="w-full text-left space-y-1">
            <p className="text-xs font-bold text-[var(--text-muted)]">{t.hardOwn}</p>
            <p className="text-sm italic text-[var(--text)]">
              {(s.hard_words?.own ?? []).length > 0 ? s.hard_words!.own.join(', ') : t.noHard}
            </p>
          </button>
        </div>
      </div>

      {popup && (
        <InsightPopup
          action={popup}
          student={s}
          name={name}
          lang={lang}
          classId={id}
          classHard={classHard}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}
