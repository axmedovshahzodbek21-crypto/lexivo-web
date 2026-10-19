'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/useTranslation';
import { fmtDate, loadStudentMeta, studentsLabel } from '@/lib/class-insights';
import {
  type ArchivedWord, type StudentWordStatus, archiveHardWord, loadArchiveStates, unarchiveHardWord,
} from '@/lib/class-hard-words';
import { getAllWords, loadAllCollections } from '@/lib/data';

// Teacher-only list of every word students in this class marked "Too hard"
// (class_hard_words — rows are removed when a student unmarks a word).
// "Taught ✓" archives a word (class_hard_word_archive); from then on each
// student's review answers decide whether it's still hard for them — see
// lib/class-hard-words.ts. ?teach=1 opens the big-screen teaching view.

interface HardRow { word: string; translation: string | null; students: { id: string; name: string }[]; }
interface Loaded {
  notTeacher: boolean;
  className: string;
  rows: HardRow[];                       // every word currently on a student's Hard list
  archive: Record<string, ArchivedWord>;
  translations: Record<string, string>;  // also covers archived words no student has any more
}
type T = ReturnType<typeof useTranslation>['classInsights'];

// The list changes whenever a student marks or unmarks a word, so it's
// always reloaded — but the last result shows instantly while that happens.
const lastLoaded = new Map<string, Loaded>();

// Words from built-in collections (homework from "30 Days of Powerful
// Words" etc.) aren't in class_words, so their translation comes from the
// collection data instead.
async function collectionTranslations(): Promise<Map<string, string>> {
  try {
    const words = getAllWords(await loadAllCollections());
    return new Map(words.filter(w => w.translation).map(w => [w.word.toLowerCase(), w.translation]));
  } catch {
    return new Map();
  }
}

const STATUS_MARK: Record<StudentWordStatus, string> = { learned: '✓✓', one: '✓', none: '—', again: '✗' };

