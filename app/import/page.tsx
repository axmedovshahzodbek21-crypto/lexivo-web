'use client';
import { PageLoader, SectionLoader } from '@/components/Loader';
import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { addImportedWords } from '@/lib/storage';
import type { ImportedWord } from '@/lib/types';

const TUTORIAL = {
  en: {
    title: 'How to Import Words',
    steps: [
      { icon: '🌐', title: '1. Choose languages', desc: 'Select the language of your words and the language you want translations in.' },
      { icon: '🤖', title: '2. Copy a prompt', desc: 'Expand a prompt below, copy it, open Claude or ChatGPT, paste it with your words and send.' },
      { icon: '📋', title: '3. Paste the response', desc: "Copy the AI's reply and paste it into the box below. Your words will appear instantly." },
    ],
    btn: 'Got it!',
  },
  uz: {
    title: "So'zlarni qanday import qilish",
    steps: [
      { icon: '🌐', title: '1. Tillarni tanlang', desc: "So'zlaringiz tilini va tarjima tilini tanlang." },
      { icon: '🤖', title: "2. Promptni nusxalang", desc: "Quyidagi promptni oching, nusxalang, Claude yoki ChatGPT ga o'ting, promptni so'zlaringiz bilan joylashtiring va yuboring." },
      { icon: '📋', title: '3. Javobni joylashtiring', desc: "Suniy intellekt javobini nusxalab, quyidagi maydonga joylashtiring. So'zlaringiz darhol ko'rinadi." },
    ],
    btn: 'Tushunarli!',
  },
  ru: {
    title: 'Как импортировать слова',
    steps: [
      { icon: '🌐', title: '1. Выберите языки', desc: 'Выберите язык слов и язык, на который нужен перевод.' },
      { icon: '🤖', title: '2. Скопируйте запрос', desc: 'Разверните запрос ниже, скопируйте его, откройте Claude или ChatGPT, вставьте слова и отправьте.' },
      { icon: '📋', title: '3. Вставьте ответ', desc: 'Скопируйте ответ ИИ и вставьте в поле ниже. Слова появятся мгновенно.' },
    ],
    btn: 'Понятно!',
  },
} as const;

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

function buildPrompt1(wordLang: string, transLang: string): string {
  return `I have a list of ${wordLang} words I want to learn. For each word, provide the translation in ${transLang}, a short definition in ${wordLang}, and 2 example sentences in ${wordLang} with their ${transLang} translations.

Format EXACTLY like this for every word. Use plain text only — no markdown, no bold, no asterisks, no extra formatting:

word: enormous
translation: ulkan
definition: extremely large in size or extent
example1: The enormous building towered above the city.
example1Translation: Ulkan bino shahar ustida baland turardi.
example2: She faced an enormous challenge at work.
example2Translation: U ishda ulkan muammoga duch keldi.
---

Important: the example above uses English/Uzbek only to show the format. In your actual response, write the definition and examples in ${wordLang}, and the translations in ${transLang}.

Here are my words:
[PASTE YOUR WORDS HERE, one per line]`;
}

function buildPrompt2(wordLang: string, transLang: string): string {
  return `I have ${wordLang}-${transLang} word pairs. For each pair, keep my translation exactly as written. Add a short definition in ${wordLang} and 2 example sentences in ${wordLang} with their ${transLang} translations.

Format EXACTLY like this for every word. Use plain text only — no markdown, no bold, no asterisks, no extra formatting:

word: enormous
translation: ulkan
definition: extremely large in size or extent
example1: The enormous building towered above the city.
example1Translation: Ulkan bino shahar ustida baland turardi.
example2: She faced an enormous challenge at work.
example2Translation: U ishda ulkan muammoga duch keldi.
---

Important: the example above uses English/Uzbek only to show the format. In your actual response, write the definition and examples in ${wordLang}, and the translations in ${transLang}.

Here are my pairs (word - translation):
[PASTE YOUR PAIRS HERE, one per line]`;
}

