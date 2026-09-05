'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { notFound } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { DEBATE_STEPS } from '@/lib/debateMock';
import { DEBATE_CONTENT, type DebateSide, type VocabItem, type IdiomItem, type ArgumentItem, type RebuttalItem } from '@/lib/debateContent';
import { getStepIndex, setStepIndex, getCaseSelection, setCaseSelection, type CaseSelection } from '@/lib/debateProgress';

const REQUIRED_ARGS = 2;

export default function DebateStepPage() {
  const params = useParams();
  const router = useRouter();
  const topic = String(params.topic);
  const side = String(params.side) as DebateSide;
  const step = String(params.step);

  const content = DEBATE_CONTENT[topic]?.[side];
  const stepMeta = DEBATE_STEPS.find(s => s.key === step);
  const stepIndex = DEBATE_STEPS.findIndex(s => s.key === step);

  if (!content || !stepMeta || stepIndex === -1) notFound();

  function completeStep() {
    const current = getStepIndex(topic, side);
    if (stepIndex + 1 > current) setStepIndex(topic, side, stepIndex + 1);
    const next = DEBATE_STEPS[stepIndex + 1];
    router.push(next ? `/debate/${topic}/${side}/${next.key}` : `/debate/${topic}`);
  }

  const sideLabel = side === 'for' ? 'FOR' : 'AGAINST';
  const sideColor = side === 'for' ? '#22c55e' : '#ef4444';

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5 animate-fade-in">
      <BackButton href={`/debate/${topic}`} label="Topic" />

      <div className="flex items-center gap-2">
        <span className="text-xl">{stepMeta.icon}</span>
        <div>
          <h1 className="text-lg font-bold text-[var(--text)]">{stepMeta.label}</h1>
          <p className="text-xs" style={{ color: sideColor }}>Arguing {sideLabel}</p>
        </div>
        <div className="ml-auto flex gap-1">
          {DEBATE_STEPS.map((s, i) => (
            <span key={s.key} className="w-2 h-2 rounded-full" style={{ background: i <= stepIndex ? sideColor : 'var(--border)' }} />
          ))}
        </div>
      </div>

      {step === 'vocab' && <VocabStep vocab={content.vocab} idioms={content.idioms} color={sideColor} onDone={completeStep} />}
      {step === 'arguments' && (
        <PickYourCaseStep
          topic={topic} side={side}
          items={content.arguments} phraseBank={content.phraseBank}
          color={sideColor} onDone={completeStep}
        />
      )}
      {step === 'build' && (
        <BuildStep
          topic={topic} side={side}
          arguments={content.arguments} phraseBank={content.phraseBank}
          color={sideColor} onDone={completeStep}
        />
      )}
      {step === 'rebuttal' && <RebuttalStep items={content.rebuttals} color={sideColor} onDone={completeStep} />}
      {step === 'deliver' && (
        <DeliverStep
          topic={topic} side={side}
          arguments={content.arguments} phraseBank={content.phraseBank} modelCase={content.modelCase}
          color={sideColor} onDone={completeStep}
        />
      )}
    </div>
  );
}

function StepFooter({ color, onDone, label = 'Continue', disabled = false }: { color: string; onDone: () => void; label?: string; disabled?: boolean }) {
  return (
    <button
      onClick={onDone}
      disabled={disabled}
      className="w-full rounded-xl py-3 font-bold text-white text-sm mt-4 disabled:opacity-40"
      style={{ background: color, boxShadow: disabled ? 'none' : `0 6px 0 ${color}99` }}
    >
      {label}
    </button>
  );
}

