'use client';
import { ieltsData } from '@/lib/ielts-data';

export interface PassageMetaDraft {
  passageSection: 1 | 2 | 3;
  testNumber: number;
  title: string;
  subtitle: string;
  questionRange: string;
  content: string;
}

interface PassageMetaFormProps {
  value: PassageMetaDraft;
  onChange: (v: PassageMetaDraft) => void;
}

export function suggestTestNumber(section: 1 | 2 | 3): number {
  const used = new Set(ieltsData.find(s => s.passageSection === section)?.tests.map(t => t.testNumber) ?? []);
  for (let n = 1; n <= 30; n++) if (!used.has(n)) return n;
  return 1;
}

// Strips a leading "A. ", "I. ", or "1. " style label so pasted text with embedded
// labels doesn't get double-labeled once paragraphLabelStyle renders its own.
const LABEL_PREFIX_RE = /^\s*(?:[A-Z]|[IVXLCDM]{1,4}|\d{1,2})[.)]\s+/;

export function normalizeContent(raw: string): string {
  return raw
    .split(/\n\n+/)
    .map(p => p.trim().replace(LABEL_PREFIX_RE, ''))
    .filter(Boolean)
    .join('\n\n');
}

export default function PassageMetaForm({ value, onChange }: PassageMetaFormProps) {
  const set = <K extends keyof PassageMetaDraft>(key: K, v: PassageMetaDraft[K]) => onChange({ ...value, [key]: v });

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] block mb-1.5">
            Passage section
          </label>
          <div className="flex gap-2">
            {([1, 2, 3] as const).map(n => {
              const active = value.passageSection === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange({ ...value, passageSection: n, testNumber: suggestTestNumber(n) })}
                  className="flex-1 py-2 rounded-xl text-sm font-bold border transition-all"
                  style={{
                    borderColor: active ? 'var(--primary)' : 'var(--border)',
                    background: active ? 'var(--primary)' : 'var(--surface-2)',
                    color: active ? 'white' : 'var(--text-muted)',
                  }}
                >
                  Passage {n}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] block mb-1.5">
            Test number slot
          </label>
          <input
            type="number"
            min={1}
            max={30}
            value={value.testNumber}
            onChange={e => set('testNumber', Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl text-sm border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] block mb-1.5">Title</label>
        <input
          value={value.title}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. Carnivorous Plants"
          className="w-full px-3 py-2 rounded-xl text-sm border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
        />
      </div>

      <div>
        <label className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] block mb-1.5">
          Intro sentence (optional italic byline)
        </label>
        <input
          value={value.subtitle}
          onChange={e => set('subtitle', e.target.value)}
          placeholder="Leave blank if this passage has no intro sentence"
          className="w-full px-3 py-2 rounded-xl text-sm border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
        />
      </div>

      <div>
        <label className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] block mb-1.5">
          Question range
        </label>
        <input
          value={value.questionRange}
          onChange={e => set('questionRange', e.target.value)}
          placeholder="e.g. 1–13"
          className="w-full px-3 py-2 rounded-xl text-sm border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Passage text</label>
          <button
            type="button"
            onClick={() => set('content', normalizeContent(value.content))}
            className="text-xs font-bold text-[var(--primary)] hover:opacity-70"
          >
            Clean up labels
          </button>
        </div>
        <textarea
          value={value.content}
          onChange={e => set('content', e.target.value)}
          onBlur={e => set('content', normalizeContent(e.target.value))}
          rows={14}
          placeholder={'Paste clean paragraph text, with a blank line between paragraphs.\nDo not include "A.", "I.", or "1." prefixes — those are added automatically based on the paragraph label style chosen below.'}
          className="w-full px-3 py-2 rounded-xl text-sm border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] font-mono leading-relaxed"
        />
      </div>
    </div>
  );
}
