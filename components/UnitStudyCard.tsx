'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';

// The unit card shared by pre-built collections (app/collections/[name]) and
// My Words folders (app/my-words/[collection]): accent strip, UNIT N badge,
// title, progress bar, then whatever study buttons the page puts inside.
export function UnitCardFrame({
  badge, badges, title, actions, isComplete, accent, progressPct, children,
}: {
  badge: string;
  badges?: ReactNode;
  title?: ReactNode;
  actions?: ReactNode;
  isComplete: boolean;
  accent: string;
  progressPct: number;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'var(--surface)',
        border: isComplete ? '1.5px solid #22c55e' : '1.5px solid var(--border)',
        boxShadow: isComplete
          ? '0 0 0 3px rgba(34,197,94,0.1), 0 4px 16px rgba(0,0,0,0.08)'
          : '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      {/* Colored top accent strip */}
      <div className="h-1.5" style={{ background: isComplete ? '#22c55e' : accent }} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Unit header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
                style={{ background: isComplete ? '#22c55e' : 'var(--primary)' }}
              >
                {badge}
              </span>
              {badges}
            </div>
            {title}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0 mt-0.5">{actions}</div>}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, background: isComplete ? '#22c55e' : accent }}
          />
        </div>

        {children}
      </div>
    </div>
  );
}

export function ModeButton({
  href, icon, label, done, color, locked, lockReason, softLocked, softLockReason, wide, newBadge,
}: {
  href: string; icon: string; label: string; done: boolean; color: string;
  locked?: boolean; lockReason?: string;
  softLocked?: boolean; softLockReason?: string;
  wide?: boolean;
  // My Words: "N new" — words added since this activity was last done.
  newBadge?: string;
}) {
  const base = `relative flex items-center justify-center ${wide ? 'flex-row gap-2 py-2.5 px-4' : 'flex-col gap-1.5 py-3'} rounded-xl text-xs font-bold transition-all`;
  const badge = newBadge && (
    <span
      className="absolute -top-1.5 -left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
      style={{ background: 'var(--success)' }}
    >{newBadge}</span>
  );

  if (locked) {
    return (
      <div
        title={lockReason}
        className={`${base} cursor-not-allowed select-none`}
        style={{ background: 'var(--surface-2)', border: '1.5px dashed var(--border)', opacity: 0.4 }}
      >
        <span className={wide ? 'text-base' : 'text-xl'}>🔒</span>
        <span className="text-[var(--text-muted)]">{label}</span>
      </div>
    );
  }
  if (softLocked) {
    return (
      <Link
        href={href}
        title={softLockReason}
        className={`${base} active:scale-95`}
        style={{ background: 'rgba(234,179,8,0.1)', border: '1.5px solid rgba(234,179,8,0.45)', color: '#ca8a04' }}
      >
        <span className={wide ? 'text-base' : 'text-xl'}>⚠️</span>
        <span>{label}</span>
      </Link>
    );
  }
  if (done) {
    return (
      <Link
        href={href}
        className={`${base} active:scale-95`}
        style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.35)', color: '#16a34a' }}
      >
        {badge}
        <span className={wide ? 'text-base' : 'text-xl'}>✓</span>
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} text-white active:scale-95 hover:opacity-90`}
      style={{ background: color, boxShadow: `0 3px 12px ${color}66` }}
    >
      {badge}
      <span className={wide ? 'text-base' : 'text-xl'}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