// ---------- Vocabulary + Idioms: flip cards through the whole bank ----------
function VocabStep({ vocab, idioms, color, onDone }: { vocab: VocabItem[]; idioms: IdiomItem[]; color: string; onDone: () => void }) {
  const items = useMemo(() => [
    ...vocab.map(v => ({ term: v.term, definition: v.definition, example: v.example, kind: 'vocab' as const })),
    ...idioms.map(i => ({ term: i.idiom, definition: i.definition, example: i.example, kind: 'idiom' as const })),
  ], [vocab, idioms]);

  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const item = items[i];
  const isLast = i === items.length - 1;

  function next() {
    if (!flipped) { setFlipped(true); return; }
    if (isLast) { onDone(); return; }
    setI(i + 1);
    setFlipped(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--text-muted)]">{i + 1} / {items.length}</span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: item.kind === 'idiom' ? '#fce7f3' : '#e0e7ff', color: item.kind === 'idiom' ? '#9d174d' : '#3730a3' }}
        >
          {item.kind === 'idiom' ? 'IDIOM' : 'VOCAB'}
        </span>
      </div>
      <button
        onClick={() => setFlipped(f => !f)}
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center min-h-[160px] flex flex-col items-center justify-center gap-2"
      >
        <div className="font-bold text-xl text-[var(--text)]">{flipped ? item.definition : item.term}</div>
        {flipped && <div className="text-sm text-[var(--text-muted)] italic">“{item.example}”</div>}
      </button>
      <p className="text-center text-xs text-[var(--text-muted)] mt-2">{flipped ? 'tap Next to continue' : 'tap the card to reveal the meaning'}</p>
      <StepFooter color={color} onDone={next} label={!flipped ? 'Flip' : isLast ? 'Continue: Pick Your Case' : 'Next'} />
    </div>
  );
}

