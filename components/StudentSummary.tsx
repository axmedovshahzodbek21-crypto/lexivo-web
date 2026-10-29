'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { displayXP } from '@/lib/storage';
import { modeLabel } from '@/app/classes/[id]/homework/_shared';
import type { Evidence, SummarySentence } from '@/lib/student-summary';

const fmtYmd = (ymd: string) => ymd.split('-').reverse().join('.');
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtDateTime = (iso: string) => `${fmtYmd(new Date(iso).toLocaleDateString('en-CA'))} ${fmtTime(iso)}`;

// The teacher's per-student summary (lib/student-summary.ts), as one
// paragraph. Phrases that make a claim are tappable; tapping one shows the
// facts behind it under the paragraph.
export default function StudentSummary({ sentences, classId, accentColor, reasonLabel }: {
  sentences: SummarySentence[];
  classId: string;
  accentColor: string;
  reasonLabel: (reason: string) => string;
}) {
  const [open, setOpen] = useState<{ s: number; g: number } | null>(null);
  const toggle = (s: number, g: number) => setOpen(open?.s === s && open.g === g ? null : { s, g });
  const ev = open ? sentences[open.s]?.[open.g]?.evidence : undefined;
  return (
    <div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
        {sentences.map((sentence, s) => (
          <span key={s}>
            {s > 0 && ' '}
            {sentence.map((seg, g) => seg.evidence ? (
              <span
                key={g}
                role="button"
                tabIndex={0}
                onClick={() => toggle(s, g)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(s, g); } }}
                className="cursor-pointer font-semibold"
                style={{
                  color: accentColor, borderBottom: `1.5px dotted ${accentColor}`,
                  background: open?.s === s && open.g === g ? `color-mix(in srgb, ${accentColor} 15%, transparent)` : undefined,
                }}
              >{seg.text}</span>
            ) : <span key={g}>{seg.text}</span>)}
          </span>
        ))}
      </p>
      {ev && <EvidenceCard evidence={ev} classId={classId} accentColor={accentColor} reasonLabel={reasonLabel} />}
    </div>
  );
}

