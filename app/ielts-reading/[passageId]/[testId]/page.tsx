'use client';
import Link from 'next/link';
import { use, useState } from 'react';
import { ieltsData } from '@/lib/ielts-data';

const TYPE_LABELS: Record<string, string> = {
  true_false_not_given:      'True / False / Not Given',
  yes_no_not_given:          'Yes / No / Not Given',
  multiple_choice:           'Multiple Choice',
  multiple_choice_multi:     'Multiple Choice (Multiple)',
  matching_information:      'Matching Information',
  matching_headings:         'Matching Headings',
  matching_features:         'Matching Features',
  matching_sentence_endings: 'Matching Sentence Endings',
  sentence_completion:       'Sentence Completion',
  summary_completion:        'Summary Completion',
  short_answer:              'Short Answer',
};

export default function TestPage({ params }: { params: Promise<{ passageId: string; testId: string }> }) {
  const { passageId, testId } = use(params);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const section = ieltsData.find(s => s.passageSection === Number(passageId));
  const test = section?.tests.find(t => t.testNumber === Number(testId));

  const toggleReveal = (i: number) => {
    setRevealed(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  if (!test) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
        <Link href={`/ielts-reading/${passageId}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-8">
          ← Back to Tests
        </Link>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 flex flex-col items-center justify-center text-center gap-3">
          <span className="text-4xl">🔒</span>
          <p className="text-lg font-bold text-[var(--text)]">Coming soon</p>
          <p className="text-sm text-[var(--text-muted)]">This test is being prepared. Check back later.</p>
        </div>
      </div>
    );
  }

  const paragraphs = test.content.split('\n').map(p => p.trim()).filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-24">
      <Link href={`/ielts-reading/${passageId}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-6">
        ← Back to Tests
      </Link>

      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
          IELTS Reading · Passage {passageId} · Test {testId}
        </p>
        <h1 className="text-xl font-black text-[var(--text)]">{test.title}</h1>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">

        {/* Left: passage */}
        <div className="flex-1 min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto">
          <div className="space-y-4 text-[var(--text)] leading-[1.85]" style={{ fontSize: 15 }}>
            {paragraphs.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>

        {/* Right: questions */}
        <div className="w-[420px] shrink-0 flex flex-col gap-4">
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
            Questions 1–{test.questions.length}
          </p>

          {test.questions.map((q, i) => {
            const isRevealed = revealed.has(i);
            return (
              <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                {/* Question header */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs font-black flex items-center justify-center mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider mb-1">{TYPE_LABELS[q.type]}</p>
                      <p className="text-sm text-[var(--text)] leading-snug font-medium">{q.question}</p>
                      {q.options && (
                        <ul className="mt-2 space-y-1">
                          {q.options.map((opt, j) => (
                            <li key={j} className="text-sm text-[var(--text-muted)]">{opt}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reveal button */}
                <div className="px-4 pb-3">
                  <button
                    onClick={() => toggleReveal(i)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background: isRevealed ? 'var(--primary)' : 'var(--surface-2)',
                      color: isRevealed ? 'white' : 'var(--text-muted)',
                    }}
                  >
                    {isRevealed ? 'Hide Answer' : 'Show Answer'}
                  </button>
                </div>

                {/* Answer reveal */}
                {isRevealed && (
                  <div className="border-t border-[var(--border)] px-4 py-4 space-y-3">
                    {/* Answer badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Answer:</span>
                      <span className="px-2 py-0.5 rounded-lg text-sm font-black text-white" style={{ background: 'var(--primary)' }}>
                        {q.answer}
                      </span>
                    </div>
                    {/* Passage excerpt */}
                    <div className="rounded-xl p-3" style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)', borderLeft: '3px solid var(--primary)' }}>
                      <p className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider mb-1">From the passage</p>
                      <p className="text-sm text-[var(--text)] italic leading-snug">"{q.passage_excerpt}"</p>
                    </div>
                    {/* Explanation */}
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Why?</p>
                      <p className="text-sm text-[var(--text-muted)] leading-snug">{q.explanation}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
