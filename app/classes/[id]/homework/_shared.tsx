'use client';
import Link from 'next/link';
import { localDateStr, addDaysToDateStr } from '@/lib/storage';

export const MODE_ICON: Record<string, string> = { learn: '📖', flashcard: '🃏', quiz: '❓', match: '🎯' };
export const MODE_LABEL: Record<string, string> = { learn: 'Learn', flashcard: 'Cards', quiz: 'Quiz', match: 'Match' };
export const MODE_COLOR: Record<string, string> = { learn: '#4f46e5', flashcard: '#ea580c', quiz: '#d97706', match: '#db2777' };

// "Fully done" for a homework assignment: every assigned mode is present in
// the completed set. Previously reimplemented independently 12+ times
// across this file and homework/page.tsx, homework/[hwId]/page.tsx,
// homework/collection/[name]/page.tsx, homework/folder/[folderId]/page.tsx —
// consistent today (a real assignment's modes list is never empty; the
// assign-homework UI always requires at least 'learn'), but with no single
// place to fix if that definition ever changes.
export function isHomeworkDone(modes: string[], completed: Set<string>): boolean {
  return modes.length > 0 && modes.every(m => completed.has(m));
}

export function dueLabel(due: string | null): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const today = localDateStr();
  const tomorrow = addDaysToDateStr(today, 1);
  if (due < today) return { text: `Overdue · ${due}`, overdue: true };
  if (due === today) return { text: 'Due today', overdue: false };
  if (due === tomorrow) return { text: 'Due tomorrow', overdue: false };
  return { text: `Due ${due}`, overdue: false };
}

export interface AssignedUnit {
  hwId: string;
  badge: string;
  title: string;
  wordCount: number;
  modes: string[];
  dueDate: string | null;
}

export function AssignedUnitCard({
  classId, unit, completed,
}: { classId: string; unit: AssignedUnit; completed: Set<string> }) {
  const allDone = isHomeworkDone(unit.modes, completed);
  const due = dueLabel(unit.dueDate);
  const nonMatchModes = unit.modes.filter(m => m !== 'match');
  const hasMatch = unit.modes.includes('match');
  const learnAssigned = unit.modes.includes('learn');
  const learnDone = completed.has('learn');
  const gatedByLearn = (mode: string) => mode !== 'learn' && learnAssigned && !learnDone;
  const progressPct = unit.modes.length > 0
    ? (unit.modes.filter(m => completed.has(m)).length / unit.modes.length) * 100
    : 0;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'var(--surface)',
        border: allDone ? '1.5px solid #22c55e' : '1.5px solid var(--border)',
        boxShadow: allDone
          ? '0 0 0 3px rgba(34,197,94,0.1), 0 4px 16px rgba(0,0,0,0.08)'
          : '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      <div
        className="h-1.5"
        style={{ background: allDone ? '#22c55e' : 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 75%, transparent) 100%)' }}
      />

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
              style={{ background: allDone ? '#22c55e' : 'var(--primary)' }}
            >
              {unit.badge}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">{unit.wordCount} words</span>
            {allDone && <span className="text-[10px] font-bold text-green-500">✓ Done</span>}
          </div>
          <h3 className="font-bold text-[var(--text)] text-sm leading-tight truncate">{unit.title}</h3>
          {due && (
            <p className={`text-xs font-semibold mt-1 ${due.overdue ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>
              {due.overdue ? '⚠️ ' : '📅 '}{due.text}
            </p>
          )}
        </div>

        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: allDone ? '#22c55e' : 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 75%, transparent) 100%)',
            }}
          />
        </div>

        {nonMatchModes.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {nonMatchModes.map(mode => (
              <GridModeButton
                key={mode}
                classId={classId}
                hwId={unit.hwId}
                mode={mode}
                done={completed.has(mode)}
                locked={gatedByLearn(mode)}
              />
            ))}
          </div>
        )}
        {hasMatch && (
          <GridModeButton
            classId={classId}
            hwId={unit.hwId}
            mode="match"
            done={completed.has('match')}
            locked={gatedByLearn('match')}
            wide
          />
        )}
      </div>
    </div>
  );
}

export function UnassignedUnitCard({ badge, title, wordCount }: { badge: string; title: string; wordCount: number }) {
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'var(--surface)', border: '1.5px dashed var(--border)', opacity: 0.55 }}
    >
      <div className="p-4 flex flex-col gap-2 flex-1 items-center justify-center text-center min-h-[140px]">
        <span className="text-2xl">🔒</span>
        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-[var(--text-muted)] bg-[var(--surface-2)]">
          {badge}
        </span>
        <h3 className="font-bold text-[var(--text-muted)] text-sm leading-tight truncate">{title}</h3>
        <p className="text-[10px] text-[var(--text-muted)]">{wordCount} words · Not yet assigned</p>
      </div>
    </div>
  );
}

function GridModeButton({
  classId, hwId, mode, done, locked, wide,
}: { classId: string; hwId: string; mode: string; done: boolean; locked?: boolean; wide?: boolean }) {
  const color = MODE_COLOR[mode] ?? 'var(--primary)';
  const icon = MODE_ICON[mode] ?? '📖';
  const label = MODE_LABEL[mode] ?? mode;
  const base = `flex items-center justify-center ${wide ? 'flex-row gap-2 py-2.5 px-4' : 'flex-col gap-1.5 py-3'} rounded-xl text-xs font-bold transition-all`;

  if (locked) {
    return (
      <div
        title="Complete Learn first"
        className={`${base} cursor-not-allowed select-none`}
        style={{ background: 'var(--surface-2)', border: '1.5px dashed var(--border)', opacity: 0.4 }}
      >
        <span className={wide ? 'text-base' : 'text-xl'}>🔒</span>
        <span className="text-[var(--text-muted)]">{label}</span>
      </div>
    );
  }
  if (done) {
    return (
      <Link
        href={`/classes/${classId}/homework/${hwId}?mode=${mode}`}
        className={`${base} active:scale-95`}
        style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.35)', color: '#16a34a' }}
      >
        <span className={wide ? 'text-base' : 'text-xl'}>✓</span>
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <Link
      href={`/classes/${classId}/homework/${hwId}?mode=${mode}`}
      className={`${base} text-white active:scale-95 hover:opacity-90`}
      style={{ background: color, boxShadow: `0 3px 12px ${color}66` }}
    >
      <span className={wide ? 'text-base' : 'text-xl'}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
