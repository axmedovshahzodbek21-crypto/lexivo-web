'use client';
import { SectionLoader } from '@/components/Loader';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

type InputTab = 'manual' | 'ai';

interface ClassWord {
  id: string;
  word: string;
  translation: string;
  definition: string | null;
  example1: string | null;
  example1_translation: string | null;
  example2: string | null;
  example2_translation: string | null;
  folder_name: string | null;
  collection_name: string | null;
  created_at: string;
}

interface ParsedWord {
  word: string;
  translation: string;
  definition: string;
  example1: string;
  example1Translation: string;
  example2: string;
  example2Translation: string;
  language: string;
}

interface ParseResult {
  words: ParsedWord[];
  errors: { index: number; preview: string; reason: string }[];
}

const LANGUAGES = [
  { label: 'English', code: 'en-US' },
  { label: 'Russian', code: 'ru-RU' },
  { label: 'Uzbek', code: 'uz-UZ' },
  { label: 'Spanish', code: 'es-ES' },
  { label: 'French', code: 'fr-FR' },
  { label: 'German', code: 'de-DE' },
  { label: 'Turkish', code: 'tr-TR' },
  { label: 'Arabic', code: 'ar-SA' },
  { label: 'Korean', code: 'ko-KR' },
  { label: 'Japanese', code: 'ja-JP' },
  { label: 'Chinese', code: 'zh-CN' },
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

function splitIntoBlocks(text: string): string[] {
  if (/---+/.test(text)) {
    return text.split(/---+/).map(b => b.trim()).filter(Boolean);
  }
  const blocks: string[] = [];
  const lines = text.split('\n');
  let current: string[] = [];
  for (const line of lines) {
    if (/^word\s*:/i.test(line.trim()) && current.some(l => /^word\s*:/i.test(l.trim()))) {
      blocks.push(current.join('\n').trim());
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join('\n').trim());
  return blocks.filter(Boolean);
}

function parseOutput(text: string, langCode: string): ParseResult {
  const blocks = splitIntoBlocks(text);
  const words: ParsedWord[] = [];
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
    });
  }
  return { words, errors };
}

// Group words by folder → collection hierarchy
function groupWords(words: ClassWord[]) {
  // folder → collection → words
  const map = new Map<string, Map<string, ClassWord[]>>();
  for (const w of words) {
    const folder = w.folder_name ?? '';
    const col = w.collection_name ?? '';
    if (!map.has(folder)) map.set(folder, new Map());
    const colMap = map.get(folder)!;
    if (!colMap.has(col)) colMap.set(col, []);
    colMap.get(col)!.push(w);
  }
  return map;
}

