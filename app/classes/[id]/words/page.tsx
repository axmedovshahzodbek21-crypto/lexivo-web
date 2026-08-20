'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { getClassDueWords, getClassSRSAll, getClassStarredWordIds, addClassStarredWord, removeClassStarredWord } from '@/lib/class-srs';

type InputTab = 'manual' | 'ai' | 'collection';

type CollectionDay = {
  dayNumber: number;
  topic: string;
  words: Array<{ word: string; translation: string; definition?: string; example1?: string; example1_translation?: string; example2?: string; example2_translation?: string }>;
};
type CollectionData = { days: CollectionDay[] };

const BUILT_IN_COLLECTIONS = [
  { name: 'A1 Starter',       emoji: '🌱', file: '/data/a1_collection.json' },
  { name: 'A2 Elementary',    emoji: '📗', file: '/data/a2_collection.json' },
  { name: 'B1 Intermediate',  emoji: '📘', file: '/data/b1_collection.json' },
  { name: 'B2+ Advanced',     emoji: '📕', file: '/data/advanced_collection.json' },
];

type WordExample = { sentence: string; translation: string };

interface ClassWord {
  id: string;
  word: string;
  translation: string;
  definition: string | null;
  example1: string | null;
  example1_translation: string | null;
  example2: string | null;
  example2_translation: string | null;
  examples: WordExample[] | null;
  folder_name: string | null;
  collection_name: string | null;
  created_at: string;
  source?: 'class' | 'library';
}

