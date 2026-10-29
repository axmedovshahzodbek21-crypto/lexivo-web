'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useClassInsights } from '@/components/insights/useClassInsights';
import { MessageComposer } from '@/components/insights/InsightPopup';
import WeekDots from '@/components/insights/WeekDots';
import LessonCard from '@/components/insights/LessonCard';
import StudentSummary from '@/components/StudentSummary';
import {
  type Change, type Lang, type MessageKind, type PrevRow, type SentNote, type StudentInsight,
  changeOf, dotColor, groupOf, loadLatestNotes, loadPrevRows, noteOutcome,
  suggestedAction, tashkentDate, weekdayName,
} from '@/lib/class-insights';
import { loadArchiveStates } from '@/lib/class-hard-words';
import { loadClassSummaries, type StudentSummaryResult } from '@/lib/class-summaries';
import type { SummarySentence } from '@/lib/student-summary';

// Card text comes from the per-student summary engine (lib/student-summary.ts);
// the nightly snapshot only decides the grouping (needs / watch / fine).
const plain = (s: SummarySentence | null | undefined) => (s ?? []).map(g => g.text).join('');

type T = ReturnType<typeof useClassInsights>['tt']['classInsights'];

// "Skip for today" lives in this browser only; sending a note is what
// marks a card done everywhere (read back from class_notes).
const skipKey = (classId: string, date: string) => `lexivo_insights_skip_${classId}_${date}`;
function readSkips(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
}
function writeSkips(key: string, ids: string[]) {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* private mode */ }
}

const actionTitle = (t: T, k: MessageKind) =>
  ({ reminder: t.actionReminder, checkin: t.actionCheckin, praise: t.actionPraise, message: t.actionMessage })[k];
const actionDraft = (t: T, k: MessageKind, name: string) =>
  ({ reminder: t.draftReminder, checkin: t.draftCheckin, praise: t.draftPraise, message: t.draftMessage })[k].replace('{name}', name);

function ChangeBadge({ change, t }: { change: Change; t: T }) {
  if (!change) return null;
  const [label, color] = change === 'worse' ? [t.changeWorse, 'var(--danger)']
    : change === 'better' ? [t.changeBetter, 'var(--success)'] : [t.changeBack, 'var(--success)'];
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md shrink-0"
      style={{ color, border: `1px solid ${color}` }}>
      {label}
    </span>
  );
}

