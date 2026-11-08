'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';

type Pending = { message: string; resolve: (ok: boolean) => void };

let show: ((next: Pending) => void) | null = null;

/** In-app replacement for window.confirm(). Resolves true if the user confirms. */
export function appConfirm(message: string): Promise<boolean> {
  return new Promise(resolve => {
    if (show) show({ message, resolve });
    else resolve(false);
  });
}

export default function ConfirmDialog() {
  const t = useTranslation();
  const pathname = usePathname();
  const [pending, setPending] = useState<Pending | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    show = next => setPending(prev => { prev?.resolve(false); return next; });
    return () => { show = null; };
  }, []);

  // Never let a dialog opened on one page confirm an action after leaving it.
  useEffect(() => () => {
    setPending(prev => { prev?.resolve(false); return null; });
  }, [pathname]);

  useEffect(() => {
    if (pending) ref.current?.showModal();
  }, [pending]);

  if (!pending) return null;

  const answer = (ok: boolean) => {
    ref.current?.close(); // hands keyboard focus back to the button that opened it
    pending.resolve(ok);
    setPending(null);
  };

  return (
    <dialog
      ref={ref}
      className="mx-auto mt-auto mb-4 sm:mb-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-[var(--surface)] shadow-2xl backdrop:bg-black/50"
      onCancel={() => answer(false)}
      onClick={e => { if (e.target === e.currentTarget) answer(false); }}
      onKeyDown={e => e.stopPropagation()} // keep global shortcuts (f, ?) out while open
    >
      <div className="p-6">
        <p className="text-[var(--text)] font-semibold mb-6">{pending.message}</p>
        <div className="flex gap-3">
          {/* Cancel is first so it takes initial focus: Enter must not confirm a delete. */}
          <button
            onClick={() => answer(false)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[var(--text-muted)] bg-[var(--surface-2)]"
          >
            {t.libraryPage.cancel}
          </button>
          <button
            onClick={() => answer(true)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'var(--danger)' }}
          >
            {t.libraryPage.confirm}
          </button>
        </div>
      </div>
    </dialog>
  );
}
