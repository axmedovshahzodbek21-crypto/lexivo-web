'use client';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import BackButton from '@/components/BackButton';
import { IeltsPassageTest, IeltsQuestion, MatchingExample, NoteLine, NoteLineStyle, FlowChartStep } from '@/lib/ielts-data';

// ─── Constants ───────────────────────────────────────────────────────────────

const ROMANS = ['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii','xiii','xiv','xv'];
const LETTERS = ['A','B','C','D','E','F','G','H','I','J','K'];

function letterList(n: number) {
  const ls = LETTERS.slice(0, n);
  if (n <= 1) return ls[0] ?? 'A';
  return ls.slice(0, -1).join(', ') + ' or ' + ls[ls.length - 1];
}

function ExampleBox({ example, color }: { example: MatchingExample; color: string }) {
  return (
    <div style={{ border: `1px solid ${color}`, display: 'inline-block', padding: '8px 16px', marginTop: 8, marginBottom: 4 }}>
      <div style={{ display: 'flex', gap: 24, fontSize: 13, color }}>
        <span style={{ fontStyle: 'italic', fontWeight: 700 }}>Example</span>
        <span style={{ fontStyle: 'italic', fontWeight: 700 }}>Answer</span>
      </div>
      <div style={{ display: 'flex', gap: 24, fontSize: 13, color, marginTop: 4 }}>
        <span>{example.label}</span>
        <span style={{ fontWeight: 700 }}>{example.answer}</span>
      </div>
    </div>
  );
}

