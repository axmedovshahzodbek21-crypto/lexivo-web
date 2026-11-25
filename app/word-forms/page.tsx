'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { useTranslation } from '@/lib/useTranslation';
import { WORD_FORM_SECTIONS, wordFormsIn } from '@/lib/word-forms-data';
import { getWordFormsMastered } from '@/lib/storage';

const SECTION_ICONS: Record<string, string> = { 'verb-noun': '⚙️', 'adj-noun': '🏷️', 'adj-adv': '🏃' };
const SECTION_EXAMPLE: Record<string, string> = {
  'verb-noun': 'decide → decision',
  'adj-noun': 'important → importance',
  'adj-adv': 'effective → effectively',
};

export default function WordFormsPage() {
  const t = useTranslation();
  const mastered = useMemo(() => new Set(getWordFormsMastered()), []);

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      <div className="p-4">
        <BackButton />
        <h1 className="text-xl font-bold text-[var(--text)]">🔀 {t.wordForms.title}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">{t.wordForms.intro}</p>
      </div>
      <div className="px-4 pb-6 flex flex-col gap-3">
        {WORD_FORM_SECTIONS.map(section => {
          const items = wordFormsIn(section);
          const done = items.filter(w => mastered.has(w.id)).length;
          return (
            <Link key={section} href={`/word-forms/${section}`}
              className="card flex items-center gap-4 p-4 hover:bg-[var(--surface-2)] transition-colors">
              <span className="text-3xl">{SECTION_ICONS[section]}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[var(--text)]">{t.wordForms.sections[section]}</div>
                <div className="text-xs text-[var(--text-muted)]">{SECTION_EXAMPLE[section]}</div>
                <div className="progress-bar mt-2">
                  <div className="progress-bar-fill" style={{ width: `${(done / items.length) * 100}%` }} />
                </div>
                <div className="text-[10px] text-[var(--text-muted)] mt-1">{t.wordForms.mastered(done, items.length)}</div>
              </div>
              <span className="text-[var(--text-muted)]">›</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
