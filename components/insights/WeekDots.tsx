'use client';
import type { DayInfo, Lang } from '@/lib/class-insights';
import { weekdayShort } from '@/lib/class-insights';

// The week at a glance: red = missed what was due, green = did it, light
// purple = studied with nothing due, empty = nothing due, faint = not in class yet.
function dotStyle(d: DayInfo): React.CSSProperties {
  if (d.before_join) return { border: '1px dashed var(--border)', opacity: 0.4 };
  if (d.missed) return { background: 'var(--danger)' };
  if ((d.learn_due ?? 0) > 0 || d.review_due) return { background: 'var(--success)' };
  if (d.active) return { background: 'var(--primary)', opacity: 0.45 };
  return { border: '1px solid var(--border)' };
}

export default function WeekDots({ days, lang }: { days: DayInfo[] | null; lang: Lang }) {
  if (!days || days.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 shrink-0" aria-hidden>
      {days.map(d => (
        <span key={d.date} title={weekdayShort(d.date, lang)} className="w-2.5 h-2.5 rounded-full" style={dotStyle(d)} />
      ))}
    </span>
  );
}
