'use client';
import { useTranslation } from '@/lib/useTranslation';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { unitCache as _cache } from '@/lib/teacher-library-cache';
import { type AiParsedWord } from '@/lib/ai-import';
import AiAddWordsPanel, { UnitTabBar } from '@/components/AiAddWordsPanel';
import { CopyWordListButton } from '@/components/CopyWordList';

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

export default function UnitPage() {
  const t = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const folderId = params.folderId as string;
  const unitId = params.unitId as string;

  const cached = _cache[unitId] ?? null;
  const [unitName, setUnitName] = useState(cached?.unitName ?? '');
  const [folderName, setFolderName] = useState(cached?.folderName ?? '');
  const [words, setWords] = useState<UnitWord[]>(cached?.words ?? []);
  const [loading, setLoading] = useState(cached === null);
  const [tab, setTab] = useState<'words' | 'add'>('words');

  // Word detail modal
  const [detailWord, setDetailWord] = useState<UnitWord | null>(null);

  // Selection + delete confirmation
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmModal, setConfirmModal] = useState<
    | { type: 'word'; id: string; message: string }
    | { type: 'bulk'; ids: string[]; message: string }
    | null
  >(null);
  const loadIdRef = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    load();
  }, [user, authLoading, unitId]);

  async function load() {
    if (!user) return;
    // Guard against a slow stale request (e.g. from a previously-viewed
    // unitId) resolving after a faster, more recent one and overwriting
    // this page's state with outdated data.
    const myLoadId = ++loadIdRef.current;
    const [unitRes, folderRes, wordsRes] = await Promise.all([
      supabase.from('teacher_units').select('name, teacher_id').eq('id', unitId).maybeSingle(),
      supabase.from('teacher_folders').select('name').eq('id', folderId).maybeSingle(),
      supabase.from('teacher_unit_words').select('id, word, translation, definition, part_of_speech, pronunciation, definition_uz, examples').eq('unit_id', unitId).order('position').order('created_at'),
    ]);
    if (loadIdRef.current !== myLoadId) return;
    // Defense-in-depth: RLS is the real backstop, but confirm this unit is
    // actually the caller's before trusting an arbitrary unitId's data.
    if (!unitRes.data || unitRes.data.teacher_id !== user.id) {
      router.replace(`/library/${folderId}`);
      return;
    }
    const unit = unitRes.data.name;
    const folder = folderRes.data?.name ?? '';
    const mapped = (wordsRes.data ?? []).map((w: any) => ({
      id: w.id,
      word: w.word,
      translation: w.translation,
      definition: w.definition ?? null,
      partOfSpeech: w.part_of_speech ?? null,
      pronunciation: w.pronunciation ?? null,
      definitionUz: w.definition_uz ?? null,
      examples: (w.examples ?? []) as WordExample[],
    }));
    _cache[unitId] = { unitName: unit, folderName: folder, words: mapped };
    setUnitName(unit);
    setFolderName(folder);
    setWords(mapped);
    setLoading(false);
  }

  // onAdd for the shared AiAddWordsPanel. Word language isn't stored for
  // Library words (no column for it), so langCode is unused here.
  async function addWords(parsed: AiParsedWord[]) {
    if (!user) return;
    // Defense-in-depth: confirm this unit is actually the caller's before
    // importing words into it — RLS is the real backstop, but nothing here
    // previously stopped an arbitrary unitId from being trusted outright.
    const { data: unit } = await supabase.from('teacher_units').select('teacher_id').eq('id', unitId).maybeSingle();
    if (!unit || unit.teacher_id !== user.id) return;
    // Same dedupe as My Words' addImportedWords: skip words already in this
    // unit, and repeats within the same paste (first occurrence wins).
    const { data: existing } = await supabase.from('teacher_unit_words').select('word').eq('unit_id', unitId);
    const seen = new Set((existing ?? []).map((e: { word: string }) => e.word.toLowerCase().trim()));
    const fresh = parsed.filter(w => {
      const key = w.word.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!fresh.length) return;
    const rows = fresh.map(w => ({
      unit_id: unitId,
      teacher_id: user.id,
      word: w.word,
      translation: w.translation,
      ...(w.definition ? { definition: w.definition } : {}),
      ...(w.partOfSpeech ? { part_of_speech: w.partOfSpeech } : {}),
      ...(w.pronunciation ? { pronunciation: w.pronunciation } : {}),
      ...(w.definitionUz ? { definition_uz: w.definitionUz } : {}),
      examples: w.examples.slice(0, 10),
    }));
    // supabase-js returns errors rather than throwing — without this a
    // failed insert looked like success.
    const { error } = await supabase.from('teacher_unit_words').insert(rows);
    if (error) throw new Error(error.message);
    await load();
  }

  async function deleteWordIds(ids: string[]) {
    if (!user) return;
    await supabase.from('teacher_unit_words').delete().in('id', ids).eq('teacher_id', user.id);
    setWords(prev => {
      const next = prev.filter(w => !ids.includes(w.id));
      const c = _cache[unitId];
      if (c) _cache[unitId] = { ...c, words: next };
      return next;
    });
  }

  function toggleSelectMode() {
    setSelectMode(v => !v);
    setSelected(new Set());
  }

  function toggleSelected(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function requestDeleteWord(id: string) {
    setConfirmModal({ type: 'word', id, message: t.libraryPage.deleteWordConfirm });
  }

  function requestDeleteSelected() {
    if (selected.size === 0) return;
    const ids = [...selected];
    setConfirmModal({ type: 'bulk', ids, message: t.libraryPage.deleteSelectedConfirm(ids.length) });
  }

  async function confirmDelete() {
    if (!confirmModal) return;
    if (confirmModal.type === 'word') {
      await deleteWordIds([confirmModal.id]);
    } else {
      await deleteWordIds(confirmModal.ids);
      setSelected(new Set());
      setSelectMode(false);
    }
    setConfirmModal(null);
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
        <button onClick={() => router.push('/library')} className="hover:text-[var(--primary)]">{t.libraryPage.title}</button>
        <span>/</span>
        <button onClick={() => router.push(`/library/${folderId}`)} className="hover:text-[var(--primary)]">{folderName}</button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--text)]">{unitName}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{t.libraryPage.wordsCount(words.length)}</p>
        </div>
        {tab === 'words' && words.length > 0 && (
          <div className="flex items-center gap-2">
          {!selectMode && <CopyWordListButton words={words.map(w => w.word)} />}
          <button
            onClick={toggleSelectMode}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${selectMode ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
          >
            {selectMode ? t.libraryPage.cancel : t.libraryPage.select}
          </button>
          </div>
        )}
      </div>

      <UnitTabBar tab={tab} onChange={setTab} />

      {/* Words tab */}
      {tab === 'words' && (
        words.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-xl font-bold text-[var(--text)] mb-2">{t.libraryPage.noWordsYet}</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">{t.libraryPage.goToAddWords}</p>
            <button onClick={() => setTab('add')} className="px-6 py-3 rounded-xl text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>{t.libraryPage.addWords}</button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[var(--text-muted)] font-medium">{t.libraryPage.wordsCount(words.length)}</span>
              {!selectMode && <button onClick={() => setTab('add')} className="text-xs font-semibold text-[var(--primary)] hover:underline">+ {t.libraryPage.addMore}</button>}
            </div>
            {words.map(word => {
              const isSelected = selected.has(word.id);
              return (
                <div
                  key={word.id}
                  onClick={() => selectMode ? toggleSelected(word.id) : setDetailWord(word)}
                  className={`flex items-center gap-3 p-4 bg-[var(--surface)] rounded-2xl cursor-pointer hover:bg-[var(--surface-2)] transition-colors group ${isSelected ? 'ring-2 ring-[var(--primary)]' : ''}`}
                >
                  {selectMode && (
                    <div className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center ${isSelected ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-[var(--border)]'}`}>
                      {isSelected && <span className="text-white text-xs leading-none">✓</span>}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[var(--text)] text-sm">{word.word}</p>
                    <p className="text-[var(--primary)] text-xs font-semibold mt-0.5">{word.translation}</p>
                    {word.definition && <p className="text-[var(--text-muted)] text-xs mt-0.5 truncate">{word.definition}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[var(--primary-bg)] text-[var(--primary)]">
                      {t.libraryPage.exCount(word.examples.length)}
                    </span>
                    {!selectMode && (
                      <button
                        onClick={e => { e.stopPropagation(); requestDeleteWord(word.id); }}
                        className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-500 transition-all text-sm"
                      >🗑</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Add Words tab */}
      {/* Hidden rather than unmounted so a half-finished paste survives a tab switch. */}
      <div hidden={tab !== 'add'}><AiAddWordsPanel onAdd={addWords} onAdded={() => setTab('words')} /></div>

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
                <p className="text-xs font-bold text-[var(--text-muted)] mb-3 tracking-wider">{t.libraryPage.examples}</p>
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

      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl bg-[var(--surface)] border border-[var(--border)]">
          <span className="text-sm font-semibold text-[var(--text)]">{selected.size} selected</span>
          <button
            onClick={requestDeleteSelected}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: 'var(--danger)' }}
          >
            🗑️ Delete
          </button>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0" onClick={() => setConfirmModal(null)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-[var(--text)] font-semibold mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[var(--text-muted)] bg-[var(--surface-2)]"
              >
                {t.libraryPage.cancel}
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'var(--danger)' }}
              >
                {t.libraryPage.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
