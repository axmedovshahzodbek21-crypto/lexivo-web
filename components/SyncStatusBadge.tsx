'use client';
import { useEffect, useState } from 'react';
import { triggerSync } from '@/lib/web-sync';

type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'suspended';

const STATE_CFG = {
  idle:      { icon: '↻', label: 'Sync',         color: 'var(--text-muted)',                                       bg: 'transparent' },
  syncing:   { icon: '↻', label: 'Syncing…',      color: 'var(--text-muted)',                                       bg: 'var(--border)' },
  synced:    { icon: '✓', label: 'Synced',         color: 'var(--success)',  bg: 'color-mix(in srgb, var(--success) 13%, transparent)' },
  error:     { icon: '⚠', label: 'Sync failed',    color: 'var(--danger)',   bg: 'color-mix(in srgb, var(--danger)  13%, transparent)' },
  suspended: { icon: '✕', label: 'Sync paused',    color: 'var(--danger)',   bg: 'color-mix(in srgb, var(--danger)  20%, transparent)' },
};

export default function SyncStatusBadge({ sidebar = false }: { sidebar?: boolean }) {
  const [state, setState] = useState<SyncState>('idle');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onStart     = () => { clearTimeout(timer); setState('syncing'); };
    const onDone      = () => { setState('synced'); timer = setTimeout(() => setState('idle'), 3000); };
    const onError     = () => { setState('error');     timer = setTimeout(() => setState('idle'), 5000); };
    const onSuspended = () => { clearTimeout(timer); setState('suspended'); };
    window.addEventListener('lexivo-sync-start',     onStart);
    window.addEventListener('lexivo-sync-done',      onDone);
    window.addEventListener('lexivo-sync-error',     onError);
    window.addEventListener('lexivo-sync-suspended', onSuspended);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('lexivo-sync-start',     onStart);
      window.removeEventListener('lexivo-sync-done',      onDone);
      window.removeEventListener('lexivo-sync-error',     onError);
      window.removeEventListener('lexivo-sync-suspended', onSuspended);
    };
  }, []);

  // Auto-expand on actionable states so the user doesn't miss errors
  useEffect(() => {
    if (state === 'error' || state === 'suspended') setExpanded(true);
  }, [state]);

  const cfg = STATE_CFG[state];

  // ── Sidebar mode: collapsed arrow → expand to show sync row ─────────────────
  if (sidebar) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setExpanded(e => !e)}
          title={expanded ? 'Hide sync' : 'Show sync'}
          className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition-all leading-none select-none"
          style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
        >›</button>
        {expanded && (
          <button
            onClick={() => triggerSync()}
            title="Sync now"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
            style={state !== 'idle'
              ? { background: cfg.bg, color: cfg.color }
              : { color: 'var(--text-muted)' }}
          >
            <span className={state === 'syncing' ? 'animate-spin inline-block' : ''}>{cfg.icon}</span>
            {state !== 'idle' ? cfg.label : 'Sync'}
          </button>
        )}
      </div>
    );
  }

  // ── Floating mode: pill shown only for non-idle states ───────────────────────
  if (state === 'idle' || state === 'syncing' || !expanded) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => triggerSync()}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
        style={{ background: cfg.bg, color: cfg.color }}
        title="Sync now"
      >
        <span>{cfg.icon}</span>
        {cfg.label}
      </button>
      <button
        onClick={() => setExpanded(false)}
        title="Dismiss"
        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
      >›</button>
    </div>
  );
}
