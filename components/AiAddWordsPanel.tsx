'use client';
import { useMemo, useState } from 'react';
import { useTranslation } from '@/lib/useTranslation';
import { buildAiImportPrompt, parseAiImportOutput, type AiParsedWord } from '@/lib/ai-import';

// The "Add words" tab shared by Library units (app/library/[folderId]/[unitId])
// and My Words units (app/my-words/[collection]/[sub]), so adding words looks
// and works the same in both — only where the words are saved differs, and
// that lives in the caller's onAdd.

const LANGUAGES = [
  { label: 'English', code: 'en-US' },
  { label: 'Uzbek', code: 'uz-UZ' },
  { label: 'Russian', code: 'ru-RU' },
  { label: 'Turkish', code: 'tr-TR' },
  { label: 'German', code: 'de-DE' },
  { label: 'French', code: 'fr-FR' },
  { label: 'Spanish', code: 'es-ES' },
  { label: 'Korean', code: 'ko-KR' },
  { label: 'Japanese', code: 'ja-JP' },
  { label: 'Chinese', code: 'zh-CN' },
  { label: 'Arabic', code: 'ar-SA' },
];

export type UnitTab = 'words' | 'add';

/** The "Words | Add words" switcher both unit pages show above their content. */
export function UnitTabBar({ tab, onChange }: { tab: UnitTab; onChange: (tab: UnitTab) => void }) {
  const t = useTranslation();
  return (
    <div className="flex gap-1 p-1 bg-[var(--surface-2)] rounded-xl mb-6">
      {(['words', 'add'] as const).map(tabOption => (
        <button
          key={tabOption}
          onClick={() => onChange(tabOption)}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === tabOption ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm' : 'text-[var(--text-muted)]'}`}
        >
          {tabOption === 'words' ? t.libraryPage.wordsTab : t.libraryPage.addWordsTab}
        </button>
      ))}
    </div>
  );
}

export default function AiAddWordsPanel({ onAdd, onAdded }: {
  /** Saves the words (duplicates skipped by the caller). Throw to show the failure alert. */
  onAdd: (words: AiParsedWord[], langCode: string) => Promise<unknown>;
  /** Called after a successful add — callers switch back to the Words tab. */
  onAdded: () => void;
}) {
  const t = useTranslation();
  const [wordLang, setWordLang] = useState('English');
  const [transLang, setTransLang] = useState('Uzbek');
  const [wordsInput, setWordsInput] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => (pasteText.trim() ? parseAiImportOutput(pasteText).words : []), [pasteText]);

  function copyPrompt(hasTranslations: boolean) {
    const words = wordsInput.trim() || (hasTranslations ? 'apple - olma\nbook - kitob' : 'apple, book, water');
    const prompt = buildAiImportPrompt({ wordLang, translationLang: transLang, words, hasTranslations });
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function importAll() {
    if (!parsed.length) return;
    setImporting(true);
    const langCode = LANGUAGES.find(l => l.label === wordLang)?.code ?? 'en-US';
    try {
      await onAdd(parsed, langCode);
    } catch (e) {
      alert(t.libraryPage.failedToAddWords(e instanceof Error ? e.message : String(e)));
      setImporting(false);
      return;
    }
    setPasteText(''); setWordsInput('');
    setImporting(false);
    onAdded();
  }

  return (
    <div className="space-y-4">
      {/* Language selectors */}
      <div className="p-4 bg-[var(--surface)] rounded-2xl">
        <p className="text-xs font-bold text-[var(--text-muted)] mb-3">{t.libraryPage.wordLangTrLang}</p>
        <div className="flex items-center gap-3">
          <select value={wordLang} onChange={e => setWordLang(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none">
            {LANGUAGES.map(l => <option key={l.code}>{l.label}</option>)}
          </select>
          <span className="text-[var(--text-muted)] font-bold">→</span>
          <select value={transLang} onChange={e => setTransLang(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none">
            {LANGUAGES.map(l => <option key={l.code}>{l.label}</option>)}
          </select>
        </div>
      </div>

      {/* Step 1 */}
      <div className="p-4 bg-[var(--surface)] rounded-2xl">
        <p className="text-sm font-bold text-[var(--text)] mb-3">{t.libraryPage.enterWordsStep}</p>
        <textarea
          value={wordsInput}
          onChange={e => setWordsInput(e.target.value)}
          placeholder={t.libraryPage.wordsInputPlaceholder}
          rows={4}
          className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none focus:border-[var(--primary)] resize-none mb-3"
        />
        <div className="space-y-2">
          <button
            onClick={() => copyPrompt(false)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-bg)] transition-colors"
          >{t.libraryPage.copyPromptWordsOnly}</button>
          <button
            onClick={() => copyPrompt(true)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
          >{t.libraryPage.copyPromptWithTranslations}</button>
        </div>
      </div>

      {/* Step 2 */}
      <div className="p-4 bg-[var(--surface)] rounded-2xl">
        <p className="text-sm font-bold text-[var(--text)] mb-3">{t.libraryPage.pasteAiOutputStep}</p>
        <textarea
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          placeholder={t.libraryPage.pasteAiResponse}
          rows={6}
          className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-xs font-mono border border-[var(--border)] outline-none focus:border-[var(--primary)] resize-none"
        />
        {parsed.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-bold text-green-500">{t.libraryPage.wordsRecognized(parsed.length)}</p>
            {parsed.map((w, i) => (
              <div key={i} className="p-3 bg-[var(--surface-2)] rounded-xl">
                <div className="flex items-start justify-between">
                  <span className="font-bold text-[var(--text)] text-sm">{w.word}</span>
                  <span className="text-[10px] font-bold text-[var(--primary)] ml-2 shrink-0">{t.libraryPage.exCount(w.examples.length)}</span>
                </div>
                <span className="text-[var(--primary)] text-xs font-semibold">{w.translation}</span>
                {w.definition && <p className="text-[var(--text-muted)] text-xs mt-0.5 truncate">{w.definition}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {parsed.length > 0 && (
        <button
          onClick={importAll}
          disabled={importing}
          className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
          style={{ background: 'var(--primary)' }}
        >
          {importing ? t.libraryPage.importing : t.libraryPage.importAllBtn(parsed.length)}
        </button>
      )}

      {/* Copy toast */}
      {copied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-xl pointer-events-none" style={{ background: 'var(--primary)' }}>
          {t.libraryPage.promptCopiedToast}
        </div>
      )}
    </div>
  );
}
