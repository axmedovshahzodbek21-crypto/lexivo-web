'use client';
import Link from 'next/link';
import { use, useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ieltsData, IeltsQuestion } from '@/lib/ielts-data';

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_INSTRUCTIONS: Record<string, string> = {
  true_false_not_given:
    'Do the following statements agree with the information given in the passage? Write TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, or NOT GIVEN if there is no information on this.',
  yes_no_not_given:
    'Do the following statements agree with the views of the writer? Write YES if the statement agrees with the views of the writer, NO if the statement contradicts the views of the writer, or NOT GIVEN if it is impossible to say what the writer thinks about this.',
  multiple_choice:      'Choose the correct letter, A, B, C or D.',
  multiple_choice_multi: 'Choose TWO letters, A–E.',
  matching_information:
    'The passage has several paragraphs. Which paragraph contains the following information? Write the correct letter in boxes on your answer sheet.',
  matching_headings:    'Choose the correct heading for each paragraph from the list of headings below.',
  matching_features:    'Match each statement with the correct option from the list. You may use any letter more than once.',
  matching_sentence_endings: 'Complete each sentence with the correct ending from the box below.',
  sentence_completion:  'Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
  summary_completion:   'Complete the summary below. Choose NO MORE THAN TWO WORDS from the passage for each answer.',
  short_answer:         'Answer the questions below. Choose NO MORE THAN THREE WORDS from the passage for each answer.',
};

const CONTRAST_STYLES: Record<string, { bg: string; color: string }> = {
  'Black on white': { bg: '#ffffff', color: '#000000' },
  'White on black': { bg: '#000000', color: '#ffffff' },
  'Yellow on black': { bg: '#000000', color: '#FFD600' },
};

const TEXT_SIZES: Record<string, number> = {
  Small: 13,
  Medium: 15,
  Large: 17,
  'Extra large': 20,
};