function QuestionInstruction({ type, start, end, passageId, color, paragraphLabels, options, featureListTitle, wordLimit, example }: {
  type: string; start: number; end: number; passageId: string; color: string;
  paragraphLabels?: string; options?: string[]; featureListTitle?: string;
  wordLimit?: string; example?: MatchingExample;
}) {
  const range = end > start ? `${start}–${end}` : `${start}`;
  const it: React.CSSProperties = { fontStyle: 'italic', color, display: 'block', marginBottom: 6 };
  const kw: React.CSSProperties = { fontWeight: 900, fontStyle: 'italic', color, minWidth: 90, display: 'inline-block' };
  const vl: React.CSSProperties = { fontStyle: 'italic', color };
  const nb: React.CSSProperties = { color, display: 'block', marginBottom: 6 };
  const box: React.CSSProperties = { border: `1px solid ${color}`, display: 'inline-block', padding: '10px 20px', marginTop: 8, marginBottom: 4, minWidth: 200 };

  const head = <span style={{ ...it, marginBottom: 10 }}>Questions {range}</span>;
  const exampleBox = example ? <ExampleBox example={example} color={color} /> : null;

  switch (type) {
    case 'true_false_not_given':
      return <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {head}
        <span style={it}>Do the following statements agree with the information given in Reading Passage {passageId}?</span>
        <span style={it}>In boxes {range} on your answer sheet, write</span>
        <div style={{ paddingLeft: 16, marginTop: 4 }}>
          {[['TRUE','if the statement agrees with the information'],['FALSE','if the statement contradicts the information'],['NOT GIVEN','if there is no information on this']].map(([k,v]) => (
            <div key={k} style={{ display: 'flex', gap: 16, marginBottom: 2 }}><span style={kw}>{k}</span><span style={vl}>{v}</span></div>
          ))}
        </div>
      </div>;

    case 'yes_no_not_given':
      return <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {head}
        <span style={it}>Do the following statements agree with the views of the writer in Reading Passage {passageId}?</span>
        <span style={it}>In boxes {range} on your answer sheet, write</span>
        <div style={{ paddingLeft: 16, marginTop: 4 }}>
          {[['YES','if the statement agrees with the views of the writer'],['NO','if the statement contradicts the views of the writer'],['NOT GIVEN','if it is impossible to say what the writer thinks about this']].map(([k,v]) => (
            <div key={k} style={{ display: 'flex', gap: 16, marginBottom: 2 }}><span style={kw}>{k}</span><span style={vl}>{v}</span></div>
          ))}
        </div>
      </div>;

    case 'multiple_choice':
      return <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {head}
        <span style={it}>Choose the correct letter, <strong>A</strong>, <strong>B</strong>, <strong>C</strong> or <strong>D</strong>.</span>
        <span style={it}>Write the correct letter in boxes {range} on your answer sheet.</span>
      </div>;

    case 'multiple_choice_multi':
      return <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {head}
        <span style={it}>Choose <strong>TWO</strong> letters, <strong>A–E</strong>.</span>
        <span style={it}>Write the correct letters in boxes {range} on your answer sheet.</span>
      </div>;

    case 'matching_information': {
      const pl = paragraphLabels ?? 'A–G';
      return <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {head}
        <span style={it}>Reading Passage {passageId} has several paragraphs, <strong>{pl}</strong>.</span>
        <span style={it}>Which section contains the following information?</span>
        <span style={it}>Write the correct letter, <strong>{pl}</strong>, in boxes {range} on your answer sheet.</span>
        <span style={nb}><strong>NB</strong> You may use any letter more than once.</span>
        {exampleBox}
      </div>;
    }

    case 'matching_headings': {
      const pl = paragraphLabels ?? 'A–G';
      const romans = options ? ROMANS.slice(0, options.length) : ROMANS.slice(0, 7);
      const romanRange = `${romans[0]}–${romans[romans.length - 1]}`;
      return <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {head}
        <span style={it}>Reading Passage {passageId} has several paragraphs, <strong>{pl}</strong>.</span>
        <span style={it}>Choose the correct heading for each paragraph from the list of headings below.</span>
        <span style={it}>Write the correct number, <strong><em>{romanRange}</em></strong>, in boxes {range} on your answer sheet.</span>
        {exampleBox}
        {options && options.length > 0 && (
          <div style={box}>
            <div style={{ fontWeight: 700, color, textAlign: 'center', marginBottom: 10 }}>List of Headings</div>
            {options.map((opt, i) => (
              <div key={i} style={{ color, marginBottom: 5, display: 'flex', gap: 12 }}>
                <span style={{ fontStyle: 'italic', minWidth: 28 }}>{romans[i]}</span>
                <span>{opt}</span>
              </div>
            ))}
          </div>
        )}
      </div>;
    }

    case 'matching_features': {
      const n = options?.length ?? 3;
      const ll = letterList(n);
      const noun = featureListTitle ? featureListTitle.replace('List of ', '').toLowerCase().replace(/s$/, '') : 'person';
      const listLabel = featureListTitle ?? 'List of People';
      return <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {head}
        <span style={{ color, display: 'block', marginBottom: 6 }}>Look at the following statements and the list of {listLabel.replace('List of ', '').toLowerCase()} below.</span>
        <span style={{ color, display: 'block', marginBottom: 6 }}>Match each statement with the correct {noun}, <strong>{ll}</strong>.</span>
        <span style={nb}><strong>NB</strong> You may use any letter more than once.</span>
        {exampleBox}
        {options && options.length > 0 && (
          <div style={box}>
            <div style={{ fontWeight: 700, color, marginBottom: 8 }}>{listLabel}</div>
            {options.map((opt, i) => (
              <div key={i} style={{ color, marginBottom: 4 }}>
                <strong>{LETTERS[i]}</strong>&nbsp;&nbsp;{opt}
              </div>
            ))}
          </div>
        )}
      </div>;
    }

    case 'matching_sentence_endings': {
      const n = options?.length ?? 7;
      const endRange = `A–${LETTERS[n - 1]}`;
      return <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {head}
        <span style={it}>Complete each sentence with the correct ending, <strong>{endRange}</strong>, below.</span>
        <span style={it}>Write the correct letter in boxes {range} on your answer sheet.</span>
        {exampleBox}
      </div>;
    }

    case 'sentence_completion':
      return <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {head}
        <span style={it}>Complete the sentences below.</span>
        <span style={it}>Choose <strong>{wordLimit ?? 'ONE WORD ONLY'}</strong> from the passage for each answer.</span>
        <span style={it}>Write your answers in boxes {range} on your answer sheet.</span>
      </div>;

    case 'summary_completion':
      return <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {head}
        <span style={it}>Complete the summary below.</span>
        <span style={it}>Choose <strong>{wordLimit ?? 'ONE WORD ONLY'}</strong> from the passage for each answer.</span>
        <span style={it}>Write your answers in boxes {range} on your answer sheet.</span>
      </div>;

    case 'short_answer':
      return <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {head}
        <span style={it}>Answer the questions below.</span>
        <span style={it}>Choose <strong>{wordLimit ?? 'NO MORE THAN THREE WORDS'}</strong> from the passage for each answer.</span>
        <span style={it}>Write your answers in boxes {range} on your answer sheet.</span>
      </div>;

    case 'note_completion':
      return <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {head}
        <span style={it}>Complete the notes below.</span>
        <span style={it}>Write <strong>{wordLimit ?? 'ONE WORD ONLY'}</strong> from the passage for each answer.</span>
      </div>;

    case 'flow_chart_completion':
      return <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {head}
        <span style={it}>Complete the flow-chart below.</span>
        <span style={it}>Write <strong>{wordLimit ?? 'ONE WORD ONLY'}</strong> from the passage for each answer.</span>
      </div>;

    default:
      return <div style={{ fontSize: 13, lineHeight: 1.6 }}>{head}</div>;
  }
}

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

