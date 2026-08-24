'use client';

export interface GlossaryDraftEntry {
  term: string;
  definition: string;
}

type ParagraphLabelStyle = 'none' | 'letters' | 'roman';

const LABEL_STYLES: { id: ParagraphLabelStyle; label: string; example: string[] }[] = [
  { id: 'none', label: 'None', example: ['', '', ''] },
  { id: 'letters', label: 'Letters', example: ['A', 'B', 'C'] },
  { id: 'roman', label: 'Roman numerals', example: ['I', 'II', 'III'] },
];

function LabelStylePreview({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {tags.map((tag, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-4 text-[9px] font-bold text-[var(--text-muted)]">{tag}</span>
          <div className="h-1.5 flex-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>
      ))}
    </div>
  );
}

interface PassageFormatPanelProps {
  paragraphLabelStyle: ParagraphLabelStyle;
  onParagraphLabelStyleChange: (v: ParagraphLabelStyle) => void;
  glossary: GlossaryDraftEntry[];
  onGlossaryChange: (v: GlossaryDraftEntry[]) => void;
}

export default function PassageFormatPanel({
  paragraphLabelStyle,
  onParagraphLabelStyleChange,
  glossary,
  onGlossaryChange,
}: PassageFormatPanelProps) {
  const addEntry = () => onGlossaryChange([...glossary, { term: '', definition: '' }]);
  const updateEntry = (i: number, patch: Partial<GlossaryDraftEntry>) =>
    onGlossaryChange(glossary.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const removeEntry = (i: number) => onGlossaryChange(glossary.filter((_, idx) => idx !== i));

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-6">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] mb-3">Paragraph labels</p>
        <div className="grid grid-cols-3 gap-3">
          {LABEL_STYLES.map(style => {
            const active = paragraphLabelStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => onParagraphLabelStyleChange(style.id)}
                className="rounded-xl border p-3 text-left transition-all"
                style={{
                  borderColor: active ? 'var(--primary)' : 'var(--border)',
                  background: active ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'var(--surface-2)',
                }}
              >
                <LabelStylePreview tags={style.example} />
                <p className="text-xs font-bold mt-2.5" style={{ color: active ? 'var(--primary)' : 'var(--text)' }}>
                  {style.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Glossary terms</p>
          <button type="button" onClick={addEntry} className="text-xs font-bold text-[var(--primary)] hover:opacity-70">
            + Add term
          </button>
        </div>
        {glossary.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            No glossary terms. Mark a word with * directly in the passage text (e.g. "pulp*"), then add its definition here.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {glossary.map((entry, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                value={entry.term}
                onChange={e => updateEntry(i, { term: e.target.value })}
                placeholder="term"
                className="w-28 px-2 py-1.5 rounded-lg text-xs border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
              />
              <input
                value={entry.definition}
                onChange={e => updateEntry(i, { definition: e.target.value })}
                placeholder="definition"
                className="flex-1 px-2 py-1.5 rounded-lg text-xs border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
              />
              <button
                type="button"
                onClick={() => removeEntry(i)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] px-1 py-1.5"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
