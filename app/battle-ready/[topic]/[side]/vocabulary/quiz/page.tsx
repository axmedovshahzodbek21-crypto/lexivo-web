'use client';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { getBRSideContent, type BRSide } from '@/lib/battleReadyContent';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function VocabQuizPage() {
  const params = useParams();
  const slug = String(params.topic);
  const side = String(params.side) as BRSide;
  const content = getBRSideContent(slug, side);
  if (!content) notFound();

  const questions = useMemo(() => {
    return content.vocab.map(item => {
      const distractors = shuffle(content.vocab.filter(v => v.term !== item.term)).slice(0, 3).map(v => v.definition);
      const options = shuffle([item.definition, ...distractors]);
      return { term: item.term, correct: item.definition, options };
    });
  }, [content]);

  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const q = questions[i];
  const isLast = i === questions.length - 1;
  const sideColor = side === 'for' ? '#22c55e' : '#ef4444';

  function next() {
    if (picked === null) return;
    if (isLast) return;
    setI(i + 1);
    setPicked(null);
  }

  return (
    <div className="p-4 space-y-5 animate-fade-in max-w-xl mx-auto">
      <BackButton href={`/battle-ready/${slug}/${side}/vocabulary`} label="Vocabulary" />
      <h1 className="text-lg font-bold text-[var(--text)]">Quiz</h1>
      <div className="text-xs text-[var(--text-muted)]">{i + 1} / {questions.length}</div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="text-xs text-[var(--text-muted)] mb-1">What does this mean?</div>
        <div className="font-bold text-lg text-[var(--text)]">{q.term}</div>
      </div>

      <div className="space-y-2">
        {q.options.map(opt => {
          const show = picked !== null;
          const good = show && opt === q.correct;
          const bad = show && opt === picked && opt !== q.correct;
          return (
            <button
              key={opt}
              onClick={() => picked === null && setPicked(opt)}
              disabled={picked !== null}
              className="w-full text-left rounded-xl px-3 py-2.5 text-sm border"
              style={{
                borderColor: good ? '#22c55e' : bad ? '#ef4444' : 'var(--border)',
                background: good ? 'rgba(34,197,94,0.1)' : bad ? 'rgba(239,68,68,0.08)' : 'var(--surface-2)',
                color: 'var(--text)',
              }}
            >
              {opt} {good && '✓'} {bad && '✗'}
            </button>
          );
        })}
      </div>

      {picked !== null && !isLast && (
        <button onClick={next} className="w-full rounded-xl py-3 font-bold text-white text-sm" style={{ background: sideColor }}>
          Next question
        </button>
      )}
      {picked !== null && isLast && (
        <p className="text-center text-sm font-semibold text-[var(--text-muted)]">Quiz complete.</p>
      )}
    </div>
  );
}