export default function ClassWordsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [className, setClassName] = useState('');
  const [notTeacher, setNotTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<ClassWord[]>([]);
  const [tab, setTab] = useState<InputTab>('manual');
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const toggleCol = (key: string) => setCollapsedCols(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const toggleFolder = (key: string) => setCollapsedFolders(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  const collapseInitialized = useRef(false);

  useEffect(() => {
    if (collapseInitialized.current || words.length === 0) return;
    collapseInitialized.current = true;
    const folders = new Set<string>();
    const cols = new Set<string>();
    for (const w of words) {
      if (w.folder_name) folders.add(w.folder_name);
      cols.add(`${w.folder_name ?? ''}::${w.collection_name ?? ''}`);
    }
    setCollapsedFolders(folders);
    setCollapsedCols(cols);
  }, [words]);

  // Shared folder/collection for both manual and AI import
  const [folderInput, setFolderInput] = useState('');
  const [collectionInput, setCollectionInput] = useState('');

  // Manual form
  const [manualWord, setManualWord] = useState('');
  const [manualTranslation, setManualTranslation] = useState('');
  const [manualDefinition, setManualDefinition] = useState('');
  const [manualExample1, setManualExample1] = useState('');
  const [manualExample1Trans, setManualExample1Trans] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const [adding, setAdding] = useState(false);

  // AI import
  const [wordLang, setWordLang] = useState('English');
  const [transLang, setTransLang] = useState('Uzbek');
  const [wordLangCode, setWordLangCode] = useState('en-US');
  const [pasted, setPasted] = useState('');
  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [openFmt, setOpenFmt] = useState(false);
  const [copied1, setCopied1] = useState(false);
  const [copied2, setCopied2] = useState(false);
  const [importing, setImporting] = useState(false);

  const parseResult = useMemo(() => parseOutput(pasted, wordLangCode), [pasted, wordLangCode]);
  const parsed = parseResult.words;

  const loadWords = async () => {
    const { data } = await supabase
      .from('class_words')
      .select('id, word, translation, definition, example1, example1_translation, example2, example2_translation, folder_name, collection_name, created_at')
      .eq('class_id', id)
      .order('created_at', { ascending: true });
    setWords((data as ClassWord[]) ?? []);
  };

  useEffect(() => {
    if (!user || !id) return;
    const init = async () => {
      const { data: cls } = await supabase.from('classes').select('name, teacher_id').eq('id', id).single();
      if (!cls || cls.teacher_id !== user.id) { setNotTeacher(true); setLoading(false); return; }
      setClassName(cls.name);
      await loadWords();
      setLoading(false);
    };
    init();
  }, [user, id]);

  const addManual = async () => {
    if (!user || !manualWord.trim() || !manualTranslation.trim()) return;
    setAdding(true);
    await supabase.from('class_words').insert({
      class_id: id,
      teacher_id: user.id,
      word: manualWord.trim(),
      translation: manualTranslation.trim(),
      definition: manualDefinition.trim() || null,
      example1: manualExample1.trim() || null,
      example1_translation: manualExample1Trans.trim() || null,
      folder_name: folderInput.trim() || null,
      collection_name: collectionInput.trim() || null,
    });
    setManualWord('');
    setManualTranslation('');
    setManualDefinition('');
    setManualExample1('');
    setManualExample1Trans('');
    await loadWords();
    setAdding(false);
  };

  const importWords = async () => {
    if (!user || parsed.length === 0) return;
    setImporting(true);
    const rows = parsed.map(w => ({
      class_id: id,
      teacher_id: user.id,
      word: w.word,
      translation: w.translation,
      definition: w.definition || null,
      example1: w.example1 || null,
      example1_translation: w.example1Translation || null,
      example2: w.example2 || null,
      example2_translation: w.example2Translation || null,
      language: w.language,
      folder_name: folderInput.trim() || null,
      collection_name: collectionInput.trim() || null,
    }));
    await supabase.from('class_words').insert(rows);
    setPasted('');
    await loadWords();
    setImporting(false);
  };

  const deleteWord = async (wordId: string) => {
    await supabase.from('class_words').delete().eq('id', wordId);
    setWords(prev => prev.filter(w => w.id !== wordId));
  };

  const copyPrompt = (text: string, which: 1 | 2) => {
    navigator.clipboard.writeText(text);
    if (which === 1) { setCopied1(true); setTimeout(() => setCopied1(false), 2000); }
    else { setCopied2(true); setTimeout(() => setCopied2(false), 2000); }
  };

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
      <div className="text-5xl">🔒</div>
      <button onClick={() => router.push('/login')} className="btn-primary">Sign in</button>
    </div>
  );

  if (notTeacher) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
      <div className="text-5xl">⛔</div>
      <p className="font-bold text-[var(--text)]">Not your class</p>
      <button onClick={() => router.back()} className="btn-primary">Go back</button>
    </div>
  );

  const grouped = groupWords(words);
  const existingFolders = [...new Set(words.map(w => w.folder_name).filter((f): f is string => !!f))].sort();

  // Folder/collection shared input card (shown in both tabs)
  const FolderCollectionCard = (
    <div className="card space-y-3">
      <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Assign to</p>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">📁 Folder <span className="font-normal">(optional)</span></label>
          <input
            type="text"
            placeholder="e.g. Unit 1, Chapter 2…"
            value={folderInput}
            onChange={e => setFolderInput(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">📖 Group <span className="font-normal">(optional)</span></label>
          <input
            type="text"
            placeholder="e.g. Week 1, Greetings…"
            value={collectionInput}
            onChange={e => setCollectionInput(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
          />
        </div>
      </div>
      {existingFolders.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {existingFolders.map(f => (
            <button
              key={f}
              onClick={() => setFolderInput(f)}
              className="text-xs font-semibold px-2.5 py-1 rounded-full transition-colors"
              style={folderInput.trim() === f
                ? { background: 'var(--primary)', color: 'white' }
                : { background: 'var(--primary-bg)', color: 'var(--primary)' }}
            >📁 {f}</button>
          ))}
        </div>
      )}
      {(folderInput.trim() || collectionInput.trim()) && (
        <p className="text-xs text-[var(--text-muted)]">
          {folderInput.trim() && <><span className="text-[var(--primary)] font-medium">📁 {folderInput.trim()}</span>{collectionInput.trim() ? ' › ' : ''}</>}
          {collectionInput.trim() && <span className="text-[var(--text)] font-medium">📖 {collectionInput.trim()}</span>}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen pb-24 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label="Go back">←</button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-[var(--text)]">📝 Homework Words</h1>
          <p className="text-xs text-[var(--text-muted)] truncate">{className}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-black text-[var(--primary)]">{words.length}</p>
          <p className="text-[10px] text-[var(--text-muted)]">items</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="text-4xl animate-bounce">📝</div></div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Tab switcher */}
          <div className="flex rounded-2xl overflow-hidden border border-[var(--border)]">
            {(['manual', 'ai'] as InputTab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab === t ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
              >
                {t === 'manual' ? '✏️ Manual' : '🤖 AI Import'}
              </button>
            ))}
          </div>

          {/* Manual tab */}
          {tab === 'manual' && (
            <div className="space-y-3">
              {FolderCollectionCard}
              <div className="card space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">Word *</label>
                    <input
                      type="text"
                      placeholder="e.g. enormous"
                      value={manualWord}
                      onChange={e => setManualWord(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addManual()}
                      className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">Translation *</label>
                    <input
                      type="text"
                      placeholder="e.g. ulkan"
                      value={manualTranslation}
                      onChange={e => setManualTranslation(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addManual()}
                      className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">Definition <span className="font-normal">(optional)</span></label>
                  <input
                    type="text"
                    placeholder="Short definition…"
                    value={manualDefinition}
                    onChange={e => setManualDefinition(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
                <button onClick={() => setShowExamples(p => !p)} className="text-xs text-[var(--primary)] font-medium">
                  {showExamples ? '▲ Hide example' : '▼ Add example sentence (optional)'}
                </button>
                {showExamples && (
                  <div className="space-y-2">
                    <input type="text" placeholder="Example sentence…" value={manualExample1} onChange={e => setManualExample1(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]" />
                    <input type="text" placeholder="Translation of example…" value={manualExample1Trans} onChange={e => setManualExample1Trans(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]" />
                  </div>
                )}
                <button onClick={addManual} disabled={adding || !manualWord.trim() || !manualTranslation.trim()} className="w-full btn-primary py-3 disabled:opacity-50">
                  {adding ? 'Adding…' : '+ Add item'}
                </button>
              </div>
            </div>
          )}

          {/* AI Import tab */}
          {tab === 'ai' && (
            <div className="space-y-3">
              {FolderCollectionCard}

              {/* Language selectors */}
              <div className="card">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Word language</label>
                    <select value={wordLang} onChange={e => { const lang = LANGUAGES.find(l => l.label === e.target.value); setWordLang(e.target.value); if (lang) setWordLangCode(lang.code); }} className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]">
                      {LANGUAGES.map(l => <option key={l.code}>{l.label}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Translation language</label>
                    <select value={transLang} onChange={e => setTransLang(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]">
                      {LANGUAGES.map(l => <option key={l.code}>{l.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Prompt 1 */}
              <div className="card space-y-3">
                <button onClick={() => setOpen1(p => !p)} className="w-full flex items-center justify-between">
                  <div className="text-left">
                    <p className="font-semibold text-sm text-[var(--text)]">I have words only (no translations)</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">AI adds translations, definitions, examples</p>
                  </div>
                  <span className="text-[var(--text-muted)] ml-2">{open1 ? '▲' : '▼'}</span>
                </button>
                {open1 && (
                  <div className="space-y-2">
                    <pre className="text-xs bg-[var(--surface-2)] rounded-xl p-3 whitespace-pre-wrap text-[var(--text)] leading-relaxed overflow-x-auto">{buildPrompt1(wordLang, transLang)}</pre>
                    <button onClick={() => copyPrompt(buildPrompt1(wordLang, transLang), 1)} className="w-full py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold">
                      {copied1 ? '✅ Copied!' : '📋 Copy prompt'}
                    </button>
                  </div>
                )}
              </div>

              {/* Prompt 2 */}
              <div className="card space-y-3">
                <button onClick={() => setOpen2(p => !p)} className="w-full flex items-center justify-between">
                  <div className="text-left">
                    <p className="font-semibold text-sm text-[var(--text)]">I have word-translation pairs</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">AI keeps your translations, adds definitions and examples</p>
                  </div>
                  <span className="text-[var(--text-muted)] ml-2">{open2 ? '▲' : '▼'}</span>
                </button>
                {open2 && (
                  <div className="space-y-2">
                    <pre className="text-xs bg-[var(--surface-2)] rounded-xl p-3 whitespace-pre-wrap text-[var(--text)] leading-relaxed overflow-x-auto">{buildPrompt2(wordLang, transLang)}</pre>
                    <button onClick={() => copyPrompt(buildPrompt2(wordLang, transLang), 2)} className="w-full py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold">
                      {copied2 ? '✅ Copied!' : '📋 Copy prompt'}
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
                <p className="font-semibold text-sm text-[var(--text)]">Paste AI response here</p>
                <textarea value={pasted} onChange={e => setPasted(e.target.value)} placeholder="Paste the AI-formatted output here…" rows={8} className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)] resize-none font-mono" />
              </div>

              {/* Preview & add */}
              {pasted.trim() && (
                <div className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-[var(--text)]">Preview</p>
                    <div className="flex items-center gap-2 text-xs">
                      {parsed.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success)' }}>✓ {parsed.length} ready</span>
                      )}
                      {parseResult.errors.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: '#DC2626' }}>✕ {parseResult.errors.length} failed</span>
                      )}
                    </div>
                  </div>

                  {parseResult.errors.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 p-3 space-y-2">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400">{parseResult.errors.length} block{parseResult.errors.length > 1 ? 's' : ''} could not be parsed:</p>
                      {parseResult.errors.map(e => (
                        <div key={e.index} className="text-xs text-red-600 dark:text-red-400">
                          <span className="font-semibold">Block {e.index}:</span> {e.reason}
                          {e.preview && <span className="block text-red-400 font-mono mt-0.5 truncate">&quot;{e.preview}…&quot;</span>}
                        </div>
                      ))}
                      <p className="text-xs text-red-500 mt-1">Make sure each block has <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">word:</code> and <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">translation:</code> fields, separated by <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">---</code></p>
                    </div>
                  )}

                  {parsed.length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {parsed.map((w, i) => (
                        <div key={i} className="rounded-xl border border-[var(--border)] p-3 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--text)]">{w.word}</span>
                            <span className="text-[var(--text-muted)]">·</span>
                            <span className="text-[var(--primary)] font-medium">{w.translation}</span>
                          </div>
                          {w.definition && <p className="text-xs text-[var(--text-muted)]">{w.definition}</p>}
                          {w.example1 && <p className="text-xs italic text-[var(--text)]">&quot;{w.example1}&quot;</p>}
                          {w.example1Translation && <p className="text-xs text-[var(--text-muted)] pl-2">↳ {w.example1Translation}</p>}
                          {w.example2 && <p className="text-xs italic text-[var(--text)]">&quot;{w.example2}&quot;</p>}
                          {w.example2Translation && <p className="text-xs text-[var(--text-muted)] pl-2">↳ {w.example2Translation}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {parsed.length > 0 && (
                    <button onClick={importWords} disabled={importing} className="w-full btn-primary py-3 disabled:opacity-50">
                      {importing ? 'Adding…' : `Add ${parsed.length} item${parsed.length !== 1 ? 's' : ''} to class`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Word list — grouped by folder → collection */}
          {words.length > 0 && (
            <div className="space-y-4 pt-2">
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
                {words.length} item{words.length !== 1 ? 's' : ''} assigned to this class
              </p>
              {Array.from(grouped.entries()).map(([folder, colMap]) => {
                const folderCollapsed = folder ? collapsedFolders.has(folder) : false;
                return (
                <div key={folder} className="space-y-2">
                  {/* Folder header */}
                  {folder && (
                    <button onClick={() => toggleFolder(folder)} className="flex items-center gap-2 px-1 pt-1 w-full text-left">
                      <span className="text-base">📁</span>
                      <span className="font-bold text-sm text-[var(--text)]">{folder}</span>
                      <span className="text-[10px] text-[var(--text-muted)] ml-auto">{folderCollapsed ? '▶' : '▼'}</span>
                    </button>
                  )}
                  {!folderCollapsed && Array.from(colMap.entries()).map(([col, colWords]) => {
                    const colKey = `${folder}::${col}`;
                    const collapsed = collapsedCols.has(colKey);
                    return (
                    <div key={col} className={folder ? 'ml-4 space-y-1.5' : 'space-y-1.5'}>
                      {/* Collection header */}
                      {col && (
                        <button onClick={() => toggleCol(colKey)} className="flex items-center gap-2 px-1 w-full text-left">
                          <span className="text-sm">📖</span>
                          <span className="font-semibold text-xs text-[var(--text-muted)]">{col}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">· {colWords.length} item{colWords.length !== 1 ? 's' : ''}</span>
                          <span className="text-[10px] text-[var(--text-muted)] ml-auto">{collapsed ? '▶' : '▼'}</span>
                        </button>
                      )}
                      {!collapsed && colWords.map(w => (
                        <div key={w.id} className={`card flex items-start gap-3 ${folder ? 'border-l-2 border-[var(--primary)] border-opacity-30' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-[var(--text)]">{w.word}</span>
                              <span className="text-[var(--text-muted)] text-sm">·</span>
                              <span className="text-[var(--primary)] text-sm font-medium">{w.translation}</span>
                            </div>
                            {w.definition && <p className="text-xs text-[var(--text-muted)] mt-0.5">{w.definition}</p>}
                            {w.example1 && <p className="text-xs italic text-[var(--text-muted)] mt-0.5">&ldquo;{w.example1}&rdquo;</p>}
                          </div>
                          <button onClick={() => deleteWord(w.id)} className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors text-sm shrink-0" aria-label="Delete word">✕</button>
                        </div>
                      ))}
                    </div>
                    );
                  })}
                </div>
                );
              })}
            </div>
          )}

          {words.length === 0 && !loading && (
            <div className="card text-center py-10 space-y-2">
              <div className="text-4xl">📝</div>
              <p className="font-bold text-[var(--text)]">No items yet</p>
              <p className="text-sm text-[var(--text-muted)]">Add items manually or use AI Import above</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
