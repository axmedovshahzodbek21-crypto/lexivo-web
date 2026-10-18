'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/useTranslation';

// The class's most common Hard words as something to teach, with a
// full-screen view to put on the projector — one word at a time.
export default function LessonCard({ classId, words }: { classId: string; words: { word: string; students: number }[] }) {
  const t = useTranslation().classInsights;
  const top = words.slice(0, 5);
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIndex(null);
      else if (e.key === 'ArrowRight' || e.key === ' ') setIndex(i => (i === null ? i : Math.min(i + 1, top.length - 1)));
      else if (e.key === 'ArrowLeft') setIndex(i => (i === null ? i : Math.max(i - 1, 0)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, top.length]);

  if (top.length === 0) return null;

  return (
    <div className="card space-y-3" style={{ padding: 16 }}>
      <p className="text-sm font-bold text-[var(--text)]">📚 {t.lessonTitle}</p>
      <ul className="flex flex-wrap gap-1.5">
        {top.map(h => (
          <li key={h.word} className="text-sm italic px-2.5 py-1 rounded-lg" style={{ background: 'var(--primary-bg)' }}>
            {h.word} <span className="not-italic text-xs text-[var(--text-muted)]">· {t.studentsCount.replace('{n}', String(h.students))}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIndex(0)}
          className="text-sm font-bold text-white px-4 py-2 rounded-xl"
          style={{ background: 'var(--primary)' }}
        >
          {t.lessonShow}
        </button>
        <Link href={`/classes/${classId}/hard-words`} className="text-sm font-semibold text-[var(--primary)]">{t.hardPageLink}</Link>
      </div>

      {index !== null && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center p-6 select-none"
          style={{ background: 'var(--background)' }}
          onClick={() => setIndex(index < top.length - 1 ? index + 1 : null)}
        >
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setIndex(null); }}
            className="absolute top-4 right-5 text-2xl text-[var(--text-muted)]"
            aria-label={t.close}
          >
            ✕
          </button>
          <p className="font-black text-[var(--text)] text-center break-words" style={{ fontSize: 'clamp(3rem, 12vw, 9rem)' }}>
            {top[index].word}
          </p>
          <p className="mt-6 text-lg text-[var(--text-muted)]">{index + 1} / {top.length}</p>
        </div>
      )}
    </div>
  );
}