const ANSWER_HIGHLIGHT_COLOR = 'rgba(251, 146, 60, 0.45)'; // amber — distinct from manual highlights

function highlightChunk(nodes: { node: Text; start: number }[], accumulated: string, chunk: string, color: string): HTMLElement[] {
  const matchIdx = accumulated.toLowerCase().indexOf(chunk.toLowerCase());
  if (matchIdx === -1) return [];
  const matchEnd = matchIdx + chunk.length;
  const highlighted: HTMLElement[] = [];
  for (const { node, start } of nodes) {
    const end = start + (node.textContent?.length ?? 0);
    if (end <= matchIdx || start >= matchEnd) continue;
    const localStart = Math.max(0, matchIdx - start);
    const localEnd = Math.min(node.textContent?.length ?? 0, matchEnd - start);
    const range = document.createRange();
    range.setStart(node, localStart);
    range.setEnd(node, localEnd);
    const span = document.createElement('span');
    span.style.backgroundColor = color;
    span.style.borderRadius = '2px';
    span.dataset.answerHighlight = 'true';
    try {
      range.surroundContents(span);
    } catch {
      try { const frag = range.extractContents(); span.appendChild(frag); range.insertNode(span); } catch { continue; }
    }
    highlighted.push(span);
  }
  return highlighted;
}