interface ParsedWord {
  word: string;
  translation: string;
  definition: string;
  examples: WordExample[];
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

const EXAMPLE_FORMAT = `example1: The enormous building towered above the city.
example1Translation: Ulkan bino shahar ustida baland turardi.
example2: She faced an enormous challenge at work.
example2Translation: U ishda ulkan muammoga duch keldi.
example3: The enormous whale surfaced near the boat.
example3Translation: Ulkan kit qayiq yonida suvdan chiqdi.
example4: They needed an enormous amount of funding.
example4Translation: Ularga juda katta miqdorda mablag' kerak edi.
example5: His enormous appetite surprised everyone at the table.
example5Translation: Uning ulkan ishtahasi dasturxon atrofidagilarni hayratga soldi.
example6: The storm caused enormous damage to the coast.
example6Translation: Bo'ron qirg'oqda ulkan zarar keltirdi.
example7: She had an enormous influence on her students.
example7Translation: U o'z o'quvchilariga ulkan ta'sir ko'rsatdi.
example8: The project required enormous effort from the whole team.
example8Translation: Loyiha butun jamoadan ulkan kuch talab qildi.
example9: An enormous crowd gathered in the central square.
example9Translation: Markaziy maydonga ulkan olomon to'plandi.
example10: The enormous pressure made it hard to focus.
example10Translation: Ulkan bosim diqqatni jamlashni qiyinlashtirdi.`;

function buildPrompt1(wordLang: string, transLang: string): string {
  return `I have a list of ${wordLang} words I want to learn. For each word, provide the translation in ${transLang}, a short definition in ${wordLang}, and 10 example sentences in ${wordLang} with their ${transLang} translations.

Format EXACTLY like this for every word. Use plain text only — no markdown, no bold, no asterisks, no extra formatting:

word: enormous
translation: ulkan
definition: extremely large in size or extent
${EXAMPLE_FORMAT}
---

Important: the example above uses English/Uzbek only to show the format. In your actual response, write the definition and examples in ${wordLang}, and the translations in ${transLang}.

Here are my words:
[PASTE YOUR WORDS HERE, one per line]`;
}

function buildPrompt2(wordLang: string, transLang: string): string {
  return `I have ${wordLang}-${transLang} word pairs. For each pair, keep my translation exactly as written. Add a short definition in ${wordLang} and 10 example sentences in ${wordLang} with their ${transLang} translations.

Format EXACTLY like this for every word. Use plain text only — no markdown, no bold, no asterisks, no extra formatting:

word: enormous
translation: ulkan
definition: extremely large in size or extent
${EXAMPLE_FORMAT}
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
    const examples: WordExample[] = [];
    for (let n = 1; n <= 10; n++) {
      const s = fields[`example${n}`];
      const t = fields[`example${n}translation`];
      if (s) examples.push({ sentence: s, translation: t ?? '' });
    }
    words.push({ word: fields.word, translation: fields.translation, definition: fields.definition ?? '', examples, language: langCode });
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

type WordsCache = { className: string; words: ClassWord[] };
const _wordsCache = new Map<string, WordsCache>();

function WordCard({ w }: { w: ClassWord }) {
  const [expanded, setExpanded] = useState(false);
  const allExamples: WordExample[] = w.examples && w.examples.length > 0
    ? w.examples
    : [
        ...(w.example1 ? [{ sentence: w.example1, translation: w.example1_translation ?? '' }] : []),
        ...(w.example2 ? [{ sentence: w.example2, translation: w.example2_translation ?? '' }] : []),
      ];
  const visible = expanded ? allExamples : allExamples.slice(0, 3);
  const hidden = allExamples.length - 3;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-sm text-[var(--text)]">{w.word}</span>
        <span className="text-[var(--text-muted)] text-sm">·</span>
        <span className="text-[var(--primary)] text-sm font-medium">{w.translation}</span>
      </div>
      {w.definition && <p className="text-xs text-[var(--text-muted)] mt-0.5">{w.definition}</p>}
      <div className="mt-1 space-y-1">
        {visible.map((ex, i) => (
          <div key={i}>
            <p className="text-xs italic text-[var(--text-muted)]">&ldquo;{ex.sentence}&rdquo;</p>
            {ex.translation && <p className="text-[10px] text-[var(--text-muted)] pl-2">↳ {ex.translation}</p>}
          </div>
        ))}
      </div>
      {allExamples.length > 3 && (
        <button
          onClick={() => setExpanded(p => !p)}
          className="text-[10px] font-semibold text-[var(--primary)] mt-1"
        >
          {expanded ? '▲ Show less' : `▼ +${hidden} more examples`}
        </button>
      )}
    </div>
  );
}

export default function ClassWordsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [className, setClassName] = useState('');
  const [isTeacher, setIsTeacher] = useState(false);
  const [notMember, setNotMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<ClassWord[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [learnedCount, setLearnedCount] = useState(0);
  const [hardCount, setHardCount] = useState(0);
  const [starredCount, setStarredCount] = useState(0);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
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
  // addManual/importWords/importCollectionDay/toggleStar previously
  // swallowed every Supabase failure silently — a failed insert left the
  // teacher staring at a spinner-then-nothing with no indication anything
  // went wrong, and toggleStar's optimistic star/unstar never rolled back.
  const [wordsError, setWordsError] = useState<string | null>(null);

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

  // Collection import tab
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [importingCollection, setImportingCollection] = useState(false);

  const parseResult = useMemo(() => parseOutput(pasted, wordLangCode), [pasted, wordLangCode]);
  const parsed = parseResult.words;

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const [due, all, { count: hard }, starIds] = await Promise.all([
        getClassDueWords(user.id, id),
        getClassSRSAll(user.id, id),
        supabase.from('class_hard_words').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('class_id', id),
        getClassStarredWordIds(user.id, id),
      ]);
      setDueCount(due.length);
      setLearnedCount(all.length);
      setHardCount(hard ?? 0);
      setStarredIds(starIds);
      setStarredCount(starIds.size);
    })();
  }, [user, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleStar = async (word: string) => {
    if (!user) return;
    const isStarred = starredIds.has(word);
    // Optimistic update
    setStarredIds(prev => {
      const next = new Set(prev);
      isStarred ? next.delete(word) : next.add(word);
      return next;
    });
    setStarredCount(c => isStarred ? c - 1 : c + 1);
    try {
      if (isStarred) {
        await removeClassStarredWord(user.id, id, word);
      } else {
        await addClassStarredWord(user.id, id, word);
      }
    } catch {
      // Revert the optimistic update — it never made it to the server, so
      // leaving it applied locally would desync from what's actually stored.
      setStarredIds(prev => {
        const next = new Set(prev);
        isStarred ? next.add(word) : next.delete(word);
        return next;
      });
      setStarredCount(c => isStarred ? c + 1 : c - 1);
      setWordsError('Failed to update star — try again');
    }
  };

  const loadWords = async (clsName?: string) => {
    const [{ data: cwData }, { data: libData }] = await Promise.all([
      supabase
        .from('class_words')
        .select('id, word, translation, definition, example1, example1_translation, example2, example2_translation, examples, folder_name, collection_name, created_at')
        .eq('class_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('class_library_assignments')
        .select('teacher_folders(name, teacher_units(name, teacher_unit_words(id, word, translation, definition, examples, created_at)))')
        .eq('class_id', id),
    ]);

    const classWords: ClassWord[] = ((cwData ?? []) as ClassWord[]).map(w => ({ ...w, source: 'class' as const }));

    const libWords: ClassWord[] = [];
    for (const assign of (libData ?? []) as any[]) {
      const folder = assign.teacher_folders;
      if (!folder) continue;
      for (const unit of (folder.teacher_units ?? []) as any[]) {
        for (const w of (unit.teacher_unit_words ?? []) as any[]) {
          const exs: WordExample[] = (w.examples as any[] | null)?.map((e: any) => ({
            sentence: e.sentence ?? '', translation: e.translation ?? '',
          })) ?? [];
          libWords.push({
            id: w.id, word: w.word, translation: w.translation,
            definition: w.definition ?? null,
            example1: exs[0]?.sentence ?? null,
            example1_translation: exs[0]?.translation ?? null,
            example2: exs[1]?.sentence ?? null,
            example2_translation: exs[1]?.translation ?? null,
            examples: exs.length > 0 ? exs : null,
            folder_name: folder.name,
            collection_name: unit.name,
            created_at: w.created_at ?? '',
            source: 'library',
          });
        }
      }
    }

    const fetched = [...classWords, ...libWords];
    setWords(fetched);
    if (clsName !== undefined) _wordsCache.set(id, { className: clsName, words: fetched });
    else { const c = _wordsCache.get(id); if (c) _wordsCache.set(id, { ...c, words: fetched }); }
  };

  useEffect(() => {
    if (!user || !id) return;
    const cached = _wordsCache.get(id);
    if (cached) {
      setClassName(cached.className);
      setWords(cached.words);
      setLoading(false);
    } else {
      setLoading(true);
    }

    (async () => {
      const { data: cls } = await supabase.from('classes').select('name, teacher_id').eq('id', id).single();
      if (!cls) { setNotMember(true); setLoading(false); return; }
      const isT = cls.teacher_id === user.id;
      if (!isT) {
        const { data: membership } = await supabase.from('class_members').select('id').eq('class_id', id).eq('student_id', user.id).maybeSingle();
        if (!membership) { setNotMember(true); setLoading(false); return; }
      }
      setIsTeacher(isT);
      setClassName(cls.name);
      await loadWords(cls.name);
      setLoading(false);
    })();
  }, [user, id]);

  const addManual = async () => {
    if (!user || !manualWord.trim() || !manualTranslation.trim()) return;
    setAdding(true);
    setWordsError(null);
    try {
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
    } catch (e) {
      setWordsError(`Failed to add word: ${e instanceof Error ? e.message : e}`);
    }
    setAdding(false);
  };

  const importWords = async () => {
    if (!user || parsed.length === 0) return;
    setImporting(true);
    setWordsError(null);
    const rows = parsed.map(w => ({
      class_id: id,
      teacher_id: user.id,
      word: w.word,
      translation: w.translation,
      definition: w.definition || null,
      example1: w.examples[0]?.sentence || null,
      example1_translation: w.examples[0]?.translation || null,
      example2: w.examples[1]?.sentence || null,
      example2_translation: w.examples[1]?.translation || null,
      examples: w.examples.length > 0 ? w.examples : null,
      language: w.language,
      folder_name: folderInput.trim() || null,
      collection_name: collectionInput.trim() || null,
    }));
    try {
      await supabase.from('class_words').insert(rows);
      setPasted('');
      await loadWords();
    } catch (e) {
      setWordsError(`Failed to import words: ${e instanceof Error ? e.message : e}`);
    }
    setImporting(false);
  };

  const deleteWord = async (wordId: string) => {
    if (!confirm('Delete this word?')) return;
    // class_id scopes the delete to this class as defense-in-depth — RLS is
    // the real backstop, but a bare .eq('id', wordId) here would let a
    // misconfigured policy delete any class_words row by id regardless of
    // which class it belongs to.
    await supabase.from('class_words').delete().eq('id', wordId).eq('class_id', id);
    setWords(prev => {
      const next = prev.filter(w => w.id !== wordId);
      const c = _wordsCache.get(id); if (c) _wordsCache.set(id, { ...c, words: next });
      return next;
    });
  };

  const pickCollection = async (file: string) => {
    if (selectedCollection === file) {
      setSelectedCollection(null); setCollectionData(null); setSelectedDayIdx(null); return;
    }
    setLoadingCollection(true); setSelectedCollection(file); setSelectedDayIdx(null);
    try {
      const res = await fetch(file);
      setCollectionData(await res.json() as CollectionData);
    } catch (_) { setCollectionData(null); }
    setLoadingCollection(false);
  };

  const importCollectionDay = async () => {
    if (!user || !collectionData || selectedDayIdx === null) return;
    setImportingCollection(true);
    setWordsError(null);
    try {
      const day = collectionData.days[selectedDayIdx];
      const colName = BUILT_IN_COLLECTIONS.find(c => c.file === selectedCollection)?.name ?? '';
      const rows = day.words.map(w => {
        const examples: WordExample[] = [
          ...(w.example1 ? [{ sentence: w.example1, translation: w.example1_translation ?? '' }] : []),
          ...(w.example2 ? [{ sentence: w.example2, translation: w.example2_translation ?? '' }] : []),
        ];
        return {
          class_id: id, teacher_id: user.id,
          word: w.word, translation: w.translation,
          definition: w.definition || null,
          example1: w.example1 || null,
          example1_translation: w.example1_translation || null,
          example2: w.example2 || null,
          example2_translation: w.example2_translation || null,
          examples: examples.length > 0 ? examples : null,
          folder_name: colName,
          collection_name: `Day ${day.dayNumber}: ${day.topic}`,
        };
      });
      await supabase.from('class_words').insert(rows);
      setSelectedDayIdx(null);
      await loadWords();
    } catch (e) {
      setWordsError(`Failed to import collection: ${e instanceof Error ? e.message : e}`);
    }
    setImportingCollection(false);
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

  if (notMember) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
      <div className="text-5xl">⛔</div>
      <p className="font-bold text-[var(--text)]">You're not in this class</p>
      <button onClick={() => router.push(`/classes/${id}/home`)} className="btn-primary">Go back</button>
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

  const _n = (id as string).split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
  const _grad = ['from-indigo-500 to-purple-500','from-pink-500 to-rose-400','from-emerald-500 to-teal-400','from-blue-500 to-cyan-400','from-amber-500 to-orange-400','from-violet-500 to-purple-400','from-red-500 to-pink-400','from-cyan-500 to-blue-400'][_n % 8];
  const _glow = ['#818cf8','#ec4899','#22c55e','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4'][_n % 8];

  return (
    <div className="flex flex-col min-h-screen pb-24 animate-fade-in">
      <div className={`bg-gradient-to-br ${_grad} px-5 pt-5 pb-7 relative`}
        style={{ boxShadow: `0 8px 32px ${_glow}cc` }}>
        <div style={{ position: 'absolute', right: 16, top: 8, fontSize: 80, fontWeight: 900, color: 'rgba(255,255,255,0.06)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>📝</div>
        <button onClick={() => router.push(`/classes/${id}/home`)} className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium mb-4 transition-colors">← Back</button>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ background: 'rgba(255,255,255,0.18)', boxShadow: '0 4px 0 rgba(0,0,0,0.15)' }}>📝</div>
          <div>
            <p className="text-xs font-black text-white/50 uppercase tracking-widest mb-0.5">{className || '...'}</p>
            <h1 className="text-2xl font-black text-white leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>Class Words</h1>
            <p className="text-sm text-white/60 mt-1">All vocabulary in this class</p>
          </div>
        </div>
      </div>

      {wordsError && (
        <div className="mx-4 mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-500 flex items-center justify-between gap-3">
          <span>{wordsError}</span>
          <button onClick={() => setWordsError(null)} className="shrink-0 font-bold">✕</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="text-4xl animate-bounce">📝</div></div>
      ) : (
        <div className="p-4 space-y-4">

          {/* ── Word list — always first ── */}
          {words.length > 0 && (
            <div className="space-y-4 pt-2">
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
                {words.length} word{words.length !== 1 ? 's' : ''} in this class
              </p>
              {Array.from(grouped.entries()).map(([folder, colMap]) => {
                const folderCollapsed = folder ? collapsedFolders.has(folder) : false;
                return (
                <div key={folder} className="space-y-2">
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
                      {col && (
                        <button onClick={() => toggleCol(colKey)} className="flex items-center gap-2 px-1 w-full text-left">
                          <span className="text-sm">📖</span>
                          <span className="font-semibold text-xs text-[var(--text-muted)]">{col}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">· {colWords.length} word{colWords.length !== 1 ? 's' : ''}</span>
                          <span className="text-[10px] text-[var(--text-muted)] ml-auto">{collapsed ? '▶' : '▼'}</span>
                        </button>
                      )}
                      {!collapsed && colWords.map(w => (
                        <div key={w.id} className={`card flex items-start gap-3 ${folder ? 'border-l-2 border-[var(--primary)] border-opacity-30' : ''}`}>
                          <WordCard w={w} />
                          {isTeacher && w.source !== 'library' ? (
                            <button onClick={() => deleteWord(w.id)} className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors text-sm shrink-0 mt-0.5" aria-label="Delete word">✕</button>
                          ) : !isTeacher ? (
                            <button
                              onClick={() => toggleStar(w.word)}
                              className={`text-lg shrink-0 mt-0.5 transition-transform active:scale-75 ${starredIds.has(w.word) ? 'opacity-100' : 'opacity-25 hover:opacity-60'}`}
                              aria-label={starredIds.has(w.word) ? 'Unstar word' : 'Star word'}
                            >{starredIds.has(w.word) ? '⭐' : '☆'}</button>
                          ) : null}
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
              <p className="font-bold text-[var(--text)]">No words yet</p>
              <p className="text-sm text-[var(--text-muted)]">{isTeacher ? 'Add words below' : 'Your teacher hasn\'t added any words yet'}</p>
            </div>
          )}

          {/* ── Study Hub ── */}
          {words.length > 0 && (
            <div className="space-y-3 pt-1">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">── Practice</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { label: '📖 Study',      href: `/learn?source=class&classId=${id}&className=${encodeURIComponent(className)}`,      primary: true  },
                  { label: '🃏 Flashcards', href: `/flashcards?source=class&classId=${id}&className=${encodeURIComponent(className)}`, primary: false },
                  { label: '❓ Quiz',       href: `/quiz?source=class&classId=${id}&className=${encodeURIComponent(className)}`,       primary: false },
                  { label: '🔗 Match',      href: `/matching?source=class&classId=${id}&className=${encodeURIComponent(className)}`,   primary: false },
                ] as { label: string; href: string; primary: boolean }[]).map(({ label, href, primary }) => (
                  <button
                    key={label}
                    onClick={() => router.push(href)}
                    className={`flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-95 ${primary ? 'text-white' : 'bg-[var(--surface-2)] text-[var(--text)]'}`}
                    style={primary ? { background: 'linear-gradient(135deg, var(--primary), #9333ea)', boxShadow: '0 4px 12px rgba(109,60,255,0.3)' } : {}}
                  >
                    <span>{label}</span><span className="opacity-50 text-xs">→</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">── Review</p>
              <div className="card flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-sm text-[var(--text)]">SRS Review</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {dueCount > 0 ? `${dueCount} word${dueCount !== 1 ? 's' : ''} due today` : 'All caught up ✓'}
                  </p>
                </div>
                {dueCount > 0 ? (
                  <button onClick={() => router.push(`/classes/${id}/review`)} className="shrink-0 px-4 py-2 rounded-2xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', boxShadow: '0 4px 10px rgba(239,68,68,0.3)' }}>Review →</button>
                ) : <span className="text-2xl">✅</span>}
              </div>
              {!isTeacher && (
                <>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">── My Stats</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: `${learnedCount}/${words.length}`, label: 'Learned', color: 'var(--primary)' },
                      { value: hardCount,    label: 'Hard',    color: '#ef4444' },
                      { value: starredCount, label: 'Starred', color: '#f59e0b' },
                    ].map(({ value, label, color }) => (
                      <div key={label} className="card text-center py-3 space-y-0.5">
                        <p className="text-lg font-black" style={{ color }}>{value}</p>
                        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">{label}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => router.push(`/classes/${id}/progress`)} className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-[var(--surface-2)] text-sm font-semibold text-[var(--text)] active:scale-95 transition-transform">
                    <span>📊 My Progress</span><span className="text-[var(--text-muted)] text-xs">→</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Add words (teacher only) — at the bottom ── */}
          {isTeacher && (
          <div className="space-y-4 pt-2 border-t border-[var(--border)]">
            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Add words</p>
            <div className="flex rounded-2xl overflow-hidden border border-[var(--border)]">
              {(['manual', 'ai', 'collection'] as InputTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${tab === t ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
                >
                  {t === 'manual' ? '✏️ Manual' : t === 'ai' ? '🤖 AI' : '📚 Collection'}
                </button>
              ))}
            </div>

          {/* Add-word tabs — teacher only */}
          {/* Manual tab */}
          {isTeacher && tab === 'manual' && (
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
          {isTeacher && tab === 'ai' && (
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
                      {Array.from({length: 10}, (_, i) => i + 1).map(n => (
                        <div key={n}>
                          <span className="text-[var(--text-muted)]">example{n}:</span><span className="text-[var(--text)]"> sentence #{n}</span>
                          <br />
                          <span className="text-[var(--text-muted)]">example{n}Translation:</span><span className="text-[var(--text)]"> translation #{n}</span>
                        </div>
                      ))}
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
                          {w.examples.slice(0, 3).map((ex, ei) => (
                            <div key={ei}>
                              <p className="text-xs italic text-[var(--text)]">&quot;{ex.sentence}&quot;</p>
                              {ex.translation && <p className="text-xs text-[var(--text-muted)] pl-2">↳ {ex.translation}</p>}
                            </div>
                          ))}
                          {w.examples.length > 3 && (
                            <p className="text-[10px] text-[var(--text-muted)] font-medium">+{w.examples.length - 3} more examples hidden</p>
                          )}
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

          {/* Collection Import tab */}
          {isTeacher && tab === 'collection' && (
            <div className="space-y-3">
              <div className="card space-y-3">
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Pick a Collection</p>
                <div className="space-y-2">
                  {BUILT_IN_COLLECTIONS.map(col => {
                    const isSelected = selectedCollection === col.file;
                    return (
                      <button key={col.file} onClick={() => pickCollection(col.file)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${isSelected ? 'bg-[var(--primary-bg)] border-[var(--primary)]/50' : 'bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--primary)]/30'}`}
                      >
                        <span className="text-xl">{col.emoji}</span>
                        <p className={`flex-1 text-sm font-bold ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--text)]'}`}>{col.name}</p>
                        {isSelected && <span className="text-[var(--primary)] text-sm">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {loadingCollection && (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!loadingCollection && collectionData && (
                <div className="card space-y-2">
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Pick a Unit</p>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {collectionData.days.map((day, i) => {
                      const isSelected = selectedDayIdx === i;
                      return (
                        <button key={i} onClick={() => setSelectedDayIdx(isSelected ? null : i)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${isSelected ? 'bg-[var(--primary-bg)] border-[var(--primary)]/50' : 'bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--primary)]/30'}`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${isSelected ? 'bg-[var(--primary)] text-white' : 'bg-[var(--primary-bg)] text-[var(--primary)]'}`}>
                            {day.dayNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--text)]'}`}>{day.topic}</p>
                            <p className="text-xs text-[var(--text-muted)]">{day.words.length} words</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {collectionData && selectedDayIdx !== null && (
                <button onClick={importCollectionDay} disabled={importingCollection} className="w-full btn-primary py-3 disabled:opacity-50">
                  {importingCollection ? 'Importing…' : `Import ${collectionData.days[selectedDayIdx].words.length} words to class`}
                </button>
              )}
            </div>
          )}

          </div>
          )}

        </div>
      )}
    </div>
  );
}
