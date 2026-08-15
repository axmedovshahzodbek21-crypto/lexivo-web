'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface WordExample { sentence: string; translation: string; }
interface UnitWord {
  id: string;
  word: string;
  translation: string;
  definition: string | null;
  partOfSpeech: string | null;
  pronunciation: string | null;
  definitionUz: string | null;
  examples: WordExample[];
}
interface ParsedWord {
  word: string;
  translation: string;
  definition: string;
  partOfSpeech: string;
  pronunciation: string;
  definitionUz: string;
  examples: WordExample[];
}

const LANGUAGES = ['English','Uzbek','Russian','Turkish','German','French','Spanish','Korean','Japanese','Chinese','Arabic'];

function parseOutput(text: string): ParsedWord[] {
  const results: ParsedWord[] = [];
  const blocks = text.split(/\n---\n|\n---$|^---\n/m).map(b => b.trim()).filter(Boolean);
  for (const block of blocks) {
    const w: ParsedWord = { word: '', translation: '', definition: '', partOfSpeech: '', pronunciation: '', definitionUz: '', examples: [] };
    const sentences: Record<number, string> = {};
    const translations: Record<number, string> = {};
    for (const line of block.split('\n')) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const key = line.slice(0, colon).trim().toLowerCase().replace(/\s+/g, ' ');
      const val = line.slice(colon + 1).trim();
      if (key === 'word') w.word = val;
      else if (key === 'translation') w.translation = val;
      else if (key === 'definition') w.definition = val;
      else if (key === 'part of speech') w.partOfSpeech = val;
      else if (key === 'pronunciation') w.pronunciation = val;
      else if (key === 'uzbek definition') w.definitionUz = val;
      else {
        const sm = key.match(/^example (\d+)$/);
        const tm = key.match(/^example (\d+) translation$/);
        if (sm) sentences[+sm[1]] = val;
        if (tm) translations[+tm[1]] = val;
      }
    }
    const nums = [...new Set([...Object.keys(sentences), ...Object.keys(translations)].map(Number))].sort((a,b)=>a-b);
    w.examples = nums.filter(n => sentences[n]).map(n => ({ sentence: sentences[n], translation: translations[n] ?? '' }));
    if (w.word && w.translation) results.push(w);
  }
  return results;
}

function exampleBlock(wordLang: string, transLang: string): string {
  return Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    const desc = n === 1 ? 'natural sentence using the word' : 'another natural sentence';
    return `Example ${n}: [${desc} in ${wordLang.toLowerCase()}]\nExample ${n} Translation: [${transLang.toLowerCase()} translation of example ${n}]`;
  }).join('\n');
}

// hasTranslations: true when the pasted input is already word-translation pairs
// (their translation is kept verbatim) rather than a bare word list to translate.
function buildPrompt(wordLang: string, transLang: string, words: string, hasTranslations: boolean): string {
  const intro = hasTranslations
    ? `I have ${wordLang.toLowerCase()}-${transLang.toLowerCase()} word pairs. For each pair, keep my translation exactly as written. Add a short definition in ${wordLang.toLowerCase()}, a short definition in Uzbek, and 10 example sentences in ${wordLang.toLowerCase()} with their ${transLang.toLowerCase()} translations.`
    : `You are a vocabulary flashcard generator. Create detailed flashcard data for these ${wordLang.toLowerCase()} words, with translations in ${transLang.toLowerCase()}.`;
  const label = hasTranslations ? 'Word pairs to process (word - translation)' : 'Words to process';
  const wordLine = hasTranslations
    ? `Word: [the ${wordLang.toLowerCase()} word — keep exactly as given]`
    : `Word: [the ${wordLang.toLowerCase()} word]`;
  const transLine = hasTranslations
    ? `Translation: [keep exactly as given in my pairs]`
    : `Translation: [${transLang.toLowerCase()} translation]`;

  return `${intro}

${label}:
${words}

For each word output exactly this format, separated by ---:

${wordLine}
Part of speech: [noun / verb / adjective / adverb / phrase / etc.]
Pronunciation: [IPA pronunciation, e.g. /wɜːrd/]
${transLine}
Definition: [short definition in ${wordLang.toLowerCase()}, max 20 words]
Uzbek definition: [short definition in Uzbek, max 20 words]
${exampleBlock(wordLang, transLang)}

Output only the formatted blocks. No commentary.`;
}

