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

// The teacher's per-student summary (lib/student-summary.ts). Phrases that
// make a claim are tappable; tapping one shows the facts behind it under
// that sentence.
export default function StudentSummary({ sentences, classId, accentColor, reasonLabel }: {
  sentences: SummarySentence[];
  classId: string;
  accentColor: string;
  reasonLabel: (reason: string) => string;
}) {
  const [open, setOpen] = useState<{ s: number; g: number } | null>(null);
  return (
    <div className="space-y-3">
      {sentences.map((sentence, s) => {
        const ev = open?.s === s ? sentence[open.g]?.evidence : undefined;
        return (
          <div key={s}>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
              {sentence.map((seg, g) => seg.evidence ? (
                <span
                  key={g}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpen(open?.s === s && open.g === g ? null : { s, g })}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(open?.s === s && open.g === g ? null : { s, g }); } }}
                  className="cursor-pointer font-semibold"
                  style={{ color: accentColor, borderBottom: `1.5px dotted ${accentColor}` }}
                >{seg.text}</span>
              ) : <span key={g}>{seg.text}</span>)}
            </p>
            {ev && <EvidenceCard evidence={ev} classId={classId} accentColor={accentColor} reasonLabel={reasonLabel} />}
          </div>
        );
      })}
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
    <div className="mt-2 rounded-xl divide-y overflow-hidden animate-fade-in"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', border: `1px solid color-mix(in srgb, ${accentColor} 25%, transparent)` }}>
      {body}
    </div>
  );
}
