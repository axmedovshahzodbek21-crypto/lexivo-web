'use client';
import { useState } from 'react';
import BackButton from '@/components/BackButton';
import PassageMetaForm, { PassageMetaDraft, suggestTestNumber } from '@/components/admin/ielts-builder/PassageMetaForm';
import PassageFormatPanel, { GlossaryDraftEntry } from '@/components/admin/ielts-builder/PassageFormatPanel';
import { TestRenderer } from '@/components/ielts/TestRenderer';
import { IeltsPassageTest } from '@/lib/ielts-data';

export default function IeltsBuilderPage() {
  const [meta, setMeta] = useState<PassageMetaDraft>({
    passageSection: 1,
    testNumber: suggestTestNumber(1),
    title: '',
    subtitle: '',
    questionRange: '',
    content: '',
  });
  const [paragraphLabelStyle, setParagraphLabelStyle] = useState<'none' | 'letters' | 'roman'>('letters');
  const [glossary, setGlossary] = useState<GlossaryDraftEntry[]>([]);

  const draftTest: IeltsPassageTest = {
    testNumber: meta.testNumber,
    title: meta.title || 'Untitled passage',
    subtitle: meta.subtitle || undefined,
    questionRange: meta.questionRange || undefined,
    content: meta.content || 'Paste your passage text on the left to see it rendered here.',
    paragraphLabelStyle,
    glossary: glossary.filter(g => g.term && g.definition),
    questions: [],
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8">
      <BackButton href="/ielts-reading" label="Back" className="mb-6" />

      <div className="mb-6">
        <p className="text-[11px] font-black text-[var(--text-muted)] uppercase tracking-[0.15em] mb-1">
          IELTS Content Builder
        </p>
        <h1 className="text-3xl font-black text-[var(--text)]">Passage</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Question types come next — for now this builds the passage itself, previewed with the real test-taking renderer.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="flex flex-col gap-5">
          <PassageMetaForm value={meta} onChange={setMeta} />
          <PassageFormatPanel
            paragraphLabelStyle={paragraphLabelStyle}
            onParagraphLabelStyleChange={setParagraphLabelStyle}
            glossary={glossary}
            onGlossaryChange={setGlossary}
          />
        </div>

        <div className="rounded-2xl border border-[var(--border)] overflow-hidden lg:sticky lg:top-8" style={{ height: 720 }}>
          <TestRenderer passageId={String(meta.passageSection)} test={draftTest} mode="review" preview />
        </div>
      </div>
    </div>
  );
}