function findAndHighlightExcerpt(container: HTMLElement, excerpt: string): HTMLElement[] {
  // Strip trailing ellipsis, then split on mid-excerpt ellipsis
  const trimmed = excerpt.replace(/\s*(?:…|\.{3})$/, '').trim();
  const chunks = trimmed.split(/\s*(?:…|\.{3})\s*/).map(c => c.trim()).filter(c => c.length > 8);
  if (chunks.length === 0) return [];

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let accumulated = '';
  const nodes: { node: Text; start: number }[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    nodes.push({ node, start: accumulated.length });
    accumulated += node.textContent ?? '';
  }

  const allHighlighted: HTMLElement[] = [];
  for (const chunk of chunks) {
    const spans = highlightChunk(nodes, accumulated, chunk, ANSWER_HIGHLIGHT_COLOR);
    allHighlighted.push(...spans);
  }
  if (allHighlighted.length > 0) allHighlighted[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  return allHighlighted;
}

function removeAnswerHighlights(spans: HTMLElement[]) {
  for (const span of spans) {
    const parent = span.parentNode;
    if (!parent) continue;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
  }
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

function RadioGroup({ name, options, value, onChange, disabled }: {
  name: string; options: string[]; value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {options.map((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        const checked = value === letter || value === opt;
        return (
          <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
            <input type="radio" name={name} checked={checked} disabled={disabled} onChange={() => onChange(letter)}
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

function QuestionInput({ q, name, value, onChange, disabled }: {
  q: IeltsQuestion; name: string; value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  switch (q.type) {
    case 'true_false_not_given':
      return <PillSelect options={['TRUE', 'FALSE', 'NOT GIVEN']} value={value} onChange={onChange} disabled={disabled} />;
    case 'yes_no_not_given':
      return <PillSelect options={['YES', 'NO', 'NOT GIVEN']} value={value} onChange={onChange} disabled={disabled} />;
    case 'multiple_choice':
      return q.options ? <RadioGroup name={name} options={q.options} value={value} onChange={onChange} disabled={disabled} /> : <TextInput value={value} onChange={onChange} disabled={disabled} />;
    case 'multiple_choice_multi':
      return q.options ? <MultiCheckbox options={q.options} value={value} onChange={onChange} disabled={disabled} /> : <TextInput value={value} onChange={onChange} disabled={disabled} placeholder="Comma-separated answers…" />;
    case 'matching_information':
    case 'matching_features':
    case 'matching_sentence_endings': {
      const n = q.options?.length ?? 7;
      const pills = LETTERS.slice(0, n);
      return <PillSelect options={pills} value={value} onChange={onChange} disabled={disabled} />;
    }
    case 'matching_headings': {
      const n = q.options?.length ?? 7;
      const pills = ROMANS.slice(0, n);
      return <PillSelect options={pills} value={value} onChange={onChange} disabled={disabled} />;
    }
    default:
      return <TextInput value={value} onChange={onChange} disabled={disabled} />;
  }
}

// ─── Answer reveal ───────────────────────────────────────────────────────────

function AnswerReveal({ q, userAnswer, submitted, passageColor }: {
  q: IeltsQuestion; userAnswer?: string; submitted?: boolean; passageColor: string;
}) {
  const correct = submitted && userAnswer !== undefined ? isCorrect(q, userAnswer) : null;
  return (
    <div className="border-t px-4 py-4 space-y-3" style={{ borderColor: `${passageColor}25` }}>
      {submitted && userAnswer !== undefined && (
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${correct ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500'}`}>
            {correct ? '✓ Correct' : '✗ Incorrect'}
          </span>
          {!correct && userAnswer && (
            <span className="text-xs" style={{ color: passageColor, opacity: 0.6 }}>Your answer: <strong>{userAnswer}</strong></span>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: passageColor, opacity: 0.6 }}>Answer:</span>
        <span className="px-2 py-0.5 rounded-lg text-sm font-black text-white" style={{ background: 'var(--primary)' }}>{q.answer}</span>
      </div>
      <div className="rounded-xl p-3" style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)', borderLeft: '3px solid var(--primary)' }}>
        <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--primary)' }}>From the passage</p>
        <p className="text-sm italic leading-snug" style={{ color: passageColor }}>"{q.passage_excerpt}"</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: passageColor, opacity: 0.6 }}>Why?</p>
        <p className="text-sm leading-snug" style={{ color: passageColor, opacity: 0.75 }}>{q.explanation}</p>
      </div>
    </div>
  );
}

// ─── Summary block ───────────────────────────────────────────────────────────

// Shared by SummaryBlock, NoteBlock, and FlowChartBlock: splits text on [N] placeholders
// and renders each blank as an editable input/select (test mode) or a reveal (review mode).
function renderInlineBlanks({
  text, startIdx, groupQuestions, answers, onChange, mode, submitted, passageStyle, fontSize, wordOptions,
}: {
  text: string; startIdx: number; groupQuestions: IeltsQuestion[];
  answers: Record<number, string>; onChange: (idx: number, val: string) => void;
  mode: string; submitted: boolean; passageStyle: { bg: string; color: string }; fontSize: number;
  wordOptions?: string[];
}) {
  const parts = text.split(/\[(\d+)\]/g);
  const c = passageStyle.color;
  const inputStyle: React.CSSProperties = {
    width: 110, border: 'none', borderBottom: `1.5px solid ${c}`,
    background: 'transparent', color: c, fontSize, padding: '0 2px',
    outline: 'none', display: 'inline',
  };
  return parts.map((part, pi) => {
    if (pi % 2 === 0) return <span key={pi}>{part}</span>;
    const qNum = parseInt(part);
    const answerIdx = qNum - 1;
    const localIdx = qNum - (startIdx + 1);
    const q = groupQuestions[localIdx];
    const val = answers[answerIdx] ?? '';
    const correct = submitted && q ? isCorrect(q, val) : null;
    if (mode === 'test' && !submitted) {
      if (wordOptions) {
        return (
          <span key={pi} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, margin: '0 2px' }}>
            <strong style={{ color: c }}>{qNum}</strong>
            <select value={val} onChange={e => onChange(answerIdx, e.target.value)}
              style={{ border: `1px solid ${c}`, background: passageStyle.bg, color: c, padding: '1px 4px', fontSize: fontSize - 1, borderRadius: 3 }}>
              <option value="">—</option>
              {wordOptions.map((_, si) => <option key={si} value={LETTERS[si]}>{LETTERS[si]}</option>)}
            </select>
          </span>
        );
      }
      return (
        <span key={pi} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, margin: '0 2px' }}>
          <strong style={{ color: c }}>{qNum}</strong>
          <input value={val} onChange={e => onChange(answerIdx, e.target.value)} style={inputStyle} />
        </span>
      );
    }
    const displayVal = val || (q?.answer ?? '…');
    return (
      <span key={pi} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, margin: '0 2px' }}>
        <strong style={{ color: c }}>{qNum}</strong>
        <span style={{ fontWeight: 700, color: correct === false ? 'rgb(239 68 68)' : correct === true ? 'rgb(34 197 94)' : 'var(--primary)', borderBottom: `1.5px solid currentColor`, padding: '0 2px' }}>
          {displayVal}
        </span>
      </span>
    );
  });
}

function SummaryBlock({ text, title, summaryOptions, groupQuestions, startIdx, answers, onChange, mode, submitted, passageStyle, fontSize }: {
  text: string; title?: string; summaryOptions?: string[];
  groupQuestions: IeltsQuestion[]; startIdx: number;
  answers: Record<number, string>; onChange: (idx: number, val: string) => void;
  mode: string; submitted: boolean;
  passageStyle: { bg: string; color: string }; fontSize: number;
}) {
  const c = passageStyle.color;
  return (
    <div style={{ margin: '8px 0' }}>
      <div style={{ border: `1px solid ${c}`, padding: '14px 20px' }}>
        {title && <p style={{ fontWeight: 700, textAlign: 'center', marginBottom: 12, color: c, fontSize }}>{title}</p>}
        <p style={{ fontSize, lineHeight: 1.85, color: c }}>
          {renderInlineBlanks({ text, startIdx, groupQuestions, answers, onChange, mode, submitted, passageStyle, fontSize, wordOptions: summaryOptions })}
        </p>
      </div>
      {summaryOptions && summaryOptions.length > 0 && (
        <div style={{ border: `1px solid ${c}`, marginTop: 8, padding: '10px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 20px' }}>
          {summaryOptions.map((opt, i) => (
            <div key={i} style={{ color: c, fontSize: fontSize - 1 }}>
              <strong>{LETTERS[i]}</strong>&nbsp;&nbsp;{opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NoteBlock({ lines, groupQuestions, startIdx, answers, onChange, mode, submitted, passageStyle, fontSize }: {
  lines: NoteLine[]; groupQuestions: IeltsQuestion[]; startIdx: number;
  answers: Record<number, string>; onChange: (idx: number, val: string) => void;
  mode: string; submitted: boolean; passageStyle: { bg: string; color: string }; fontSize: number;
}) {
  const c = passageStyle.color;
  const styleFor: Record<NoteLineStyle, React.CSSProperties> = {
    heading: { fontWeight: 700, marginTop: 10, marginBottom: 2 },
    subheading: { fontWeight: 700, fontStyle: 'italic', marginTop: 8, marginBottom: 2, paddingLeft: 8 },
    bullet: { marginBottom: 2, paddingLeft: 24 },
    'numbered-sub-item': { marginBottom: 2, paddingLeft: 40 },
  };
  return (
    <div style={{ margin: '8px 0', border: `1px solid ${c}`, padding: '14px 20px' }}>
      {lines.map((line, li) => (
        <p key={li} style={{ fontSize, lineHeight: 1.85, color: c, ...styleFor[line.style] }}>
          {line.style === 'bullet' && '• '}
          {renderInlineBlanks({ text: line.text, startIdx, groupQuestions, answers, onChange, mode, submitted, passageStyle, fontSize })}
        </p>
      ))}
    </div>
  );
}

function FlowChartBlock({ steps, groupQuestions, startIdx, answers, onChange, mode, submitted, passageStyle, fontSize }: {
  steps: FlowChartStep[]; groupQuestions: IeltsQuestion[]; startIdx: number;
  answers: Record<number, string>; onChange: (idx: number, val: string) => void;
  mode: string; submitted: boolean; passageStyle: { bg: string; color: string }; fontSize: number;
}) {
  const c = passageStyle.color;
  return (
    <div style={{ margin: '8px 0' }}>
      {steps.map((step, si) => (
        <div key={si}>
          <div style={{ border: `1px solid ${c}`, padding: '10px 16px' }}>
            <p style={{ fontSize, lineHeight: 1.85, color: c, margin: 0 }}>
              {step.label && <strong>{step.label}: </strong>}
              {renderInlineBlanks({ text: step.text, startIdx, groupQuestions, answers, onChange, mode, submitted, passageStyle, fontSize })}
            </p>
          </div>
          {si < steps.length - 1 && (
            <div style={{ textAlign: 'center', color: c, fontSize: fontSize + 4, lineHeight: 1, padding: '2px 0' }}>↓</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── TestRenderer ──────────────────────────────────────────────────────────────

export interface TestRendererProps {
  /** Passage/section number, e.g. "1". Used in instruction text and the Back link. */
  passageId: string;
  /** Test number within the section. Used for the timer session-storage key and review links. Omit in preview. */
  testId?: string;
  test: IeltsPassageTest;
  mode: 'test' | 'review';
  /**
   * When true, renders a static preview suitable for the content builder: no timer/session storage,
   * no Back/Lexivo navigation, no submit flow — always behaves like review mode with "Show Answer" toggles.
   */
  preview?: boolean;
}

export function TestRenderer({ passageId, testId, test, mode: modeProp, preview = false }: TestRendererProps) {
  const mode = preview ? 'review' : modeProp;

  const timerKey = `ielts_timer_${passageId}_${testId ?? 'preview'}`;

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (mode !== 'test' || typeof window === 'undefined') return TIMER_SECONDS;
    try {
      const stored = sessionStorage.getItem(timerKey);
      if (stored) {
        const { startedAt } = JSON.parse(stored);
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        const remaining = TIMER_SECONDS - elapsed;
        if (remaining > 0) return remaining;
      }
      sessionStorage.setItem(timerKey, JSON.stringify({ startedAt: Date.now() }));
    } catch {}
    return TIMER_SECONDS;
  });
  const [timerActive, setTimerActive] = useState(mode === 'test');
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  // Options state
  const [showOptions, setShowOptions] = useState(false);
  const [contrast, setContrast] = useState('Black on white');
  const [textSize, setTextSize] = useState('Medium');

  // Resizable columns
  const [passageWidthPct, setPassageWidthPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const passageRef = useRef<HTMLDivElement>(null);
  const answerHighlights = useRef<Map<number, HTMLElement[]>>(new Map());

  // Sync answer highlights with revealed set (review mode only)
  useEffect(() => {
    if (mode !== 'review' || !passageRef.current || !test) return;
    // Remove highlights for hidden questions
    for (const [idx, spans] of answerHighlights.current.entries()) {
      if (!revealed.has(idx)) {
        removeAnswerHighlights(spans);
        answerHighlights.current.delete(idx);
      }
    }
    // Add highlights for newly revealed questions
    for (const idx of revealed) {
      if (!answerHighlights.current.has(idx)) {
        const excerpt = test.questions[idx]?.passage_excerpt;
        if (excerpt && passageRef.current) {
          const spans = findAndHighlightExcerpt(passageRef.current, excerpt);
          if (spans.length > 0) answerHighlights.current.set(idx, spans);
        }
      }
    }
  }, [revealed, mode, test]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setPassageWidthPct(Math.min(Math.max(pct, 25), 75));
    };
    const onUp = () => { isDragging.current = false; document.body.style.cursor = ''; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, []);

  // Highlight toolbar
  const HIGHLIGHT_COLORS = ['#FFEB3B', '#86EFAC', '#93C5FD', '#F9A8D4'];
  const [floatingBar, setFloatingBar] = useState<{ x: number; y: number } | null>(null);

  const handleTextMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) { setFloatingBar(null); return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setFloatingBar({ x: rect.left + rect.width / 2, y: rect.top + window.scrollY });
  };

  const applyHighlight = (color: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const span = document.createElement('span');
    span.style.backgroundColor = color;
    span.dataset.highlight = 'true';
    try { range.surroundContents(span); }
    catch { const frag = range.extractContents(); span.appendChild(frag); range.insertNode(span); }
    sel.removeAllRanges();
    setFloatingBar(null);
  };

  const removeHighlight = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const ancestor = range.commonAncestorContainer;
    const el = (ancestor.nodeType === 3 ? ancestor.parentElement : ancestor) as HTMLElement | null;
    if (el?.dataset?.highlight === 'true') {
      const parent = el.parentNode!;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    }
    sel.removeAllRanges();
    setFloatingBar(null);
  };

  const setAnswer = useCallback((i: number, val: string) => {
    setAnswers(prev => ({ ...prev, [i]: val }));
  }, []);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    setTimerActive(false);
    sessionStorage.removeItem(timerKey);
  }, [timerKey]);

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

  const paragraphs = test.content.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const score = submitted ? test.questions.filter((q, i) => isCorrect(q, answers[i] ?? '')).length : null;
  const timerColor = secondsLeft < 300 ? 'text-red-500' : secondsLeft < 600 ? 'text-orange-400' : 'text-[var(--text)]';

  const passageStyle = CONTRAST_STYLES[contrast];
  const fontSize = TEXT_SIZES[textSize] ?? 15;

  return (
    <div className="flex flex-col" style={{ height: preview ? '100%' : '100dvh' }}>
      {/* Top bar */}
      <div className="shrink-0 px-4 py-2">
        {/* Row 1: Back | Timer (center) | Options + Lexivo */}
        <div className="flex items-center justify-between gap-4">
          {!preview ? (
            <BackButton href={`/ielts-reading/${passageId}`} label="Back to Tests" className="shrink-0" />
          ) : (
            <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider shrink-0">Preview</p>
          )}

          {/* Timer centered */}
          <div className="flex-1 flex justify-center">
            {mode === 'test' && !submitted && (
              <div className="text-center">
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider leading-none mb-0.5">TIME LEFT</p>
                <p className={`text-2xl font-black font-mono tabular-nums leading-none ${timerColor}`}>{formatTime(secondsLeft)}</p>
              </div>
            )}
            {mode === 'test' && submitted && score !== null && (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--primary)] px-4 py-1.5" style={{ background: 'color-mix(in srgb, var(--primary) 8%, transparent)' }}>
                <span className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider">Score</span>
                <span className="text-xl font-black text-[var(--text)]">{score}<span className="text-sm text-[var(--text-muted)]">/{test.questions.length}</span></span>
                <span className="text-xs text-[var(--text-muted)]">{Math.round((score / test.questions.length) * 100)}%</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowOptions(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">
              ⚙ Options
            </button>
            {!preview && (
              <a href="https://t.me/LexivoApp" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                style={{ background: '#2AABEE', color: 'white' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg>
                Lexivo
              </a>
            )}
          </div>
        </div>

        {/* Row 2: breadcrumb */}
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mt-1.5">
          IELTS Reading · Passage {passageId}{testId ? ` · Test ${testId}` : ''}
          <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-black" style={{
            background: mode === 'test' ? 'var(--primary)' : 'color-mix(in srgb, var(--primary) 15%, transparent)',
            color: mode === 'test' ? 'white' : 'var(--primary)',
          }}>
            {preview ? '👁 PREVIEW' : mode === 'test' ? '📝 TEST MODE' : '📖 REVIEW MODE'}
          </span>
        </p>
      </div>

      {/* Two-column layout — fills remaining height */}
      <div ref={containerRef} className="flex flex-1 min-h-0" style={{ background: passageStyle.bg }}>

        {/* Passage */}
        <div ref={passageRef} className="overflow-y-auto p-6 transition-colors"
          onMouseUp={handleTextMouseUp}
          style={{ width: `${passageWidthPct}%`, background: passageStyle.bg, color: passageStyle.color }}>
          {/* Passage header */}
          <div className="mb-6">
            <p style={{ fontSize: fontSize - 1, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 6, color: passageStyle.color }}>
              READING PASSAGE {passageId}
            </p>
            {test.questionRange && (
              <p style={{ fontSize: fontSize - 1, fontStyle: 'italic', marginBottom: 12, color: passageStyle.color }}>
                You should spend about 20 minutes on Questions {test.questionRange}, which are based on Reading Passage {passageId}.
              </p>
            )}
            <p style={{ fontSize: fontSize + 2, fontWeight: 700, textAlign: 'center', marginBottom: 6, color: passageStyle.color }}>
              {test.title}
            </p>
            {test.subtitle && (
              <p style={{ fontSize: fontSize - 1, fontStyle: 'italic', textAlign: 'center', marginBottom: 6, color: passageStyle.color }}>
                {test.subtitle}
              </p>
            )}
          </div>
          {/* Paragraphs, labeled per paragraphLabelStyle (defaults to letters for existing content).
              'none'-style paragraphs get a wider gap than labeled ones — with no letter/numeral to
              anchor the eye, the whitespace itself has to signal "new paragraph". flex+gap (not a
              margin-based space-y utility) avoids margin-collapsing capping the gap unexpectedly. */}
          <div className={`flex flex-col leading-[1.85] ${(test.paragraphLabelStyle ?? 'letters') === 'none' ? 'gap-8' : 'gap-4'}`} style={{ fontSize }}>
            {paragraphs.map((para, i) => {
              const labelStyle = test.paragraphLabelStyle ?? 'letters';
              if (labelStyle === 'none') {
                return <p key={i} style={{ margin: 0 }}>{para}</p>;
              }
              const label = labelStyle === 'roman' ? (ROMANS[i]?.toUpperCase() ?? String(i + 1)) : String.fromCharCode(65 + i);
              return (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 700, minWidth: 18, color: passageStyle.color, flexShrink: 0 }}>
                    {label}
                  </span>
                  <p style={{ margin: 0 }}>{para}</p>
                </div>
              );
            })}
          </div>

          {/* Glossary footnote */}
          {test.glossary && test.glossary.length > 0 && (
            <div className="mt-6 pt-4 border-t" style={{ borderColor: `${passageStyle.color}25` }}>
              {test.glossary.map((entry, i) => (
                <p key={i} style={{ fontSize: fontSize - 2, fontStyle: 'italic', color: passageStyle.color, opacity: 0.8, margin: '2px 0' }}>
                  <strong>{entry.term}*</strong>: {entry.definition}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Draggable divider */}
        <div
          onMouseDown={e => { e.preventDefault(); isDragging.current = true; document.body.style.cursor = 'col-resize'; }}
          className="w-2 shrink-0 flex items-center justify-center cursor-col-resize group select-none"
          style={{ background: passageStyle.bg }}
        >
          <div className="w-px h-full group-hover:w-1 transition-all rounded-full" style={{ background: `${passageStyle.color}30` }} />
        </div>

        {/* Questions */}
        <div className="flex flex-col gap-4 p-4 overflow-y-auto"
          onMouseUp={handleTextMouseUp}
          style={{ width: `${100 - passageWidthPct}%`, background: passageStyle.bg }}>
          {(() => {
            const groups = buildGroups(test.questions);
            return groups.map((group, gi) => {
              const firstQ = test.questions[group.start - 1];
              const groupQuestions = test.questions.slice(group.start - 1, group.end);
              const hasSummary = group.type === 'summary_completion' && !!firstQ?.summaryText;
              const hasNote = group.type === 'note_completion' && !!firstQ?.noteLines?.length;
              const hasFlowChart = group.type === 'flow_chart_completion' && !!firstQ?.flowChartSteps?.length;
              // These types answer inline within their block, not via a per-question input.
              const hasInlineBlanks = hasSummary || hasNote || hasFlowChart;

              return (
                <div key={gi} className="flex flex-col gap-3">
                  {/* Instruction block */}
                  <div className="px-2 py-3 border-b" style={{ borderColor: `${passageStyle.color}25` }}>
                    <QuestionInstruction
                      type={group.type}
                      start={group.start}
                      end={group.end}
                      passageId={passageId}
                      color={passageStyle.color}
                      paragraphLabels={firstQ?.paragraphLabels}
                      options={firstQ?.options}
                      featureListTitle={firstQ?.featureListTitle}
                      wordLimit={firstQ?.wordLimit}
                      example={firstQ?.example}
                    />
                  </div>

                  {/* Summary block (summary_completion with summaryText) */}
                  {hasSummary && (
                    <SummaryBlock
                      text={firstQ.summaryText!}
                      title={firstQ.summaryTitle}
                      summaryOptions={firstQ.summaryOptions}
                      groupQuestions={groupQuestions}
                      startIdx={group.start - 1}
                      answers={answers}
                      onChange={setAnswer}
                      mode={mode}
                      submitted={submitted}
                      passageStyle={passageStyle}
                      fontSize={fontSize}
                    />
                  )}

                  {/* Note block (note_completion with noteLines) */}
                  {hasNote && (
                    <NoteBlock
                      lines={firstQ.noteLines!}
                      groupQuestions={groupQuestions}
                      startIdx={group.start - 1}
                      answers={answers}
                      onChange={setAnswer}
                      mode={mode}
                      submitted={submitted}
                      passageStyle={passageStyle}
                      fontSize={fontSize}
                    />
                  )}

                  {/* Flow-chart block (flow_chart_completion with flowChartSteps) */}
                  {hasFlowChart && (
                    <FlowChartBlock
                      steps={firstQ.flowChartSteps!}
                      groupQuestions={groupQuestions}
                      startIdx={group.start - 1}
                      answers={answers}
                      onChange={setAnswer}
                      mode={mode}
                      submitted={submitted}
                      passageStyle={passageStyle}
                      fontSize={fontSize}
                    />
                  )}

                  {/* Individual question cards */}
                  {groupQuestions.map((q, localIdx) => {
                    const i = group.start - 1 + localIdx;
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

                              {/* Input — hidden when the answer is inline in a summary/note/flow-chart block */}
                              {!hasInlineBlanks && mode === 'test' && !submitted && (
                                <QuestionInput q={q} name={`question-${i}`} value={userAnswer} onChange={v => setAnswer(i, v)} disabled={false} />
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
                          <AnswerReveal q={q} userAnswer={mode === 'test' ? userAnswer : undefined} submitted={mode === 'test' && submitted} passageColor={passageStyle.color} />
                        )}
                      </div>
                    );
                  })}

                  {/* Endings box — rendered after questions for matching_sentence_endings */}
                  {group.type === 'matching_sentence_endings' && firstQ?.options && firstQ.options.length > 0 && (
                    <div style={{ border: `1px solid ${passageStyle.color}`, padding: '12px 20px', margin: '4px 0' }}>
                      {firstQ.options.map((opt, idx) => (
                        <div key={idx} style={{ color: passageStyle.color, marginBottom: 6, display: 'flex', gap: 12 }}>
                          <strong style={{ minWidth: 20 }}>{LETTERS[idx]}</strong>
                          <span>{opt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          })()}

          {!preview && mode === 'test' && !submitted && (
            <button onClick={handleSubmit}
              className="w-full py-3.5 rounded-2xl text-sm font-black text-white transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-light))' }}>
              Submit Test →
            </button>
          )}

          {!preview && mode === 'test' && submitted && (
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

      {/* Highlight floating toolbar */}
      {floatingBar && (
        <div
          className="fixed z-40 flex items-center gap-1.5 px-2 py-1.5 rounded-xl shadow-xl border border-[var(--border)]"
          style={{ left: floatingBar.x, top: floatingBar.y - 44, transform: 'translateX(-50%)', background: 'var(--surface)' }}
          onMouseDown={e => e.preventDefault()}
        >
          {HIGHLIGHT_COLORS.map(color => (
            <button key={color} onClick={() => applyHighlight(color)}
              className="w-5 h-5 rounded-full hover:scale-125 transition-transform"
              style={{ background: color, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
            />
          ))}
          <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border)' }} />
          <button onClick={removeHighlight}
            className="w-5 h-5 rounded-full flex items-center justify-center hover:scale-125 transition-transform text-[9px] font-black text-[var(--text-muted)]"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            ✕
          </button>
        </div>
      )}

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