function LoopLine({ s, note, lang, t }: { s: StudentInsight; note: SentNote | undefined; lang: Lang; t: T }) {
  if (!note) return null;
  const outcome = noteOutcome(s, note);
  const parts = [
    t.loopSent.replace('{day}', weekdayName(tashkentDate(note.created_at), lang)),
    note.read_at ? `${t.loopRead} ✓` : t.loopUnread,
    outcome === 'did' ? t.loopDid : outcome === 'not' ? t.loopNot : null,
  ].filter(Boolean);
  return <p className="text-xs text-[var(--text-muted)]">📨 {parts.join(' · ')}</p>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl p-5 space-y-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-bold text-[var(--text)]">{title}</p>
          <button onClick={onClose} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// One personal note per student, each with its own ready text, sent together.
function BatchComposer({ students, classId, nameOf, t, onSent }: {
  students: StudentInsight[]; classId: string; nameOf: (id: string) => string; t: T; onSent: (ids: string[]) => void;
}) {
  const { user } = useAuth();
  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(students.map(s => [s.student_id, actionDraft(t, suggestedAction(s), nameOf(s.student_id))])));
  const [picked, setPicked] = useState<Set<string>>(() => new Set(students.map(s => s.student_id)));
  const [editing, setEditing] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [sentCount, setSentCount] = useState(0);
  const ids = students.map(s => s.student_id).filter(id => picked.has(id) && texts[id]?.trim());

  const send = async () => {
    if (!user || ids.length === 0) return;
    setState('sending');
    const { error } = await supabase.from('class_notes').insert(
      ids.map(id => ({ class_id: classId, student_id: id, teacher_id: user.id, message: texts[id].trim() })));
    if (error) { setState('failed'); return; }
    setSentCount(ids.length);
    setState('sent');
    onSent(ids);
  };

  if (state === 'sent') {
    return <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>{t.batchSent.replace('{n}', String(sentCount))}</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {students.map(s => {
          const id = s.student_id;
          return (
            <li key={id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={picked.has(id)}
                  onChange={e => setPicked(p => { const n = new Set(p); if (e.target.checked) n.add(id); else n.delete(id); return n; })}
                  className="accent-[var(--primary)]"
                />
                <span className="flex-1 text-sm font-bold text-[var(--text)] truncate">{nameOf(id)}</span>
                <button type="button" onClick={() => setEditing(editing === id ? null : id)} className="text-xs font-semibold text-[var(--primary)]">
                  {t.edit}
                </button>
              </div>
              {editing === id ? (
                <textarea
                  value={texts[id]}
                  onChange={e => setTexts(x => ({ ...x, [id]: e.target.value }))}
                  rows={3}
                  className="w-full text-sm rounded-xl p-3 resize-y text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                />
              ) : (
                <p className={`text-xs text-[var(--text-muted)] line-clamp-2 pl-6 ${picked.has(id) ? '' : 'opacity-50'}`}>{texts[id]}</p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={send}
          disabled={state === 'sending' || ids.length === 0}
          className="text-sm font-bold text-white px-4 py-2 rounded-xl disabled:opacity-50"
          style={{ background: 'var(--primary)' }}
        >
          {state === 'sending' ? t.sending : t.batchSend.replace('{n}', String(ids.length))}
        </button>
      </div>
      {state === 'failed' && <p className="text-xs" style={{ color: 'var(--danger)' }}>{t.sendFailed}</p>}
    </div>
  );
}

export default function ClassInsightsListPage() {
  const { id } = useParams<{ id: string }>();
  const { loading, notTeacher, className, data, sorted, lang, nameOf, tt } = useClassInsights(id);
  const t = tt.classInsights;

  const [prev, setPrev] = useState<Record<string, PrevRow>>({});
  const [notes, setNotes] = useState<Record<string, SentNote>>({});
  const [skips, setSkips] = useState<string[]>([]);
  const [compose, setCompose] = useState<StudentInsight | null>(null);
  const [batch, setBatch] = useState(false);
  const [open, setOpen] = useState({ handled: false, watch: true, fine: false });

  const [taught, setTaught] = useState<Set<string>>(new Set());
  const [summaries, setSummaries] = useState<Record<string, StudentSummaryResult> | null>(null);
  const [summaryFor, setSummaryFor] = useState<StudentInsight | null>(null);

  const studentKey = sorted.map(s => s.student_id).join(',');
  useEffect(() => {
    if (!studentKey) return;
    let cancelled = false;
    loadClassSummaries(id, sorted.map(s => ({ id: s.student_id, name: nameOf(s.student_id) })), lang, tt)
      .then(r => { if (!cancelled) setSummaries(r); })
      .catch(e => console.error('[insights] summaries', e));
    return () => { cancelled = true; };
  }, [id, studentKey, lang, tt]); // eslint-disable-line react-hooks/exhaustive-deps

  const snapshotDate = data?.classRow.snapshot_date;
  useEffect(() => {
    if (!data || !snapshotDate) return;
    let cancelled = false;
    setSkips(readSkips(skipKey(id, snapshotDate)));
    // Who has each word on their Hard list, for the taught-words check.
    const hardBy = new Map<string, string[]>();
    for (const r of data.rows) for (const w of r.hard_words?.own ?? []) hardBy.set(w, [...(hardBy.get(w) ?? []), r.student_id]);
    Promise.all([loadPrevRows(id, snapshotDate), loadLatestNotes(id), loadArchiveStates(id, hardBy)]).then(([p, n, a]) => {
      if (cancelled) return;
      setPrev(p);
      setNotes(n);
      setTaught(new Set([...a].filter(([, v]) => v.state !== 'again').map(([w]) => w)));
    });
    return () => { cancelled = true; };
  }, [id, data, snapshotDate]);

  if (loading) {
    return <div className="flex justify-center py-16"><div className="text-4xl animate-bounce">✨</div></div>;
  }
  if (notTeacher) {
    return <p className="p-8 text-center text-[var(--text-muted)]">{tt.classesPage.onlyTeacherDashboard}</p>;
  }

  const header = (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-black text-[var(--text)]">✨ {t.title}</h1>
        <p className="text-sm text-[var(--text-muted)] truncate">{className}</p>
      </div>
      <p className="text-[10px] text-[var(--text-muted)] shrink-0">{t.updatedDaily}</p>
    </div>
  );

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {header}
        <div className="card"><p className="text-sm text-[var(--text-muted)]">{t.notReady}</p></div>
      </div>
    );
  }

  const today = tashkentDate();
  const isHandled = (s: StudentInsight) =>
    skips.includes(s.student_id) || (notes[s.student_id] && tashkentDate(notes[s.student_id].created_at) === today);
  const change = (s: StudentInsight) => changeOf(s, prev[s.student_id]);

  // Within "needs you": what changed since yesterday first, then the usual urgency order.
  const needs = sorted.filter(s => groupOf(s) === 'needs');
  const needsOpen = needs.filter(s => !isHandled(s)).sort((a, b) => Number(change(b) === 'worse') - Number(change(a) === 'worse'));
  const needsDone = needs.filter(isHandled);
  const watch = sorted.filter(s => groupOf(s) === 'watch');
  const fine = sorted.filter(s => groupOf(s) === 'fine');

  const markSent = (ids: string[]) => {
    const now = new Date().toISOString();
    setNotes(n => ({ ...n, ...Object.fromEntries(ids.map(sid => [sid, { student_id: sid, created_at: now, read_at: null }])) }));
  };
  const skip = (sid: string) => {
    const next = [...skips, sid];
    setSkips(next);
    writeSkips(skipKey(id, data.classRow.snapshot_date), next);
  };

  const headline = (s: StudentInsight) => plain(summaries?.[s.student_id]?.headline);
  const suggestion = (s: StudentInsight) => plain(summaries?.[s.student_id]?.suggestion);
  const h = tt.classXpHistory;
  const reasonLabel = (r: string) =>
    h.reasonLabels[r] ?? (r.startsWith('Reading: ') ? `${h.readingPrefix}: ${r.slice('Reading: '.length)}` : r);

  const nameLine = (s: StudentInsight) => (
    <div className="flex items-center gap-2 min-w-0">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dotColor(s) }} />
      <p className="font-bold text-[var(--text)] truncate">{nameOf(s.student_id)}</p>
      <ChangeBadge change={change(s)} t={t} />
      <span className="flex-1" />
      <WeekDots days={s.days} lang={lang} />
    </div>
  );

  const needsCard = (s: StudentInsight) => {
    const line = headline(s);
    const next = suggestion(s);
    const action = suggestedAction(s);
    return (
      <li key={s.student_id} className="card space-y-2" style={{ padding: 14 }}>
        {nameLine(s)}
        {summaries === null ? <p className="text-sm text-[var(--text-muted)]">…</p> : (
          <>
            {line && <p className="text-sm text-[var(--text)] leading-snug">{line}</p>}
            {next && <p className="text-xs text-[var(--text-muted)] leading-snug">💡 {next}</p>}
          </>
        )}
        <LoopLine s={s} note={notes[s.student_id]} lang={lang} t={t} />
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => setCompose(s)}
            className="text-sm font-bold text-white px-4 py-2 rounded-xl"
            style={{ background: 'var(--primary)' }}
          >
            {actionTitle(t, action)}
          </button>
          <button type="button" onClick={() => skip(s.student_id)} className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)]">
            {t.skip}
          </button>
          <span className="flex-1" />
          <button type="button" onClick={() => setSummaryFor(s)} className="text-xs font-semibold text-[var(--primary)]">{h.summaryTitle} ›</button>
        </div>
      </li>
    );
  };

  const compactRow = (s: StudentInsight, withAction: boolean) => {
    const line = headline(s);
    const sentToday = notes[s.student_id] && tashkentDate(notes[s.student_id].created_at) === today;
    return (
      <li key={s.student_id} className="px-4 py-3 space-y-1">
        <button type="button" onClick={() => setSummaryFor(s)} className="block w-full text-left space-y-1 hover:opacity-80">
          {nameLine(s)}
          {line && <p className="text-sm text-[var(--text-muted)] truncate">{line}</p>}
        </button>
        <LoopLine s={s} note={notes[s.student_id]} lang={lang} t={t} />
        {withAction && !sentToday && (
          <button type="button" onClick={() => setCompose(s)} className="text-xs font-bold text-[var(--primary)]">
            {actionTitle(t, suggestedAction(s))} →
          </button>
        )}
      </li>
    );
  };

  const section = (title: string, count: number, key: keyof typeof open, body: React.ReactNode) => (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(o => ({ ...o, [key]: !o[key] }))}
        className="w-full flex items-center justify-between text-left"
      >
        <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">{title} · {count}</h2>
        <span className="text-xs font-semibold text-[var(--primary)]">{open[key] ? t.hide : t.show}</span>
      </button>
      {open[key] && body}
    </section>
  );

  const triage = needs.length === 0 ? t.triageNone
    : needsOpen.length === 0 ? t.triageAllDone
    : t.triageNeeds.replace('{n}', String(needsOpen.length));

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5 animate-fade-in">
      {header}

      <div className="card flex items-center justify-between gap-3 flex-wrap" style={{ padding: 16 }}>
        <p className="text-lg font-black text-[var(--text)] leading-snug">{triage}</p>
        {needsOpen.length >= 2 && (
          <button
            type="button"
            onClick={() => setBatch(true)}
            className="text-sm font-bold px-4 py-2 rounded-xl"
            style={{ background: 'var(--primary-bg)', color: 'var(--primary)', border: '1px solid var(--primary)' }}
          >
            {t.messageAll.replace('{n}', String(needsOpen.length))}
          </button>
        )}
      </div>

      {needs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--danger)' }}>{t.groupNeeds} · {needs.length}</h2>
          {needsOpen.length > 0 && <ul className="space-y-3">{needsOpen.map(needsCard)}</ul>}
          {needsDone.length > 0 && (
            <div>
              <button type="button" onClick={() => setOpen(o => ({ ...o, handled: !o.handled }))} className="text-xs font-semibold text-[var(--text-muted)]">
                {open.handled ? '▾' : '▸'} {t.handledToday.replace('{n}', String(needsDone.length))}
              </button>
              {open.handled && (
                <ul className="card divide-y divide-[var(--border)] mt-2" style={{ padding: 0 }}>
                  {needsDone.map(s => compactRow(s, false))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      <LessonCard classId={id} words={data.classRow.hard_words} taught={taught} />

      {watch.length > 0 && section(t.groupWatch, watch.length, 'watch',
        <ul className="card divide-y divide-[var(--border)]" style={{ padding: 0 }}>{watch.map(s => compactRow(s, true))}</ul>)}

      {fine.length > 0 && section(t.groupFine, fine.length, 'fine',
        <ul className="card divide-y divide-[var(--border)]" style={{ padding: 0 }}>{fine.map(s => compactRow(s, s.kind === 'level'))}</ul>)}

      {compose && (
        <Modal title={`${actionTitle(t, suggestedAction(compose))} — ${nameOf(compose.student_id)}`} onClose={() => setCompose(null)}>
          <MessageComposer
            draft={actionDraft(t, suggestedAction(compose), nameOf(compose.student_id))}
            classId={id}
            studentId={compose.student_id}
            onSent={() => { markSent([compose.student_id]); setTimeout(() => setCompose(null), 900); }}
          />
        </Modal>
      )}

      {summaryFor && (
        <Modal title={`${nameOf(summaryFor.student_id)} — ${h.summaryTitle}`} onClose={() => setSummaryFor(null)}>
          {summaries?.[summaryFor.student_id] ? (
            <StudentSummary
              sentences={summaries[summaryFor.student_id].main}
              more={summaries[summaryFor.student_id].more}
              classId={id}
              accentColor="var(--primary)"
              reasonLabel={reasonLabel}
            />
          ) : <p className="text-sm text-[var(--text-muted)]">…</p>}
        </Modal>
      )}

      {batch && (
        <Modal title={t.batchTitle} onClose={() => setBatch(false)}>
          <BatchComposer
            students={needsOpen}
            classId={id}
            nameOf={nameOf}
            t={t}
            onSent={ids => { markSent(ids); setTimeout(() => setBatch(false), 900); }}
          />
        </Modal>
      )}
    </div>
  );
}