function EvidenceCard({ evidence, classId, accentColor, reasonLabel }: {
  evidence: Evidence; classId: string; accentColor: string; reasonLabel: (r: string) => string;
}) {
  const tt = useTranslation();
  const t = tt.studentSummary;
  const router = useRouter();
  const row = 'px-3 py-2.5 text-xs space-y-0.5';
  const muted = { color: 'var(--text-muted)' };

  let body: React.ReactNode;
  switch (evidence.kind) {
    case 'homework':
      body = evidence.items.map(h => (
        <div key={h.homeworkId} className={row}>
          <p className="font-bold" style={{ color: 'var(--text)' }}>📘 {h.title}</p>
          <p style={muted}>{h.modes.map(m => modeLabel(tt, m)).join(' · ')}</p>
          <button type="button" onClick={() => router.push(`/classes/${classId}?tab=curriculum&hw=${h.homeworkId}`)}
            className="mt-1 font-bold" style={{ color: accentColor }}>{t.openHomework}</button>
        </div>
      ));
      break;
    case 'timing':
      body = evidence.items.map(h => {
        const status = h.status === 'E' ? t.early(h.days) : h.status === 'L' ? t.onLastDay : h.status === 'K' ? t.lateBy(h.days) : null;
        return (
          <div key={h.homeworkId} className={row}>
            <p className="font-bold" style={{ color: 'var(--text)' }}>{h.title}</p>
            <p style={muted}>{t.due}: {fmtYmd(h.dueDate)}</p>
            {h.finishedDate ? (
              <p style={{ color: h.status === 'K' ? '#d97706' : 'var(--text)' }}>{t.done}: {fmtYmd(h.finishedDate)}{status ? ` · ${status}` : ''}</p>
            ) : (
              <p style={{ color: h.status === 'N' ? 'var(--danger)' : 'var(--text-muted)' }}>
                {h.status === 'N' ? t.notDone : t.inProgress} · {t.left(h.missingModes.map(m => modeLabel(tt, m)).join(', '))}
              </p>
            )}
          </div>
        );
      });
      break;
    case 'reminders':
      body = evidence.items.map(n => (
        <div key={n.sentAt} className={row}>
          <p style={{ color: 'var(--text)' }}>✉️ {t.sent}: {fmtDateTime(n.sentAt)}</p>
          <p style={muted}>{n.readAt ? `${t.read}: ${fmtDateTime(n.readAt)}` : t.unread}</p>
          <p style={{ color: n.practisedAt ? 'var(--text)' : 'var(--text-muted)' }}>
            {n.practisedAt ? t.practised(Math.max(1, Math.ceil((Date.parse(n.practisedAt) - Date.parse(n.sentAt)) / 3600_000))) : t.notPractised}
          </p>
        </div>
      ));
      break;
    case 'days':
      body = evidence.items.map(d => (
        <div key={d.date} className={row}>
          <p style={{ color: 'var(--text)' }}><span className="font-bold">{fmtYmd(d.date)}</span> · +{displayXP(d.xp)} XP</p>
          <p style={muted}>{d.reasons.map(reasonLabel).join(' · ')}</p>
        </div>
      ));
      break;
    case 'weeks':
      body = evidence.items.map((w, i) => (
        <div key={w.from} className={row}>
          <p style={{ color: 'var(--text)' }}>
            <span className="font-bold">{i === 0 ? t.thisWeek : `${fmtYmd(w.from).slice(0, 5)} – ${fmtYmd(w.to).slice(0, 5)}`}</span>
            {' · '}+{displayXP(w.xp)} XP · {t.activeDays(w.activeDays)}
          </p>
        </div>
      ));
      break;
    case 'sessions':
      body = evidence.items.map(s => (
        <div key={s.from} className={row}>
          <p style={{ color: 'var(--text)' }}>
            🕐 <span className="font-bold">{fmtYmd(s.date)}</span> · {fmtTime(s.from) === fmtTime(s.to) ? fmtTime(s.from) : `${fmtTime(s.from)} – ${fmtTime(s.to)}`}
          </p>
        </div>
      ));
      break;
    case 'accuracy':
      body = evidence.items.map(a => (
        <div key={a.from} className={row}>
          <p style={{ color: 'var(--text)' }}>
            <span className="font-bold">{fmtYmd(a.from).slice(0, 5)} – {fmtYmd(a.to).slice(0, 5)}</span>
            {' · '}{t.correctOf(a.right, a.total)} ({a.total ? Math.round((a.right / a.total) * 100) : 0}%)
          </p>
        </div>
      ));
      break;
    case 'words':
      body = evidence.items.map(x => (
        <div key={x.word} className={row}>
          <p style={{ color: 'var(--text)' }}>
            <span className="font-bold">{x.word}</span>
            <span style={{ color: 'var(--success, #22c55e)' }}> · ✓ {x.right}</span>
            <span style={{ color: 'var(--danger)' }}> · ✗ {x.wrong}</span>
          </p>
        </div>
      ));
      break;
    case 'modes':
      body = evidence.items.map(x => (
        <div key={x.mode} className={row}>
          <p style={{ color: 'var(--text)' }}>
            <span className="font-bold">{x.mode === 'review' ? reasonLabel('SRS Review') : modeLabel(tt, x.mode)}</span> · {x.count}
          </p>
        </div>
      ));
      break;
    case 'ranking':
      body = evidence.items.map(x => (
        <div key={`${x.place}:${x.name}`} className={row} style={x.me ? { background: `color-mix(in srgb, ${accentColor} 12%, transparent)` } : undefined}>
          <p style={{ color: 'var(--text)' }}>
            <span className="font-bold">{x.place}.</span> <span className={x.me ? 'font-bold' : ''}>{x.name}</span>
            {' · '}{x.unit === 'pct' ? `${x.value}%` : tt.classXpHistory.wordsCount(x.value)}
          </p>
        </div>
      ));
      break;
    case 'review':
      body = evidence.items.map(r => (
        <div key={r.from} className={row}>
          <p style={{ color: 'var(--text)' }}>
            🔄 <span className="font-bold">{fmtYmd(r.date)}</span> · {tt.classXpHistory.wordsCount(r.words)} · {fmtTime(r.from) === fmtTime(r.to) ? fmtTime(r.from) : `${fmtTime(r.from)} – ${fmtTime(r.to)}`}
          </p>
        </div>
      ));
      break;
  }

  return (
    <div className="mt-3 rounded-xl divide-y overflow-hidden animate-fade-in"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', border: `1px solid color-mix(in srgb, ${accentColor} 25%, transparent)` }}>
      {body}
    </div>
  );
}
