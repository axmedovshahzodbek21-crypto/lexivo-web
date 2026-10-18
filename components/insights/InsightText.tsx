'use client';
import type { ChipAction, Segment } from '@/lib/class-insights';

// One rendered sentence: plain text plus clickable pieces. Without onChip the
// pieces are shown as text (used in the student list).
export default function InsightText({ segments, onChip }: { segments: Segment[]; onChip?: (a: ChipAction) => void }) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') return <span key={i}>{seg.text}</span>;
        if (!onChip) return <span key={i} className={`font-semibold ${seg.italic ? 'italic' : ''}`}>{seg.text}</span>;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChip(seg.action)}
            className={`inline font-semibold text-[var(--primary)] underline decoration-dotted underline-offset-4 hover:decoration-solid ${seg.italic ? 'italic' : ''}`}
          >
            {seg.text}
          </button>
        );
      })}
    </>
  );
}
