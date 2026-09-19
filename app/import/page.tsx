'use client';
import { PageLoader, SectionLoader } from '@/components/Loader';
import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { addImportedWords, generateImportedWordId } from '@/lib/storage';
import { pushLists } from '@/lib/sync';
import { buildAiImportPrompt, parseAiImportOutput } from '@/lib/ai-import';
import type { ImportedWord } from '@/lib/types';

const TUTORIAL_ICONS = ['🌐', '🤖', '📋'] as const;

const LANGUAGES = [
  { label: 'English', code: 'en-US' },
  { label: 'Russian', code: 'ru-RU' },
  { label: 'Spanish', code: 'es-ES' },
  { label: 'French', code: 'fr-FR' },
  { label: 'German', code: 'de-DE' },
  { label: 'Turkish', code: 'tr-TR' },
  { label: 'Arabic', code: 'ar-SA' },
  { label: 'Korean', code: 'ko-KR' },
  { label: 'Japanese', code: 'ja-JP' },
  { label: 'Chinese', code: 'zh-CN' },
  { label: 'Uzbek', code: 'uz-UZ' },
];

function ImportPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslation();

  const prefilledCollection = searchParams.get('collection') ?? '';
  const prefilledFolder = searchParams.get('folder') ?? '';

  const [folderName, setFolderName] = useState(prefilledFolder);
  const [collectionName, setCollectionName] = useState(prefilledCollection);
  const [wordLang, setWordLang] = useState('English');
  const [transLang, setTransLang] = useState('Uzbek');
  const [wordLangCode, setWordLangCode] = useState('en-US');
  const [wordsInput, setWordsInput] = useState('');
  const [pasted, setPasted] = useState('');
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('import_tutorial_seen')) {
      setShowHelp(true);
      localStorage.setItem('import_tutorial_seen', '1');
    }
  }, []);

  const parseResult = useMemo(() => parseAiImportOutput(pasted), [pasted]);
  const parsed = parseResult.words;

  function copyPrompt(hasTranslations: boolean) {
    const words = wordsInput.trim() || (hasTranslations ? 'apple - olma\nbook - kitob' : 'apple, book, water');
    const text = buildAiImportPrompt({ wordLang, translationLang: transLang, words, hasTranslations });
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleAdd() {
    const folder = folderName.trim();
    const name = collectionName.trim() || 'My Words';
    if (!folder) {
      alert(t.import.folderNameRequired);
      return;
    }
    const rows: ImportedWord[] = parsed.map(w => ({
      id: generateImportedWordId(),
      word: w.word,
      partOfSpeech: w.partOfSpeech,
      pronunciation: w.pronunciation,
      translation: w.translation,
      definition: w.definition,
      definitionUz: w.definitionUz,
      examples: w.examples.map(e => ({ sentence: e.sentence, translation: e.translation || undefined })),
      language: wordLangCode,
      addedAt: Date.now(),
    }));
    addImportedWords(rows, name, folder);
    pushLists();
    setAdded(true);
    setTimeout(() => router.push(`/my-words/${encodeURIComponent(folder)}/${encodeURIComponent(name)}`), 1200);
  }

  return (
    <div className={`flex flex-col min-h-screen animate-fade-in ${parsed.length > 0 ? 'pb-36' : 'pb-24'}`}>
      {/* Tutorial modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-8" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowHelp(false)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-3xl p-6 space-y-5 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <h2 className="flex-1 text-lg font-bold text-[var(--text)]">{t.import.tutorialTitle}</h2>
            </div>
            <div className="space-y-4">
              {[
                { icon: TUTORIAL_ICONS[0], title: t.import.tutorialStep1Title, desc: t.import.tutorialStep1Desc },
                { icon: TUTORIAL_ICONS[1], title: t.import.tutorialStep2Title, desc: t.import.tutorialStep2Desc },
                { icon: TUTORIAL_ICONS[2], title: t.import.tutorialStep3Title, desc: t.import.tutorialStep3Desc },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: 'var(--primary-bg)' }}>{icon}</div>
                  <div>
                    <p className="font-semibold text-sm text-[var(--text)]">{title}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowHelp(false)} className="btn-primary w-full py-3 text-sm rounded-2xl">
              {t.import.tutorialGotIt}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label={t.extra.goBack}>←</button>
        <h1 className="font-bold text-[var(--text)] flex-1">{t.import.title}</h1>
        <button onClick={() => setShowHelp(true)} className="btn-icon text-lg" aria-label={t.import.showHelpAria}>💡</button>
      </div>

      <div className="p-4 space-y-4">

        {/* Folder + Collection name */}
        <div className="card space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">{t.import.folderLabel}</label>
            <input
              type="text"
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              placeholder={t.import.folderPlaceholder}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block">{t.import.collectionLabel}</label>
            <input
              type="text"
              value={collectionName}
              onChange={e => setCollectionName(e.target.value)}
              placeholder={t.import.collectionPlaceholder}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          {folderName.trim() && collectionName.trim() && (
            <p className="text-xs text-[var(--text-muted)]">
              {t.import.willSaveTo} <span className="text-[var(--primary)] font-medium">{folderName.trim()}</span> › <span className="text-[var(--text)] font-medium">{collectionName.trim()}</span>
            </p>
          )}
        </div>

        {/* Language selectors */}
        <div className="card space-y-3">
          <p className="text-xs font-bold text-[var(--text-muted)]">{t.libraryPage.wordLangTrLang}</p>
          <div className="flex items-center gap-3">
            <select
              value={wordLang}
              onChange={e => {
                const lang = LANGUAGES.find(l => l.label === e.target.value);
                setWordLang(e.target.value);
                if (lang) setWordLangCode(lang.code);
              }}
              className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              {LANGUAGES.map(l => <option key={l.code}>{l.label}</option>)}
            </select>
            <span className="text-[var(--text-muted)] font-bold">→</span>
            <select
              value={transLang}
              onChange={e => setTransLang(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              {LANGUAGES.map(l => <option key={l.code}>{l.label}</option>)}
            </select>
          </div>
        </div>

        {/* Step 1: words input + copy prompt */}
        <div className="card space-y-3">
          <p className="text-sm font-bold text-[var(--text)]">{t.libraryPage.enterWordsStep}</p>
          <textarea
            value={wordsInput}
            onChange={e => setWordsInput(e.target.value)}
            placeholder={t.libraryPage.wordsInputPlaceholder}
            rows={4}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none focus:border-[var(--primary)] resize-none"
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

        {/* Paste area */}
        <div className="card space-y-2">
          <p className="font-semibold text-sm text-[var(--text)]">{t.libraryPage.pasteAiOutputStep}</p>
          <textarea
            value={pasted}
            onChange={e => setPasted(e.target.value)}
            placeholder={t.libraryPage.pasteAiResponse}
            rows={8}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none font-mono"
          />
        </div>

        {/* Preview */}
        {pasted.trim() && (
          <div className="card space-y-3">
            {/* Diagnostics header */}
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm text-[var(--text)]">{t.import.preview}</p>
              <div className="flex items-center gap-2 text-xs">
                {parsed.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success)' }}>
                    {t.import.readyCount(parsed.length)}
                  </span>
                )}
                {parseResult.errors.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: '#DC2626' }}>
                    {t.import.failedCount(parseResult.errors.length)}
                  </span>
                )}
              </div>
            </div>

            {/* Errors */}
            {parseResult.errors.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 p-3 space-y-2">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                  {t.import.blocksCouldNotBeParsed(parseResult.errors.length)}
                </p>
                {parseResult.errors.map(e => (
                  <div key={e.index} className="text-xs text-red-600 dark:text-red-400">
                    <span className="font-semibold">{t.import.blockLabel(e.index)}</span> {e.reason}
                    {e.preview && <span className="block text-red-400 font-mono mt-0.5 truncate">"{e.preview}…"</span>}
                  </div>
                ))}
                <p className="text-xs text-red-500 mt-1">{t.import.parseErrorHintPrefix} <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">word:</code> {t.import.parseErrorHintAnd} <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">translation:</code> {t.import.parseErrorHintFields} <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">---</code></p>
              </div>
            )}

            {parsed.length === 0 && parseResult.errors.length === 0 && (
              <p className="text-xs text-[var(--text-muted)]">{t.import.errorEmpty}</p>
            )}

            {parsed.length > 0 && (
              <div className="space-y-3">
                {parsed.map((w, i) => (
                  <div key={i} className="rounded-xl border border-[var(--border)] p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text)]">{w.word}</span>
                      <span className="text-[var(--text-muted)]">·</span>
                      <span className="text-[var(--primary)] font-medium">{w.translation}</span>
                    </div>
                    {w.definition && <p className="text-xs text-[var(--text-muted)]">{w.definition}</p>}
                    {w.examples.map((ex, exIdx) => (
                      <div key={exIdx}>
                        <p className="text-xs italic text-[var(--text)]">&quot;{ex.sentence}&quot;</p>
                        {ex.translation && <p className="text-xs text-[var(--text-muted)] pl-2">↳ {ex.translation}</p>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

      </div>

      {/* Add button — pinned to the bottom of the screen so it's reachable
          without scrolling past the preview list, however long it gets. */}
      {parsed.length > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 z-40 max-w-lg mx-auto">
          <button
            onClick={handleAdd}
            disabled={added}
            className="w-full py-3.5 rounded-2xl bg-[var(--primary)] text-white font-bold text-sm shadow-xl disabled:opacity-60 transition-opacity hover:opacity-90"
          >
            {added ? t.import.added(parsed.length) : t.import.addBtn(parsed.length, collectionName.trim() || 'My Words')}
          </button>
        </div>
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

export default function ImportPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ImportPageInner />
    </Suspense>
  );
}