interface ParseResult {
  words: ImportedWord[];
  totalBlocks: number;
  errors: { index: number; preview: string; reason: string }[];
}

function parseOutput(text: string, langCode: string): ParseResult {
  const blocks = text.split(/---+/).map(b => b.trim()).filter(Boolean);
  const words: ImportedWord[] = [];
  const errors: ParseResult['errors'] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const fields: Record<string, string> = {};
    for (const line of lines) {
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const key = line.slice(0, colon).trim().toLowerCase().replace(/[*_`#]/g, '');
      const val = line.slice(colon + 1).trim().replace(/[*_`]/g, '');
      fields[key] = val;
    }
    const preview = block.slice(0, 40).replace(/\n/g, ' ');
    if (!fields.word && !fields.translation) {
      errors.push({ index: i + 1, preview, reason: 'Missing both "word:" and "translation:" fields' });
      continue;
    }
    if (!fields.word) {
      errors.push({ index: i + 1, preview, reason: 'Missing "word:" field' });
      continue;
    }
    if (!fields.translation) {
      errors.push({ index: i + 1, preview, reason: 'Missing "translation:" field' });
      continue;
    }
    words.push({
      word: fields.word,
      translation: fields.translation,
      definition: fields.definition ?? '',
      example1: fields.example1 ?? '',
      example1Translation: fields.example1translation ?? '',
      example2: fields.example2 ?? '',
      example2Translation: fields.example2translation ?? '',
      language: langCode,
      addedAt: Date.now(),
    });
  }

  return { words, totalBlocks: blocks.length, errors };
}

function ImportPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslation();

  const prefilledCollection = searchParams.get('collection') ?? '';

  const [collectionName, setCollectionName] = useState(prefilledCollection);
  const [wordLang, setWordLang] = useState('English');
  const [transLang, setTransLang] = useState('Uzbek');
  const [wordLangCode, setWordLangCode] = useState('en-US');
  const [pasted, setPasted] = useState('');
  const [copied1, setCopied1] = useState(false);
  const [copied2, setCopied2] = useState(false);
  const [added, setAdded] = useState(false);
  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [openFmt, setOpenFmt] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [tutorialLang, setTutorialLang] = useState<'en' | 'uz' | 'ru'>('en');

  useEffect(() => {
    if (!localStorage.getItem('import_tutorial_seen')) {
      setShowHelp(true);
      localStorage.setItem('import_tutorial_seen', '1');
    }
  }, []);

  const parseResult = useMemo(() => parseOutput(pasted, wordLangCode), [pasted, wordLangCode]);
  const parsed = parseResult.words;

  function copy(text: string, which: 1 | 2) {
    navigator.clipboard.writeText(text);
    if (which === 1) { setCopied1(true); setTimeout(() => setCopied1(false), 2000); }
    else { setCopied2(true); setTimeout(() => setCopied2(false), 2000); }
  }

  function handleAdd() {
    const name = collectionName.trim() || 'My Words';
    addImportedWords(parsed, name);
    setAdded(true);
    setTimeout(() => router.push(`/my-words/${encodeURIComponent(name)}`), 1200);
  }

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      {/* Tutorial modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-8" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowHelp(false)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-3xl p-6 space-y-5 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <h2 className="flex-1 text-lg font-bold text-[var(--text)]">{TUTORIAL[tutorialLang].title}</h2>
              {(['en', 'uz', 'ru'] as const).map(l => (
                <button key={l} onClick={() => setTutorialLang(l)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${tutorialLang === l ? 'bg-[var(--primary)] text-white' : 'bg-[var(--primary-bg)] text-[var(--primary)]'}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="space-y-4">
              {TUTORIAL[tutorialLang].steps.map(({ icon, title, desc }) => (
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
              {TUTORIAL[tutorialLang].btn}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg">←</button>
        <h1 className="font-bold text-[var(--text)] flex-1">{t.import.title}</h1>
        <button onClick={() => setShowHelp(true)} className="btn-icon text-lg">💡</button>
      </div>

      <div className="p-4 space-y-4">

        {/* Collection name */}
        <div className="card space-y-2">
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block">Collection name</label>
          <input
            type="text"
            value={collectionName}
            onChange={e => setCollectionName(e.target.value)}
            placeholder="e.g. Russian B1, Korean Verbs…"
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        {/* Language selectors */}
        <div className="card space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">{t.import.langWord}</label>
              <select
                value={wordLang}
                onChange={e => {
                  const lang = LANGUAGES.find(l => l.label === e.target.value);
                  setWordLang(e.target.value);
                  if (lang) setWordLangCode(lang.code);
                }}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              >
                {LANGUAGES.map(l => <option key={l.code}>{l.label}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">{t.import.langTranslation}</label>
              <select
                value={transLang}
                onChange={e => setTransLang(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              >
                {LANGUAGES.map(l => <option key={l.code}>{l.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Prompt 1 */}
        <div className="card space-y-3">
          <button onClick={() => setOpen1(p => !p)} className="w-full flex items-center justify-between">
            <div className="text-left">
              <p className="font-semibold text-sm text-[var(--text)]">{t.import.prompt1Title}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{t.import.prompt1Desc}</p>
            </div>
            <span className="text-[var(--text-muted)] ml-2">{open1 ? '▲' : '▼'}</span>
          </button>
          {open1 && (
            <div className="space-y-2">
              <pre className="text-xs bg-[var(--surface-2)] rounded-xl p-3 whitespace-pre-wrap text-[var(--text)] leading-relaxed overflow-x-auto">
                {buildPrompt1(wordLang, transLang)}
              </pre>
              <button onClick={() => copy(buildPrompt1(wordLang, transLang), 1)} className="w-full py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90">
                {copied1 ? t.import.copied : t.import.copyPrompt}
              </button>
            </div>
          )}
        </div>

        {/* Prompt 2 */}
        <div className="card space-y-3">
          <button onClick={() => setOpen2(p => !p)} className="w-full flex items-center justify-between">
            <div className="text-left">
              <p className="font-semibold text-sm text-[var(--text)]">{t.import.prompt2Title}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{t.import.prompt2Desc}</p>
            </div>
            <span className="text-[var(--text-muted)] ml-2">{open2 ? '▲' : '▼'}</span>
          </button>
          {open2 && (
            <div className="space-y-2">
              <pre className="text-xs bg-[var(--surface-2)] rounded-xl p-3 whitespace-pre-wrap text-[var(--text)] leading-relaxed overflow-x-auto">
                {buildPrompt2(wordLang, transLang)}
              </pre>
              <button onClick={() => copy(buildPrompt2(wordLang, transLang), 2)} className="w-full py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90">
                {copied2 ? t.import.copied : t.import.copyPrompt}
              </button>
            </div>
          )}
        </div>

        {/* Format reference */}
        <div className="card space-y-3">
          <button onClick={() => setOpenFmt(p => !p)} className="w-full flex items-center justify-between">
            <div className="text-left">
              <p className="font-semibold text-sm text-[var(--text)]">Format reference</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Exact structure expected — open if pasting manually or fixing errors</p>
            </div>
            <span className="text-[var(--text-muted)] ml-2">{openFmt ? '▲' : '▼'}</span>
          </button>
          {openFmt && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-muted)]">Each word is one block. Blocks are separated by <code className="bg-[var(--surface-2)] px-1 py-0.5 rounded font-mono">---</code> on its own line.</p>
              <div className="rounded-xl bg-[var(--surface-2)] p-3 space-y-1 font-mono text-xs leading-relaxed">
                <div><span className="text-[var(--primary)] font-bold">word:</span><span className="text-[var(--text)]"> enormous</span><span className="ml-2 text-green-500 font-sans font-semibold text-[10px]">required</span></div>
                <div><span className="text-[var(--primary)] font-bold">translation:</span><span className="text-[var(--text)]"> ulkan</span><span className="ml-2 text-green-500 font-sans font-semibold text-[10px]">required</span></div>
                <div><span className="text-[var(--text-muted)]">definition:</span><span className="text-[var(--text)]"> extremely large in size</span><span className="ml-2 text-[var(--text-muted)] font-sans text-[10px]">optional</span></div>
                <div><span className="text-[var(--text-muted)]">example1:</span><span className="text-[var(--text)]"> The enormous building towered above the city.</span><span className="ml-2 text-[var(--text-muted)] font-sans text-[10px]">optional</span></div>
                <div><span className="text-[var(--text-muted)]">example1Translation:</span><span className="text-[var(--text)]"> Ulkan bino shahar ustida baland turardi.</span><span className="ml-2 text-[var(--text-muted)] font-sans text-[10px]">optional</span></div>
                <div><span className="text-[var(--text-muted)]">example2:</span><span className="text-[var(--text)]"> She faced an enormous challenge at work.</span><span className="ml-2 text-[var(--text-muted)] font-sans text-[10px]">optional</span></div>
                <div><span className="text-[var(--text-muted)]">example2Translation:</span><span className="text-[var(--text)]"> U ishda ulkan muammoga duch keldi.</span><span className="ml-2 text-[var(--text-muted)] font-sans text-[10px]">optional</span></div>
                <div className="pt-1 text-[var(--text-muted)]">---</div>
                <div className="pt-1 text-[var(--text-muted)] italic">next word block goes here...</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 p-3 space-y-1">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Common mistakes</p>
                <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-0.5 list-disc list-inside">
                  <li>Missing <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">---</code> separator between words</li>
                  <li>Using <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">**bold**</code> or markdown formatting in values</li>
                  <li><code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">word</code> or <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded">translation</code> field missing entirely</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Paste area */}
        <div className="card space-y-2">
          <p className="font-semibold text-sm text-[var(--text)]">{t.import.pasteTitle}</p>
          <textarea
            value={pasted}
            onChange={e => setPasted(e.target.value)}
            placeholder={t.import.pastePlaceholder}
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
                    ✓ {parsed.length} ready
                  </span>
                )}
                {parseResult.errors.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: '#DC2626' }}>
                    ✕ {parseResult.errors.length} failed
                  </span>
                )}
              </div>
            </div>

            {/* Errors */}
            {parseResult.errors.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 p-3 space-y-2">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                  {parseResult.errors.length} block{parseResult.errors.length > 1 ? 's' : ''} could not be parsed:
                </p>
                {parseResult.errors.map(e => (
                  <div key={e.index} className="text-xs text-red-600 dark:text-red-400">
                    <span className="font-semibold">Block {e.index}:</span> {e.reason}
                    {e.preview && <span className="block text-red-400 font-mono mt-0.5 truncate">"{e.preview}…"</span>}
                  </div>
                ))}
                <p className="text-xs text-red-500 mt-1">Make sure each block has <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">word:</code> and <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">translation:</code> fields, separated by <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">---</code></p>
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
                    {w.example1 && <p className="text-xs italic text-[var(--text)]">"{w.example1}"</p>}
                    {w.example1Translation && <p className="text-xs text-[var(--text-muted)] pl-2">↳ {w.example1Translation}</p>}
                    {w.example2 && <p className="text-xs italic text-[var(--text)]">"{w.example2}"</p>}
                    {w.example2Translation && <p className="text-xs text-[var(--text-muted)] pl-2">↳ {w.example2Translation}</p>}
                  </div>
                ))}
              </div>
            )}

            {parsed.length > 0 && (
              <button
                onClick={handleAdd}
                disabled={added}
                className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-sm disabled:opacity-60 transition-opacity hover:opacity-90"
              >
                {added ? t.import.added(parsed.length) : t.import.addBtn(parsed.length, collectionName.trim() || 'My Words')}
              </button>
            )}
          </div>
        )}

      </div>
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