// ---------- Pick Your Case: browse full argument bank, choose 2 + opening/closing ----------
function PickYourCaseStep({ topic, side, items, phraseBank, color, onDone }: {
  topic: string; side: DebateSide; items: ArgumentItem[]; phraseBank: string[]; color: string; onDone: () => void;
}) {
  const [sel, setSel] = useState<CaseSelection>({ argIndices: [], openingIdx: null, closingIdx: null });
  const [phase, setPhase] = useState<'pick-args' | 'pick-phrases'>('pick-args');
  const [revealedIdx, setRevealedIdx] = useState<number | null>(null);

  useEffect(() => {
    setSel(getCaseSelection(topic, side));
  }, [topic, side]);

  function toggleArg(idx: number) {
    setSel(prev => {
      const has = prev.argIndices.includes(idx);
      if (has) return { ...prev, argIndices: prev.argIndices.filter(i => i !== idx) };
      if (prev.argIndices.length >= REQUIRED_ARGS) return prev;
      return { ...prev, argIndices: [...prev.argIndices, idx] };
    });
  }

  function confirm() {
    setCaseSelection(topic, side, sel);
    onDone();
  }

  if (phase === 'pick-args') {
    return (
      <div>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Browse the argument bank, then pick your {REQUIRED_ARGS} strongest — the ones you’ll actually build your case from.
          <span className="font-semibold" style={{ color }}> {sel.argIndices.length}/{REQUIRED_ARGS} selected</span>
        </p>
        <div className="space-y-2">
          {items.map((it, idx) => {
            const picked = sel.argIndices.includes(idx);
            const revealed = revealedIdx === idx;
            return (
              <div key={idx} className="rounded-2xl border p-4" style={{ borderColor: picked ? color : 'var(--border)', background: picked ? `${color}14` : 'var(--surface)' }}>
                <div className="flex items-start justify-between gap-3">
                  <button className="text-left flex-1" onClick={() => setRevealedIdx(revealed ? null : idx)}>
                    <div className="font-bold text-sm text-[var(--text)]">{it.claim}</div>
                    {revealed && (
                      <div className="text-xs text-[var(--text-muted)] mt-2 space-y-1.5">
                        <div>{it.evidence}</div>
                        <div className="italic">“{it.phrase}”</div>
                      </div>
                    )}
                    {!revealed && <div className="text-xs text-[var(--text-muted)] mt-1">tap to expand</div>}
                  </button>
                  <button
                    onClick={() => toggleArg(idx)}
                    className="shrink-0 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold border-2"
                    style={{ borderColor: color, background: picked ? color : 'transparent', color: picked ? 'white' : color }}
                  >
                    {picked ? '✓' : '+'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <StepFooter color={color} onDone={() => setPhase('pick-phrases')} label="Choose opening & closing lines" disabled={sel.argIndices.length < REQUIRED_ARGS} />
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-[var(--text-muted)] mb-3">Pick one line to open your case, and a different one to close it.</p>
      <div className="mb-4">
        <div className="text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">Opening line</div>
        <div className="space-y-1.5">
          {phraseBank.map((p, idx) => (
            <button
              key={idx}
              disabled={sel.closingIdx === idx}
              onClick={() => setSel(prev => ({ ...prev, openingIdx: idx }))}
              className="w-full text-left rounded-xl px-3 py-2 text-sm border disabled:opacity-30"
              style={{ borderColor: sel.openingIdx === idx ? color : 'var(--border)', background: sel.openingIdx === idx ? `${color}14` : 'var(--surface-2)', color: 'var(--text)' }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-2">
        <div className="text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">Closing line</div>
        <div className="space-y-1.5">
          {phraseBank.map((p, idx) => (
            <button
              key={idx}
              disabled={sel.openingIdx === idx}
              onClick={() => setSel(prev => ({ ...prev, closingIdx: idx }))}
              className="w-full text-left rounded-xl px-3 py-2 text-sm border disabled:opacity-30"
              style={{ borderColor: sel.closingIdx === idx ? color : 'var(--border)', background: sel.closingIdx === idx ? `${color}14` : 'var(--surface-2)', color: 'var(--text)' }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <StepFooter color={color} onDone={confirm} label="Continue: Build Your Case" disabled={sel.openingIdx === null || sel.closingIdx === null} />
    </div>
  );
}

// ---------- Build Your Case: order your personally picked pieces ----------
function BuildStep({ topic, side, arguments: bank, phraseBank, color, onDone }: {
  topic: string; side: DebateSide; arguments: ArgumentItem[]; phraseBank: string[]; color: string; onDone: () => void;
}) {
  const [sel, setSel] = useState<CaseSelection | null>(null);
  useEffect(() => { setSel(getCaseSelection(topic, side)); }, [topic, side]);

  const pieces = useMemo(() => {
    if (!sel || sel.openingIdx === null || sel.closingIdx === null || sel.argIndices.length < REQUIRED_ARGS) return null;
    const correctOrder = [
      phraseBank[sel.openingIdx],
      ...sel.argIndices.map(i => bank[i].phrase),
      phraseBank[sel.closingIdx],
    ];
    const arr = correctOrder.map((text, correctIndex) => ({ text, correctIndex }));
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [sel, bank, phraseBank]);

  const [placed, setPlaced] = useState<{ text: string; correctIndex: number }[]>([]);
  const [checked, setChecked] = useState(false);

  if (!sel) return null;
  if (!pieces) {
    return <p className="text-sm text-[var(--text-muted)]">Go back and pick your case first — no arguments or phrases selected yet.</p>;
  }

  const remaining = pieces.filter(p => !placed.includes(p));
  const allPlaced = placed.length === pieces.length;

  return (
    <div>
      <p className="text-xs text-[var(--text-muted)] mb-2">These are the pieces you picked. Tap them in the order a strong case should flow.</p>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 min-h-[140px] space-y-2 mb-3">
        {placed.length === 0 && <div className="text-xs text-[var(--text-muted)] text-center py-8">Your case will build here</div>}
        {placed.map((p, idx) => {
          const correct = checked && p.correctIndex === idx;
          const wrong = checked && p.correctIndex !== idx;
          return (
            <div key={p.text} className="rounded-xl px-3 py-2 text-sm text-[var(--text)] border" style={{
              borderColor: checked ? (correct ? '#22c55e' : '#ef4444') : 'var(--border)',
              background: checked ? (correct ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)') : 'var(--surface-2)',
            }}>
              <span className="text-[10px] font-bold mr-2 text-[var(--text-muted)]">{idx + 1}</span>
              {p.text} {wrong && '✗'} {correct && '✓'}
            </div>
          );
        })}
      </div>

      {!allPlaced && (
        <div className="flex flex-wrap gap-2">
          {remaining.map(p => (
            <button
              key={p.text}
              onClick={() => !checked && setPlaced(prev => [...prev, p])}
              className="rounded-xl px-3 py-2 text-sm text-left border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:-translate-y-0.5 transition-transform"
            >
              {p.text}
            </button>
          ))}
        </div>
      )}

      {allPlaced && !checked && (
        <button onClick={() => setChecked(true)} className="w-full rounded-xl py-3 font-bold text-white text-sm mt-2" style={{ background: color }}>
          Check my case
        </button>
      )}

      {checked && (
        <div className="space-y-2 mt-2">
          <button onClick={() => { setPlaced([]); setChecked(false); }} className="w-full rounded-xl py-2.5 font-bold text-sm border border-[var(--border)] text-[var(--text)]">
            Try again
          </button>
          <StepFooter color={color} onDone={onDone} label="Continue: Rebuttal" />
        </div>
      )}
    </div>
  );
}

// ---------- Rebuttal: multiple choice ----------
function RebuttalStep({ items, color, onDone }: { items: RebuttalItem[]; color: string; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const item = items[i];
  const isLast = i === items.length - 1;

  function next() {
    if (picked === null) return;
    if (isLast) { onDone(); return; }
    setI(i + 1);
    setPicked(null);
  }

  return (
    <div>
      <div className="text-xs text-[var(--text-muted)] mb-2">{i + 1} / {items.length}</div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 mb-3">
        <div className="text-xs text-[var(--text-muted)] mb-1">Opponent says:</div>
        <div className="font-bold text-[var(--text)]">“{item.opposing}”</div>
      </div>
      <div className="space-y-2">
        {item.options.map((opt, idx) => {
          const isPicked = picked === idx;
          const show = picked !== null;
          const good = show && opt.correct;
          const bad = show && isPicked && !opt.correct;
          return (
            <button
              key={idx}
              onClick={() => picked === null && setPicked(idx)}
              disabled={picked !== null}
              className="w-full text-left rounded-xl px-3 py-2.5 text-sm border"
              style={{
                borderColor: good ? '#22c55e' : bad ? '#ef4444' : 'var(--border)',
                background: good ? 'rgba(34,197,94,0.1)' : bad ? 'rgba(239,68,68,0.08)' : 'var(--surface-2)',
                color: 'var(--text)',
              }}
            >
              {opt.text} {good && '✓'} {bad && '✗'}
            </button>
          );
        })}
      </div>
      {picked !== null && <StepFooter color={color} onDone={next} label={isLast ? 'Continue: Deliver' : 'Next rebuttal'} />}
    </div>
  );
}

// ---------- Deliver: your own case, timed ----------
function DeliverStep({ topic, side, arguments: bank, phraseBank, modelCase, color, onDone }: {
  topic: string; side: DebateSide; arguments: ArgumentItem[]; phraseBank: string[]; modelCase: string; color: string; onDone: () => void;
}) {
  const [sel, setSel] = useState<CaseSelection | null>(null);
  useEffect(() => { setSel(getCaseSelection(topic, side)); }, [topic, side]);

  const myCase = useMemo(() => {
    if (!sel || sel.openingIdx === null || sel.closingIdx === null || sel.argIndices.length < REQUIRED_ARGS) return null;
    return [phraseBank[sel.openingIdx], ...sel.argIndices.map(i => bank[i].claim), phraseBank[sel.closingIdx]].join(' ');
  }, [sel, bank, phraseBank]);

  const DURATION = 45;
  const [seconds, setSeconds] = useState(DURATION);
  const [running, setRunning] = useState(false);
  const [hideText, setHideText] = useState(false);
  const [finished, setFinished] = useState(false);
  const [showModel, setShowModel] = useState(false);

  useEffect(() => {
    if (!running || seconds <= 0) return;
    const t = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [running, seconds]);

  useEffect(() => {
    if (running && seconds === 0) { setRunning(false); setFinished(true); }
  }, [running, seconds]);

  if (!sel) return null;

  return (
    <div>
      <p className="text-xs text-[var(--text-muted)] mb-3">Deliver the case you built out loud, cold. {DURATION}s on the clock.</p>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--text)] leading-relaxed transition-all" style={{ filter: hideText ? 'blur(6px)' : 'none' }}>
        {myCase ?? 'Go back and finish Pick Your Case + Build first.'}
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="text-2xl font-extrabold tabular-nums" style={{ color }}>{seconds}s</div>
        {!running && !finished && myCase && (
          <button onClick={() => { setRunning(true); setHideText(true); }} className="rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ background: color }}>
            Start delivery
          </button>
        )}
        {running && (
          <button onClick={() => setHideText(h => !h)} className="rounded-xl px-4 py-2 text-sm font-bold border border-[var(--border)] text-[var(--text)]">
            {hideText ? 'Peek at text' : 'Hide text'}
          </button>
        )}
      </div>

      <button onClick={() => setShowModel(s => !s)} className="text-xs mt-4 underline text-[var(--text-muted)]">
        {showModel ? 'Hide model case' : 'Compare with a model case'}
      </button>
      {showModel && (
        <div className="rounded-xl mt-2 p-3 text-xs italic text-[var(--text-muted)]" style={{ background: 'var(--surface-2)' }}>
          {modelCase}
        </div>
      )}

      {(finished || !running) && (
        <StepFooter color={color} onDone={onDone} label={finished ? 'Mark this side complete' : 'Skip timer, mark complete'} />
      )}
    </div>
  );
}
