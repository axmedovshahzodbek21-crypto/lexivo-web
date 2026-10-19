'use client';
import Link from 'next/link';
import { useTranslation } from '@/lib/useTranslation';
import { studentsLabel } from '@/lib/class-insights';

// The class's most common Hard words as something to teach. "Show to class"
// opens the Hard words page's big-screen view, where each word can be
// marked taught. Words already taught (and not hard again) are left out.
export default function LessonCard({ classId, words, taught }: {
  classId: string; words: { word: string; students: number }[]; taught: Set<string>;
}) {
  const t = useTranslation().classInsights;
  const top = words.filter(h => !taught.has(h.word)).slice(0, 5);
  if (top.length === 0) return null;

  return (
    <div className="card space-y-3" style={{ padding: 16 }}>
      <p className="text-sm font-bold text-[var(--text)]">📚 {t.lessonTitle}</p>
      <ul className="flex flex-wrap gap-1.5">
        {top.map(h => (
          <li key={h.word} className="text-sm italic px-2.5 py-1 rounded-lg" style={{ background: 'var(--primary-bg)' }}>
            {h.word} <span className="not-italic text-xs text-[var(--text-muted)]">· {studentsLabel(t, h.students)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <Link
          href={`/classes/${classId}/hard-words?teach=1`}
          className="text-sm font-bold text-white px-4 py-2 rounded-xl"
          style={{ background: 'var(--primary)' }}
        >
          📺 {t.lessonShow}
        </Link>
        <Link href={`/classes/${classId}/hard-words`} className="text-sm font-semibold text-[var(--primary)]">{t.hardPageLink}</Link>
      </div>
    </div>
  );
}