// Full-screen, one word at a time, for the classroom projector. No student
// names — the whole class can see it.
function TeachView({ words, translations, t, onTaught, onClose }: {
  words: HardRow[]; translations: Record<string, string>; t: T;
  onTaught: (word: string) => void; onClose: () => void;
}) {
  const [queue] = useState(words);
  const [index, setIndex] = useState(0);
  const [reveal, setReveal] = useState(false);
  const current = queue[index];
  const next = () => { setIndex(i => i + 1); setReveal(false); };
  const taught = () => { if (current) { onTaught(current.word); next(); } };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === ' ') { e.preventDefault(); setReveal(r => !r); }
      else if (e.key === 'Enter') taught();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const translation = current ? (current.translation ?? translations[current.word]) : null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center p-6 select-none" style={{ background: 'var(--background)' }}>
      <button type="button" onClick={onClose} className="absolute top-4 right-5 text-2xl text-[var(--text-muted)]" aria-label={t.close}>✕</button>
      {!current ? (
        <p className="text-4xl font-black text-[var(--text)] text-center">{t.teachDone}</p>
      ) : (
        <>
          <p className="text-lg text-[var(--text-muted)] mb-4">{index + 1} / {queue.length}</p>
          <p className="font-black text-[var(--text)] text-center break-words" style={{ fontSize: 'clamp(3rem, 11vw, 8rem)' }}>{current.word}</p>
          <div className="h-16 mt-4 flex items-center">
            {reveal && translation ? (
              <p className="text-3xl text-[var(--text-muted)] text-center">{translation}</p>
            ) : translation ? (
              <button type="button" onClick={() => setReveal(true)} className="text-base font-semibold text-[var(--primary)]">{t.showTranslation}</button>
            ) : null}
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-2">{studentsLabel(t, current.students.length)}</p>
          <div className="flex gap-4 mt-10">
            <button type="button" onClick={next} className="text-lg font-bold px-6 py-3 rounded-2xl" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
              {t.skipWord} →
            </button>
            <button type="button" onClick={taught} className="text-lg font-bold text-white px-6 py-3 rounded-2xl" style={{ background: 'var(--success)' }}>
              {t.archiveBtn}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ClassHardWordsPage() {
  const { id } = useParams<{ id: string }>();
  const teachParam = useSearchParams().get('teach') === '1';
  const { user } = useAuth();
  const tt = useTranslation();
  const t = tt.classInsights;
  const key = `${user?.id ?? ''}|${id}`;
  const [loaded, setLoaded] = useState<Loaded | null>(() => lastLoaded.get(key) ?? null);
  const [teaching, setTeaching] = useState(teachParam);
  // Taught words live behind the Archive button at the top, not under the list.
  const [showArchive, setShowArchive] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    const done = (l: Loaded) => { lastLoaded.set(key, l); if (!cancelled) setLoaded(l); };
    (async () => {
      const { data: cls } = await supabase.from('classes').select('teacher_id, name').eq('id', id).maybeSingle();
      if (cancelled) return;
      if (!cls || cls.teacher_id !== user.id) { done({ notTeacher: true, className: '', rows: [], archive: {}, translations: {} }); return; }

      const [{ data: hard }, { data: words }, meta] = await Promise.all([
        supabase.from('class_hard_words').select('user_id, word').eq('class_id', id),
        supabase.from('class_words').select('word, translation').eq('class_id', id),
        loadStudentMeta(id),
      ]);
      if (cancelled) return;

      // Approved students only (loadStudentMeta's list), one entry per student per word.
      const byWord = new Map<string, string[]>();
      for (const h of (hard ?? []) as { user_id: string; word: string }[]) {
        if (!meta[h.user_id]) continue;
        const ids = byWord.get(h.word) ?? [];
        if (!ids.includes(h.user_id)) ids.push(h.user_id);
        byWord.set(h.word, ids);
      }
      const archive = await loadArchiveStates(id, byWord);
      if (cancelled) return;

      const classWords = new Map(((words ?? []) as { word: string; translation: string }[]).map(w => [w.word, w.translation]));
      const allWords = new Set([...byWord.keys(), ...archive.keys()]);
      const fallback = [...allWords].some(w => !classWords.get(w)) ? await collectionTranslations() : new Map<string, string>();
      if (cancelled) return;
      const translations: Record<string, string> = {};
      for (const w of allWords) {
        const tr = classWords.get(w) || fallback.get(w.toLowerCase());
        if (tr) translations[w] = tr;
      }

      const rows: HardRow[] = [...byWord.entries()].map(([word, ids]) => ({
        word,
        translation: translations[word] ?? null,
        students: ids
          .map(sid => ({ id: sid, name: meta[sid].name || tt.classesPage.defaultStudentName }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }));
      rows.sort((a, b) => b.students.length - a.students.length || a.word.localeCompare(b.word));
      done({ notTeacher: false, className: cls.name ?? '', rows, archive: Object.fromEntries(archive), translations });
    })();
    return () => { cancelled = true; };
  }, [user, id, key, tt]);

  if (!loaded) {
    return <div className="flex justify-center py-16"><div className="text-4xl animate-bounce">😓</div></div>;
  }
  if (loaded.notTeacher) {
    return <p className="p-8 text-center text-[var(--text-muted)]">{tt.classesPage.onlyTeacherDashboard}</p>;
  }
  const { className, rows, archive, translations } = loaded;

  const update = (archiveNext: Record<string, ArchivedWord>) => {
    const next = { ...loaded, archive: archiveNext };
    lastLoaded.set(key, next);
    setLoaded(next);
  };
  // Shown as taught straight away; put back if the save fails.
  const archive_ = async (word: string) => {
    const before = archive;
    const students = rows.find(r => r.word === word)?.students ?? [];
    update({ ...archive, [word]: {
      taughtAt: new Date().toISOString(),
      state: students.length === 0 ? 'learned' : 'watching',
      perStudent: Object.fromEntries(students.map(s => [s.id, 'none' as const])),
    } });
    if (!(await archiveHardWord(id, word))) { update(before); setFailed(true); }
  };
  const unarchive = async (word: string) => {
    const before = archive;
    const next = { ...archive };
    delete next[word];
    update(next);
    if (!(await unarchiveHardWord(id, word))) { update(before); setFailed(true); }
  };

  const toTeach = rows.filter(r => !archive[r.word] || archive[r.word].state === 'again');
  const archivedWords = Object.keys(archive).filter(w => archive[w].state !== 'again');
  const watching = archivedWords.filter(w => archive[w].state === 'watching');
  const learned = archivedWords.filter(w => archive[w].state === 'learned');
  const nameOf = (word: string, sid: string) => rows.find(r => r.word === word)?.students.find(s => s.id === sid)?.name ?? '';

  const wordLine = (word: string) => (
    <p className="font-bold text-[var(--text)]">
      {word}
      {translations[word] && <span className="font-normal text-[var(--text-muted)]"> — {translations[word]}</span>}
    </p>
  );

  const archivedRow = (word: string) => {
    const a = archive[word];
    const ids = Object.keys(a.perStudent);
    const k = ids.filter(sid => a.perStudent[sid] === 'learned').length;
    return (
      <li key={word} className="px-4 py-3 flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-0.5">
          {wordLine(word)}
          <p className="text-xs text-[var(--text-muted)]">
            {t.taughtOn.replace('{date}', fmtDate(a.taughtAt).slice(0, 5))}
            {ids.length > 0 && ` · ${t.knowNow.replace('{k}', String(k)).replace('{n}', String(ids.length))}`}
          </p>
          {ids.length > 0 && (
            <p className="text-xs text-[var(--text-muted)]">
              {ids.map(sid => `${nameOf(word, sid)} ${STATUS_MARK[a.perStudent[sid]]}`).join(' · ')}
            </p>
          )}
        </div>
        <button type="button" onClick={() => unarchive(word)} className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] shrink-0">
          {t.undoArchive}
        </button>
      </li>
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-[var(--text)]">😓 {showArchive ? t.archiveView : t.hardPageTitle}</h1>
          <p className="text-sm text-[var(--text-muted)] truncate">{className}</p>
        </div>
        {(archivedWords.length > 0 || showArchive) && (
          <button
            type="button"
            onClick={() => setShowArchive(s => !s)}
            className="text-sm font-bold px-4 py-2 rounded-xl shrink-0"
            style={{ background: 'var(--primary-bg)', color: 'var(--primary)', border: '1px solid var(--primary)' }}
          >
            {showArchive ? `← ${t.toTeach} · ${toTeach.length}` : `📦 ${t.archiveView} · ${archivedWords.length}`}
          </button>
        )}
      </div>
      <p className="text-sm text-[var(--text-muted)]">{showArchive ? t.watchingHint : t.hardPageSub}</p>

      {failed && <p className="text-sm" style={{ color: 'var(--danger)' }}>{t.archiveFailed}</p>}

      {!showArchive && toTeach.length === 0 ? (
        <div className="card"><p className="text-sm text-[var(--text-muted)]">{archivedWords.length > 0 ? t.teachDone : t.hardPageEmpty}</p></div>
      ) : !showArchive ? (
        <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">{t.toTeach} · {toTeach.length}</h2>
              {toTeach.length > 0 && (
                <button type="button" onClick={() => setTeaching(true)} className="text-sm font-bold text-white px-4 py-2 rounded-xl" style={{ background: 'var(--primary)' }}>
                  📺 {t.teachMode}
                </button>
              )}
            </div>
            {toTeach.length > 0 && (
              <ul className="card divide-y divide-[var(--border)]" style={{ padding: 0 }}>
                {toTeach.map(r => {
                  const again = archive[r.word]?.state === 'again';
                  const names = again
                    ? r.students.filter(s => archive[r.word].perStudent[s.id] === 'again')
                    : r.students;
                  return (
                    <li key={r.word} className="px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {wordLine(r.word)}
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {again && <span className="font-bold" style={{ color: 'var(--danger)' }}>{t.hardAgain} · </span>}
                          {names.map(s => s.name).join(', ')}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>
                          {studentsLabel(t, names.length)}
                        </span>
                        <button type="button" onClick={() => archive_(r.word)} className="text-xs font-bold" style={{ color: 'var(--success)' }}>
                          {t.archiveBtn}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
      ) : archivedWords.length === 0 ? (
        <div className="card"><p className="text-sm text-[var(--text-muted)]">{t.archiveEmpty}</p></div>
      ) : (
        <>
          {watching.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">{t.watching} · {watching.length}</h2>
              <p className="text-xs text-[var(--text-muted)]">{t.statusLegend}</p>
              <ul className="card divide-y divide-[var(--border)]" style={{ padding: 0 }}>{watching.map(archivedRow)}</ul>
            </section>
          )}

          {learned.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--success)' }}>{t.learned} · {learned.length}</h2>
              <ul className="card divide-y divide-[var(--border)]" style={{ padding: 0 }}>{learned.map(archivedRow)}</ul>
            </section>
          )}
        </>
      )}

      {teaching && (
        <TeachView words={toTeach} translations={translations} t={t} onTaught={archive_} onClose={() => setTeaching(false)} />
      )}
    </div>
  );
}
