'use client';
import { SectionLoader } from '@/components/Loader';
import { useEffect, useState, useMemo } from 'react';
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

Here are my pairs (word - translation):
[PASTE YOUR PAIRS HERE, one per line]`;
}

function parseOutput(text: string, langCode: string): ParsedWord[] {
  const blocks = text.split(/---+/).map(b => b.trim()).filter(Boolean);
  const words: ParsedWord[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const fields: Record<string, string> = {};
    for (const line of lines) {
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      const key = line.slice(0, colon).trim().toLowerCase().replace(/[*_`#]/g, '');
      const val = line.slice(colon + 1).trim().replace(/[*_`]/g, '');
      fields[key] = val;
    }
    if (!fields.word || !fields.translation) continue;
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
  return words;
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
  const [copied1, setCopied1] = useState(false);
  const [copied2, setCopied2] = useState(false);
  const [importing, setImporting] = useState(false);

  const parsed = useMemo(() => parseOutput(pasted, wordLangCode), [pasted, wordLangCode]);

  const loadWords = async () => {
    const { data } = await supabase
      .from('class_words')
      .select('id, word, translation, definition, example1, example1_translation, example2, example2_translation, created_at')
      .eq('class_id', id)
      .order('created_at', { ascending: false });
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

  return (
    <div className="flex flex-col min-h-screen pb-24 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button
          onClick={() => router.back()}
          className="btn-icon text-lg"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-[var(--text)]">📝 Homework Words</h1>
          <p className="text-xs text-[var(--text-muted)] truncate">{className}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-black text-[var(--primary)]">{words.length}</p>
          <p className="text-[10px] text-[var(--text-muted)]">words</p>
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
                <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">
                  Definition <span className="font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Short definition…"
                  value={manualDefinition}
                  onChange={e => setManualDefinition(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
              <button
                onClick={() => setShowExamples(p => !p)}
                className="text-xs text-[var(--primary)] font-medium"
              >
                {showExamples ? '▲ Hide example' : '▼ Add example sentence (optional)'}
              </button>
              {showExamples && (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Example sentence…"
                    value={manualExample1}
                    onChange={e => setManualExample1(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
                  />
                  <input
                    type="text"
                    placeholder="Translation of example…"
                    value={manualExample1Trans}
                    onChange={e => setManualExample1Trans(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
              )}
              <button
                onClick={addManual}
                disabled={adding || !manualWord.trim() || !manualTranslation.trim()}
                className="w-full btn-primary py-3 disabled:opacity-50"
              >
                {adding ? 'Adding…' : '+ Add word'}
              </button>
            </div>
          )}

          {/* AI Import tab */}
          {tab === 'ai' && (
            <div className="space-y-3">
              {/* Language selectors */}
              <div className="card">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Word language</label>
                    <select
                      value={wordLang}
                      onChange={e => {
                        const lang = LANGUAGES.find(l => l.label === e.target.value);
                        setWordLang(e.target.value);
                        if (lang) setWordLangCode(lang.code);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
                    >
                      {LANGUAGES.map(l => <option key={l.code}>{l.label}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Translation language</label>
                    <select
                      value={transLang}
                      onChange={e => setTransLang(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
                    >
                      {LANGUAGES.map(l => <option key={l.code}>{l.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Prompt 1 */}
              <div className="card space-y-3">
                <button
                  onClick={() => setOpen1(p => !p)}
                  className="w-full flex items-center justify-between"
                >
                  <div className="text-left">
                    <p className="font-semibold text-sm text-[var(--text)]">I have words only (no translations)</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">AI adds translations, definitions, examples</p>
                  </div>
                  <span className="text-[var(--text-muted)] ml-2">{open1 ? '▲' : '▼'}</span>
                </button>
                {open1 && (
                  <div className="space-y-2">
                    <pre className="text-xs bg-[var(--surface-2)] rounded-xl p-3 whitespace-pre-wrap text-[var(--text)] leading-relaxed overflow-x-auto">
                      {buildPrompt1(wordLang, transLang)}
                    </pre>
                    <button
                      onClick={() => copyPrompt(buildPrompt1(wordLang, transLang), 1)}
                      className="w-full py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold"
                    >
                      {copied1 ? '✅ Copied!' : '📋 Copy prompt'}
                    </button>
                  </div>
                )}
              </div>

              {/* Prompt 2 */}
              <div className="card space-y-3">
                <button
                  onClick={() => setOpen2(p => !p)}
                  className="w-full flex items-center justify-between"
                >
                  <div className="text-left">
                    <p className="font-semibold text-sm text-[var(--text)]">I have word-translation pairs</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">AI keeps your translations, adds definitions and examples</p>
                  </div>
                  <span className="text-[var(--text-muted)] ml-2">{open2 ? '▲' : '▼'}</span>
                </button>
                {open2 && (
                  <div className="space-y-2">
                    <pre className="text-xs bg-[var(--surface-2)] rounded-xl p-3 whitespace-pre-wrap text-[var(--text)] leading-relaxed overflow-x-auto">
                      {buildPrompt2(wordLang, transLang)}
                    </pre>
                    <button
                      onClick={() => copyPrompt(buildPrompt2(wordLang, transLang), 2)}
                      className="w-full py-2 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold"
                    >
                      {copied2 ? '✅ Copied!' : '📋 Copy prompt'}
                    </button>
                  </div>
                )}
              </div>

              {/* Paste area */}
              <div className="card space-y-2">
                <p className="font-semibold text-sm text-[var(--text)]">Paste AI response here</p>
                <textarea
                  value={pasted}
                  onChange={e => setPasted(e.target.value)}
                  placeholder="Paste the AI-formatted output here…"
                  rows={8}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)] resize-none font-mono"
                />
              </div>

              {/* Preview & add */}
              {parsed.length > 0 && (
                <div className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-[var(--text)]">Preview</p>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success)' }}>
                      {parsed.length} words ready
                    </span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {parsed.map((w, i) => (
                      <div key={i} className="rounded-xl border border-[var(--border)] px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[var(--text)]">{w.word}</span>
                          <span className="text-[var(--text-muted)]">·</span>
                          <span className="text-[var(--primary)] text-sm font-medium">{w.translation}</span>
                        </div>
                        {w.definition && <p className="text-xs text-[var(--text-muted)] mt-0.5">{w.definition}</p>}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={importWords}
                    disabled={importing}
                    className="w-full btn-primary py-3 disabled:opacity-50"
                  >
                    {importing ? 'Adding…' : `Add ${parsed.length} word${parsed.length !== 1 ? 's' : ''} to class`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Word list */}
          {words.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
                {words.length} word{words.length !== 1 ? 's' : ''} assigned to this class
              </p>
              {words.map(w => (
                <div key={w.id} className="card flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[var(--text)]">{w.word}</span>
                      <span className="text-[var(--text-muted)] text-sm">·</span>
                      <span className="text-[var(--primary)] text-sm font-medium">{w.translation}</span>
                    </div>
                    {w.definition && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{w.definition}</p>
                    )}
                    {w.example1 && (
                      <p className="text-xs italic text-[var(--text-muted)] mt-0.5">&ldquo;{w.example1}&rdquo;</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteWord(w.id)}
                    className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors text-sm shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {words.length === 0 && !loading && (
            <div className="card text-center py-10 space-y-2">
              <div className="text-4xl">📝</div>
              <p className="font-bold text-[var(--text)]">No words yet</p>
              <p className="text-sm text-[var(--text-muted)]">Add words manually or use AI Import above</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
