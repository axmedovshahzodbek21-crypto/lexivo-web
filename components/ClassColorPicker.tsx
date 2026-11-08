'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/useTranslation';
import { saveClassColor, useClassColors } from '@/lib/class-colors';
import { CLASS_COLORS, type ClassColorKey } from '@/lib/class-gradient';

const KEYS = Object.keys(CLASS_COLORS) as ClassColorKey[];

export default function ClassColorPicker({ classId }: { classId: string }) {
  const t = useTranslation();
  const { user } = useAuth();
  const colorOf = useClassColors();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) ref.current?.showModal();
  }, [open]);

  const close = () => { setOpen(false); setFailed(false); };

  const pick = async (key: ClassColorKey) => {
    if (!user) return;
    setFailed(false);
    if (await saveClassColor(user.id, classId, key)) close();
    else setFailed(true);
  };

  const current = colorOf(classId).gradient;
  const label = t.classesPage.classColor;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 bg-white/20 hover:bg-white/30 transition-colors rounded-xl px-2.5 py-1.5 text-xs"
        aria-label={label}
        title={label}
      >
        🎨
      </button>
      {open && (
        <dialog
          ref={ref}
          className="mx-auto mt-auto mb-4 sm:mb-auto w-[calc(100%-2rem)] max-w-xs rounded-2xl bg-[var(--surface)] shadow-2xl backdrop:bg-black/50"
          onCancel={close}
          onClick={e => { if (e.target === e.currentTarget) close(); }}
          onKeyDown={e => e.stopPropagation()}
        >
          <div className="p-6">
            <p className="text-[var(--text)] font-semibold mb-4 text-center">{label}</p>
            <div className="grid grid-cols-4 gap-3 justify-items-center">
              {KEYS.map((key, i) => {
                const { gradient } = CLASS_COLORS[key];
                const selected = gradient === current;
                return (
                  <button
                    key={key}
                    onClick={() => pick(key)}
                    aria-label={`${label} ${i + 1}`}
                    aria-pressed={selected}
                    className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} text-white font-black hover:scale-110 active:scale-95 transition-transform`}
                  >
                    {selected ? '✓' : ''}
                  </button>
                );
              })}
            </div>
            {failed && <p className="text-sm text-center mt-4" style={{ color: 'var(--danger)' }}>{t.settings.genericError}</p>}
          </div>
        </dialog>
      )}
    </>
  );
}