export default function UnitPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const folderId = params.folderId as string;
  const unitId = params.unitId as string;

  const [unitName, setUnitName] = useState('');
  const [folderName, setFolderName] = useState('');
  const [words, setWords] = useState<UnitWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'words' | 'add'>('words');

  // AI import state
  const [wordLang, setWordLang] = useState('English');
  const [transLang, setTransLang] = useState('Uzbek');
  const [wordsInput, setWordsInput] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<ParsedWord[]>([]);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Word detail modal
  const [detailWord, setDetailWord] = useState<UnitWord | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    load();
  }, [user, authLoading, unitId]);

  useEffect(() => {
    setParsed(pasteText.trim() ? parseOutput(pasteText) : []);
  }, [pasteText]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const [unitRes, folderRes, wordsRes] = await Promise.all([
      supabase.from('teacher_units').select('name').eq('id', unitId).single(),
      supabase.from('teacher_folders').select('name').eq('id', folderId).single(),
      supabase.from('teacher_unit_words').select('id, word, translation, definition, part_of_speech, pronunciation, definition_uz, examples').eq('unit_id', unitId).order('position').order('created_at'),
    ]);
    setUnitName(unitRes.data?.name ?? '');
    setFolderName(folderRes.data?.name ?? '');
    setWords((wordsRes.data ?? []).map((w: any) => ({
      id: w.id,
      word: w.word,
      translation: w.translation,
      definition: w.definition ?? null,
      partOfSpeech: w.part_of_speech ?? null,
      pronunciation: w.pronunciation ?? null,
      definitionUz: w.definition_uz ?? null,
      examples: (w.examples ?? []) as WordExample[],
    })));
    setLoading(false);
  }

  async function importAll() {
    if (!parsed.length || !user) return;
    setImporting(true);
    const rows = parsed.map(w => ({
      unit_id: unitId,
      teacher_id: user.id,
      word: w.word,
      translation: w.translation,
      ...(w.definition ? { definition: w.definition } : {}),
      ...(w.partOfSpeech ? { part_of_speech: w.partOfSpeech } : {}),
      ...(w.pronunciation ? { pronunciation: w.pronunciation } : {}),
      ...(w.definitionUz ? { definition_uz: w.definitionUz } : {}),
      examples: w.examples,
    }));
    await supabase.from('teacher_unit_words').insert(rows);
    setPasteText(''); setWordsInput(''); setParsed([]);
    await load();
    setTab('words');
    setImporting(false);
  }

  async function deleteWord(id: string) {
    if (!confirm('Delete this word?')) return;
    await supabase.from('teacher_unit_words').delete().eq('id', id);
    setWords(prev => prev.filter(w => w.id !== id));
  }

  function copyPrompt(hasTranslations: boolean) {
    const words = wordsInput.trim() || (hasTranslations ? 'apple - olma\nbook - kitob' : 'apple, book, water');
    const prompt = buildPrompt(wordLang, transLang, words, hasTranslations);
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-1">
        <button onClick={() => router.push('/library')} className="hover:text-[var(--primary)]">Library</button>
        <span>/</span>
        <button onClick={() => router.push(`/library/${folderId}`)} className="hover:text-[var(--primary)]">{folderName}</button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--text)]">{unitName}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{words.length} {words.length === 1 ? 'word' : 'words'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--surface-2)] rounded-xl mb-6">
        {(['words', 'add'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm' : 'text-[var(--text-muted)]'}`}
          >
            {t === 'words' ? '📖 Words' : '🤖 Add Words'}
          </button>
        ))}
      </div>

      {/* Words tab */}
      {tab === 'words' && (
        words.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-xl font-bold text-[var(--text)] mb-2">No words yet</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">Go to Add Words to import words with AI.</p>
            <button onClick={() => setTab('add')} className="px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>Add Words</button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[var(--text-muted)] font-medium">{words.length} words</span>
              <button onClick={() => setTab('add')} className="text-xs font-semibold text-[var(--primary)] hover:underline">+ Add more</button>
            </div>
            {words.map(word => (
              <div
                key={word.id}
                onClick={() => setDetailWord(word)}
                className="flex items-center gap-3 p-4 bg-[var(--surface)] rounded-2xl cursor-pointer hover:bg-[var(--surface-2)] transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[var(--text)] text-sm">{word.word}</p>
                  <p className="text-[var(--primary)] text-xs font-semibold mt-0.5">{word.translation}</p>
                  {word.definition && <p className="text-[var(--text-muted)] text-xs mt-0.5 truncate">{word.definition}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[var(--primary-bg)] text-[var(--primary)]">
                    {word.examples.length}ex
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteWord(word.id); }}
                    className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-500 transition-all text-sm"
                  >🗑</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Add Words tab */}
      {tab === 'add' && (
        <div className="space-y-4">
          {/* Language selectors */}
          <div className="p-4 bg-[var(--surface)] rounded-2xl">
            <p className="text-xs font-bold text-[var(--text-muted)] mb-3">Word Language / Translation Language</p>
            <div className="flex items-center gap-3">
              <select value={wordLang} onChange={e => setWordLang(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none">
                {LANGUAGES.map(l => <option key={l}>{l}</option>)}
              </select>
              <span className="text-[var(--text-muted)] font-bold">→</span>
              <select value={transLang} onChange={e => setTransLang(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none">
                {LANGUAGES.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Step 1 */}
          <div className="p-4 bg-[var(--surface)] rounded-2xl">
            <p className="text-sm font-bold text-[var(--text)] mb-3">1. Enter words to import</p>
            <textarea
              value={wordsInput}
              onChange={e => setWordsInput(e.target.value)}
              placeholder={`apple, book, water\nor one per line\nor already-translated pairs like: apple - olma`}
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none focus:border-[var(--primary)] resize-none mb-3"
            />
            <div className="space-y-2">
              <button
                onClick={() => copyPrompt(false)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-bg)] transition-colors"
              >📋 Copy Prompt — just words, AI translates</button>
              <button
                onClick={() => copyPrompt(true)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
              >📋 Copy Prompt — I already have translations</button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 bg-[var(--surface)] rounded-2xl">
            <p className="text-sm font-bold text-[var(--text)] mb-3">2. Paste AI output</p>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste the AI response here..."
              rows={6}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-xs font-mono border border-[var(--border)] outline-none focus:border-[var(--primary)] resize-none"
            />
            {parsed.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-bold text-green-500">✅ {parsed.length} {parsed.length === 1 ? 'word' : 'words'} recognized</p>
                {parsed.map((w, i) => (
                  <div key={i} className="p-3 bg-[var(--surface-2)] rounded-xl">
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-[var(--text)] text-sm">{w.word}</span>
                      <span className="text-[10px] font-bold text-[var(--primary)] ml-2 shrink-0">{w.examples.length}ex</span>
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
              {importing ? 'Importing…' : `Import All (${parsed.length} words)`}
            </button>
          )}
        </div>
      )}

      {/* Copy toast */}
      {copied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-xl pointer-events-none" style={{ background: 'var(--primary)' }}>
          📋 Prompt copied — paste into an AI chatbot
        </div>
      )}

      {/* Word detail modal */}
      {detailWord && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-black text-[var(--text)]">{detailWord.word}</h2>
                <p className="text-[var(--primary)] font-bold text-lg mt-1">{detailWord.translation}</p>
                {detailWord.definition && <p className="text-[var(--text-muted)] text-sm mt-1">{detailWord.definition}</p>}
              </div>
              <button onClick={() => setDetailWord(null)} className="text-[var(--text-muted)] hover:text-[var(--text)] text-xl ml-4">✕</button>
            </div>
            {detailWord.examples.length > 0 && (
              <div>
                <p className="text-xs font-bold text-[var(--text-muted)] mb-3 tracking-wider">EXAMPLES</p>
                <div className="space-y-2">
                  {detailWord.examples.map((ex, i) => (
                    <div key={i} className="p-3 bg-[var(--surface-2)] rounded-xl">
                      <p className="text-sm text-[var(--text)] italic">"{ex.sentence}"</p>
                      {ex.translation && <p className="text-xs text-[var(--text-muted)] mt-1">{ex.translation}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