const TIMER_SECONDS = 20 * 60;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function normalise(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isCorrect(q: IeltsQuestion, userAnswer: string): boolean {
  if (!userAnswer.trim()) return false;
  if (q.type === 'multiple_choice_multi') {
    const sorted = (s: string) => s.split(',').map(x => normalise(x)).sort().join(',');
    return sorted(userAnswer) === sorted(q.answer);
  }
  return normalise(userAnswer) === normalise(q.answer);
}

function buildGroups(questions: IeltsQuestion[]) {
  const groups: { type: string; start: number; end: number }[] = [];
  questions.forEach((q, i) => {
    const last = groups[groups.length - 1];
    if (last && last.type === q.type) { last.end = i + 1; }
    else { groups.push({ type: q.type, start: i + 1, end: i + 1 }); }
  });
  return groups;
}

// ─── Options modal ───────────────────────────────────────────────────────────

type OptionsScreen = 'main' | 'contrast' | 'textsize';

function OptionsModal({ contrast, textSize, onContrast, onTextSize, onClose }: {
  contrast: string;
  textSize: string;
  onContrast: (v: string) => void;
  onTextSize: (v: string) => void;
  onClose: () => void;
}) {
  const [screen, setScreen] = useState<OptionsScreen>('main');

  // Modal adopts the currently active contrast theme
  const cs = CONTRAST_STYLES[contrast];
  const modalBg = cs?.bg ?? '#ffffff';
  const modalColor = cs?.color ?? '#000000';
  const modalBorder = contrast === 'Black on white' ? '#e5e7eb' : `${modalColor}30`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative rounded-2xl shadow-2xl w-80 overflow-hidden"
        style={{ background: modalBg, color: modalColor }}
        onClick={e => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${modalBorder}` }}>
          {screen !== 'main' ? (
            <button onClick={() => setScreen('main')} className="text-lg w-6 opacity-60 hover:opacity-100 transition-opacity" style={{ color: modalColor }}>‹</button>
          ) : <div className="w-6" />}
          <p className="text-sm font-black" style={{ color: modalColor }}>
            {screen === 'main' ? 'Options' : screen === 'contrast' ? 'Contrast' : 'Text size'}
          </p>
          <button onClick={onClose} className="text-sm opacity-60 hover:opacity-100 transition-opacity" style={{ color: modalColor }}>✕</button>
        </div>

        {/* Main screen */}
        {screen === 'main' && (
          <div>
            {[
              { label: 'Contrast', value: contrast, next: 'contrast' as OptionsScreen },
              { label: 'Text size', value: textSize, next: 'textsize' as OptionsScreen },
            ].map((row, idx) => (
              <button key={row.label} onClick={() => setScreen(row.next)}
                className="w-full flex items-center justify-between px-5 py-4 transition-opacity hover:opacity-70 text-left"
                style={{ borderTop: idx > 0 ? `1px solid ${modalBorder}` : undefined }}>
                <span className="text-sm font-black" style={{ color: modalColor }}>{row.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm opacity-60" style={{ color: modalColor }}>{row.value}</span>
                  <span className="opacity-60" style={{ color: modalColor }}>›</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Contrast screen */}
        {screen === 'contrast' && (
          <div>
            {Object.keys(CONTRAST_STYLES).map((opt, idx) => (
              <button key={opt} onClick={() => { onContrast(opt); setScreen('main'); }}
                className="w-full flex items-center justify-between px-5 py-4 transition-opacity hover:opacity-70 text-left"
                style={{ borderTop: idx > 0 ? `1px solid ${modalBorder}` : undefined }}>
                <span className="text-sm font-black" style={{ color: modalColor }}>{opt}</span>
                {contrast === opt && <span className="text-sm font-bold" style={{ color: modalColor }}>?</span>}
              </button>
            ))}
          </div>
        )}

        {/* Text size screen */}
        {screen === 'textsize' && (
          <div>
            {Object.keys(TEXT_SIZES).map((opt, idx) => (
              <button key={opt} onClick={() => { onTextSize(opt); setScreen('main'); }}
                className="w-full flex items-center justify-between px-5 py-4 transition-opacity hover:opacity-70 text-left"
                style={{ borderTop: idx > 0 ? `1px solid ${modalBorder}` : undefined }}>
                <span className="text-sm font-black" style={{ color: modalColor }}>{opt}</span>
                {textSize === opt && <span className="text-sm font-bold" style={{ color: modalColor }}>?</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Input components ────────────────────────────────────────────────────────

function PillSelect({ options, value, onChange, disabled }: {
  options: string[]; value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  return (
    <div className="flex gap-2 flex-wrap mt-2">
      {options.map(opt => {
        const active = value === opt;
        return (
          <button key={opt} disabled={disabled} onClick={() => onChange(active ? '' : opt)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all disabled:cursor-not-allowed"
            style={{
              background: active ? 'var(--primary)' : 'var(--surface-2)',
              color: active ? 'white' : 'var(--text-muted)',
              borderColor: active ? 'var(--primary)' : 'var(--border)',
            }}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function MultiCheckbox({ options, value, onChange, disabled }: {
  options: string[]; value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  const selected = value ? value.split(',').map(s => s.trim()) : [];
  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
    onChange(next.join(', '));
  };
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={selected.includes(opt)} disabled={disabled} onChange={() => toggle(opt)}
            className="accent-[var(--primary)] w-4 h-4 rounded" />
          <span className="text-sm text-[var(--text)]">{opt}</span>
        </label>
      ))}
    </div>
  );
}

function RadioGroup({ options, value, onChange, disabled }: {
  options: string[]; value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {options.map((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        const checked = value === letter || value === opt;
        return (
          <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
            <input type="radio" name={opt} checked={checked} disabled={disabled} onChange={() => onChange(letter)}
              className="accent-[var(--primary)] w-4 h-4" />
            <span className="text-sm text-[var(--text)]"><span className="font-bold">{letter}.</span> {opt}</span>
          </label>
        );
      })}
    </div>
  );
}

function TextInput({ value, onChange, disabled, placeholder }: {
  value: string; onChange: (v: string) => void; disabled: boolean; placeholder?: string;
}) {
  return (
    <input type="text" value={value} disabled={disabled} onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? 'Type your answer…'}
      className="mt-2 w-full px-3 py-2 rounded-xl text-sm border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors disabled:opacity-60" />
  );
}

function QuestionInput({ q, value, onChange, disabled }: {
  q: IeltsQuestion; value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  switch (q.type) {
    case 'true_false_not_given':
      return <PillSelect options={['TRUE', 'FALSE', 'NOT GIVEN']} value={value} onChange={onChange} disabled={disabled} />;
    case 'yes_no_not_given':
      return <PillSelect options={['YES', 'NO', 'NOT GIVEN']} value={value} onChange={onChange} disabled={disabled} />;
    case 'multiple_choice':
      return q.options ? <RadioGroup options={q.options} value={value} onChange={onChange} disabled={disabled} /> : <TextInput value={value} onChange={onChange} disabled={disabled} />;
    case 'multiple_choice_multi':
      return q.options ? <MultiCheckbox options={q.options} value={value} onChange={onChange} disabled={disabled} /> : <TextInput value={value} onChange={onChange} disabled={disabled} placeholder="Comma-separated answers…" />;
    case 'matching_information':
    case 'matching_headings':
    case 'matching_features':
    case 'matching_sentence_endings':
      return q.options ? <RadioGroup options={q.options} value={value} onChange={onChange} disabled={disabled} /> : <TextInput value={value} onChange={onChange} disabled={disabled} />;
    default:
      return <TextInput value={value} onChange={onChange} disabled={disabled} />;
  }
}

// ─── Answer reveal ───────────────────────────────────────────────────────────

function AnswerReveal({ q, userAnswer, submitted }: {
  q: IeltsQuestion; userAnswer?: string; submitted?: boolean;
}) {
  const correct = submitted && userAnswer !== undefined ? isCorrect(q, userAnswer) : null;
  return (
    <div className="border-t border-[var(--border)] px-4 py-4 space-y-3">
      {submitted && userAnswer !== undefined && (
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${correct ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500'}`}>
            {correct ? '✓ Correct' : '✗ Incorrect'}
          </span>
          {!correct && userAnswer && (
            <span className="text-xs text-[var(--text-muted)]">Your answer: <strong>{userAnswer}</strong></span>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Answer:</span>
        <span className="px-2 py-0.5 rounded-lg text-sm font-black text-white" style={{ background: 'var(--primary)' }}>{q.answer}</span>
      </div>
      <div className="rounded-xl p-3" style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)', borderLeft: '3px solid var(--primary)' }}>
        <p className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-wider mb-1">From the passage</p>
        <p className="text-sm text-[var(--text)] italic leading-snug">"{q.passage_excerpt}"</p>
      </div>
      <div>
        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Why?</p>
        <p className="text-sm text-[var(--text-muted)] leading-snug">{q.explanation}</p>
      </div>
    </div>
  );
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function TestPageInner({ passageId, testId }: { passageId: string; testId: string }) {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'test' ? 'test' : 'review';

  const section = ieltsData.find(s => s.passageSection === Number(passageId));
  const test = section?.tests.find(t => t.testNumber === Number(testId));

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS);
  const [timerActive, setTimerActive] = useState(mode === 'test');
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  // Options state
  const [showOptions, setShowOptions] = useState(false);
  const [contrast, setContrast] = useState('Black on white');
  const [textSize, setTextSize] = useState('Medium');

  const setAnswer = useCallback((i: number, val: string) => {
    setAnswers(prev => ({ ...prev, [i]: val }));
  }, []);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    setTimerActive(false);
  }, []);

  useEffect(() => {
    if (!timerActive || submitted) return;
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { handleSubmit(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerActive, submitted, handleSubmit]);

  if (!test) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
        <Link href={`/ielts-reading/${passageId}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-8">
          ← Back to Tests
        </Link>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 flex flex-col items-center text-center gap-3">
          <span className="text-4xl">🔒</span>
          <p className="text-lg font-bold text-[var(--text)]">Coming soon</p>
          <p className="text-sm text-[var(--text-muted)]">This test is being prepared. Check back later.</p>
        </div>
      </div>
    );
  }

  const paragraphs = test.content.split('\n').map(p => p.trim()).filter(Boolean);
  const score = submitted ? test.questions.filter((q, i) => isCorrect(q, answers[i] ?? '')).length : null;
  const timerColor = secondsLeft < 300 ? 'text-red-500' : secondsLeft < 600 ? 'text-orange-400' : 'text-[var(--text)]';

  const passageStyle = CONTRAST_STYLES[contrast];
  const fontSize = TEXT_SIZES[textSize] ?? 15;

  return (
    <div className="px-4 py-6 pb-6">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <Link href={`/ielts-reading/${passageId}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          ← Back to Tests
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowOptions(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">
            ⚙ Options
          </button>
          <a href="https://t.me/LexivoApp" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-80"
            style={{ background: '#2AABEE', color: 'white' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg>
            Lexivo
          </a>
        </div>
      </div>

      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
            IELTS Reading · Passage {passageId} · Test {testId}
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-black" style={{
              background: mode === 'test' ? 'var(--primary)' : 'color-mix(in srgb, var(--primary) 15%, transparent)',
              color: mode === 'test' ? 'white' : 'var(--primary)',
            }}>
              {mode === 'test' ? '📝 TEST MODE' : '📖 REVIEW MODE'}
            </span>
          </p>
          <h1 className="text-xl font-black text-[var(--text)]">{test.title}</h1>
        </div>

        {mode === 'test' && !submitted && (
          <div className="shrink-0 text-right">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Time left</p>
            <p className={`text-2xl font-black font-mono tabular-nums ${timerColor}`}>{formatTime(secondsLeft)}</p>
          </div>
        )}

        {mode === 'test' && submitted && score !== null && (
          <div className="shrink-0 text-right rounded-2xl border border-[var(--primary)] px-5 py-3" style={{ background: 'color-mix(in srgb, var(--primary) 8%, transparent)' }}>
            <p className="text-[10px] text-[var(--primary)] uppercase tracking-wider font-bold">Your Score</p>
            <p className="text-3xl font-black text-[var(--text)]">
              {score}<span className="text-lg text-[var(--text-muted)]">/{test.questions.length}</span>
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{Math.round((score / test.questions.length) * 100)}%</p>
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="flex items-stretch" style={{ color: passageStyle.color, minHeight: 'calc(100vh - 200px)' }}>

        {/* Passage */}
        <div
          className="flex-1 min-w-0 p-6 overflow-y-auto transition-colors"
          style={{ background: passageStyle.bg, color: passageStyle.color, maxHeight: 'calc(100vh - 160px)', position: 'sticky', top: '0' }}
        >
          <div className="space-y-4 leading-[1.85]" style={{ fontSize }}>
            {paragraphs.map((para, i) => <p key={i}>{para}</p>)}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px shrink-0 self-stretch" style={{ background: `${passageStyle.color}25` }} />

        {/* Questions */}
        <div className="w-[440px] shrink-0 flex flex-col gap-4 p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
          {(() => {
            const groups = buildGroups(test.questions);
            let qIndex = 0;
            return groups.map((group, gi) => (
              <div key={gi} className="flex flex-col gap-3">
                <div className="px-2 py-3 border-b" style={{ borderColor: `${passageStyle.color}25` }}>
                  <p className="text-xs font-black mb-1" style={{ color: passageStyle.color }}>
                    Questions {group.start}{group.end > group.start ? `–${group.end}` : ''}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: passageStyle.color, opacity: 0.7 }}>{TYPE_INSTRUCTIONS[group.type]}</p>
                </div>

                {test.questions.slice(group.start - 1, group.end).map((q) => {
                  const i = qIndex++;
                  const userAnswer = answers[i] ?? '';
                  const correct = submitted ? isCorrect(q, userAnswer) : null;
                  const isRev = revealed.has(i);

                  return (
                    <div key={i} className="rounded-2xl border overflow-hidden transition-colors"
                      style={{
                        background: passageStyle.bg,
                        borderColor: submitted && correct === true ? 'rgb(34 197 94 / 0.5)'
                          : submitted && correct === false ? 'rgb(239 68 68 / 0.5)'
                          : `${passageStyle.color}25`,
                      }}>
                      <div className="px-4 pt-4 pb-3">
                        <div className="flex items-start gap-3">
                          <span className="shrink-0 w-6 h-6 rounded-full text-white text-xs font-black flex items-center justify-center mt-0.5" style={{ background: 'var(--primary)' }}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-snug font-medium" style={{ color: passageStyle.color }}>{q.question}</p>

                            {mode === 'test' && !submitted && (
                              <QuestionInput q={q} value={userAnswer} onChange={v => setAnswer(i, v)} disabled={false} />
                            )}

                            {mode === 'test' && submitted && userAnswer && (
                              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
                                style={{
                                  background: correct ? 'rgb(34 197 94 / 0.1)' : 'rgb(239 68 68 / 0.1)',
                                  color: correct ? 'rgb(34 197 94)' : 'rgb(239 68 68)',
                                }}>
                                {correct ? '✓' : '✗'} {userAnswer}
                              </div>
                            )}

                            {mode === 'review' && (
                              <button
                                onClick={() => setRevealed(prev => {
                                  const next = new Set(prev);
                                  next.has(i) ? next.delete(i) : next.add(i);
                                  return next;
                                })}
                                className="mt-3 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                                style={{
                                  background: isRev ? 'var(--primary)' : 'var(--surface-2)',
                                  color: isRev ? 'white' : 'var(--text-muted)',
                                }}>
                                {isRev ? 'Hide Answer' : 'Show Answer'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {((mode === 'review' && isRev) || (mode === 'test' && submitted)) && (
                        <AnswerReveal q={q} userAnswer={mode === 'test' ? userAnswer : undefined} submitted={mode === 'test' && submitted} />
                      )}
                    </div>
                  );
                })}
              </div>
            ));
          })()}

          {mode === 'test' && !submitted && (
            <button onClick={handleSubmit}
              className="w-full py-3.5 rounded-2xl text-sm font-black text-white transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-light))' }}>
              Submit Test →
            </button>
          )}

          {mode === 'test' && submitted && (
            <div className="flex gap-3">
              <Link href={`/ielts-reading/${passageId}/${testId}?mode=review`} className="flex-1">
                <button className="w-full py-3 rounded-2xl text-sm font-bold border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">
                  📖 Full Review
                </button>
              </Link>
              <Link href={`/ielts-reading/${passageId}`} className="flex-1">
                <button className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all" style={{ background: 'var(--primary)' }}>
                  ← More Tests
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Options modal */}
      {showOptions && (
        <OptionsModal
          contrast={contrast}
          textSize={textSize}
          onContrast={setContrast}
          onTextSize={setTextSize}
          onClose={() => setShowOptions(false)}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestPage({ params }: { params: Promise<{ passageId: string; testId: string }> }) {
  const { passageId, testId } = use(params);
  return (
    <Suspense>
      <TestPageInner passageId={passageId} testId={testId} />
    </Suspense>
  );
}
