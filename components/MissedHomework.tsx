'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/useTranslation';
import { loadMissedHomework, type MissedHomework } from '@/lib/homework-deadlines';
import { modeLabel } from '@/app/classes/[id]/homework/_shared';

const COLLAPSED = 5;
const fmtYmd = (ymd: string) => ymd.split('-').reverse().join('.');

// The list itself — used by the dashboard card below (one row per student ×
// homework) and by ClassXpHistoryModal (one student, so no name).
export function MissedHomeworkRows({ items, nameOf }: { items: MissedHomework[]; nameOf?: (studentId: string) => string }) {
  const tt = useTranslation();
  const t = tt.missedHomework;
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, COLLAPSED);
  return (
    <div className="space-y-1.5">
      {shown.map(m => {
        const missing = m.missingModes.length > 0;
        return (
          <div key={`${m.homeworkId}:${m.studentId}`} className="flex items-start gap-2 text-xs">
            <span className="shrink-0">{missing ? '⏰' : '🐢'}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate" style={{ color: 'var(--text)' }}>
                {nameOf ? `${nameOf(m.studentId)} · ` : ''}{m.title}
              </p>
              <p style={{ color: missing ? 'var(--danger)' : 'var(--text-muted)' }}>
                {t.due(fmtYmd(m.dueDate))} · {missing ? t.left(m.missingModes.map(x => modeLabel(tt, x)).join(', ')) : t.late(m.lateDays)}
              </p>
            </div>
          </div>
        );
      })}
      {items.length > COLLAPSED && (
        <button type="button" onClick={() => setExpanded(v => !v)} className="text-xs font-bold" style={{ color: 'var(--primary)' }}>
          {expanded ? t.showLess : t.showAll(items.length)}
        </button>
      )}
    </div>
  );
}

// Teacher dashboard, Students tab: every student × homework still not done
// after its deadline. Late-but-done rows only show per student (XP History).
export function MissedHomeworkCard({ classId, students }: {
  classId: string;
  students: { student_id: string; name: string; joined_date?: string }[];
}) {
  const tt = useTranslation();
  const [items, setItems] = useState<MissedHomework[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadMissedHomework(classId, students.map(s => ({ id: s.student_id, joinDate: s.joined_date })), tt)
      .then(rows => { if (!cancelled) setItems(rows.filter(r => r.missingModes.length > 0)); })
      .catch(e => console.error('[MissedHomeworkCard]', e));
    return () => { cancelled = true; };
  }, [classId, students, tt]);

  if (items.length === 0) return null;
  const nameOf = (id: string) => students.find(s => s.student_id === id)?.name ?? tt.classesPage.unknownStudent;
  return (
    <div className="mx-4 mt-3 rounded-2xl px-4 py-3 space-y-2"
      style={{ background: 'color-mix(in srgb, var(--danger) 6%, var(--surface))', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)' }}>
      <p className="text-xs font-bold" style={{ color: 'var(--danger)' }}>⏰ {tt.missedHomework.title} ({items.length})</p>
      <MissedHomeworkRows items={items} nameOf={nameOf} />
    </div>
  );
}
