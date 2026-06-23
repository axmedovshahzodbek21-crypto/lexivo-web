'use client';
import { useEffect, useState } from 'react';

type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'suspended';

export default function SyncStatusBadge() {
  const [state, setState] = useState<SyncState>('idle');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const onStart     = () => { clearTimeout(timer); setState('syncing'); };
    const onDone      = () => {
      setState('synced');
      timer = setTimeout(() => setState('idle'), 3000);
    };
    const onError     = () => {
      setState('error');
      timer = setTimeout(() => setState('idle'), 5000);
    };
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

  if (state === 'idle') return null;

  const config = {
    syncing:   { icon: '↻', label: 'Syncing…',              bg: 'var(--border)',                                       color: 'var(--text-muted)', spin: true  },
    synced:    { icon: '✓', label: 'Synced',                 bg: 'color-mix(in srgb, var(--success) 13%, transparent)', color: 'var(--success)',    spin: false },
    error:     { icon: '⚠', label: 'Sync failed',            bg: 'color-mix(in srgb, var(--danger)  13%, transparent)', color: 'var(--danger)',     spin: false },
    suspended: { icon: '✕', label: 'Sync paused — reload',   bg: 'color-mix(in srgb, var(--danger)  20%, transparent)', color: 'var(--danger)',     spin: false },
  }[state];

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
      style={{ background: config.bg, color: config.color }}
    >
      <span className={config.spin ? 'animate-spin inline-block' : ''}>{config.icon}</span>
      {config.label}
    </div>
  );
}
