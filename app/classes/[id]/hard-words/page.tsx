'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from '@/lib/useTranslation';
import { loadStudentMeta } from '@/lib/class-insights';

// Teacher-only list of every word students in this class marked "Too hard"
// (class_hard_words — rows are removed when a student unmarks a word), so the
// teacher can go over them in class. Read-only by design.

interface HardRow { word: string; translation: string | null; students: string[]; }

export default function ClassHardWordsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const tt = useTranslation();
  const t = tt.classInsights;
  const [loading, setLoading] = useState(true);
  const [notTeacher, setNotTeacher] = useState(false);
  const [className, setClassName] = useState('');
  const [rows, setRows] = useState<HardRow[]>([]);

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    (async () => {
      const { data: cls } = await supabase.from('classes').select('teacher_id, name').eq('id', id).maybeSingle();
      if (cancelled) return;
      if (!cls || cls.teacher_id !== user.id) { setNotTeacher(true); setLoading(false); return; }
      setClassName(cls.name ?? '');

      const [{ data: hard }, { data: words }, meta] = await Promise.all([
        supabase.from('class_hard_words').select('user_id, word').eq('class_id', id),
        supabase.from('class_words').select('word, translation').eq('class_id', id),
        loadStudentMeta(id),
      ]);
      if (cancelled) return;

      const translations = new Map(((words ?? []) as { word: string; translation: string }[]).map(w => [w.word, w.translation]));
      // Approved students only (loadStudentMeta's list), one entry per student per word.
      const byWord = new Map<string, Set<string>>();
      for (const h of (hard ?? []) as { user_id: string; word: string }[]) {
        if (!meta[h.user_id]) continue;
        if (!byWord.has(h.word)) byWord.set(h.word, new Set());
        byWord.get(h.word)!.add(h.user_id);
      }
      const list: HardRow[] = [...byWord.entries()].map(([word, ids]) => ({
        word,
        translation: translations.get(word) ?? null,
        students: [...ids].map(sid => meta[sid].name || tt.classesPage.defaultStudentName).sort((a, b) => a.localeCompare(b)),
      }));
      list.sort((a, b) => b.students.length - a.students.length || a.word.localeCompare(b.word));
      setRows(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, id, tt]);

  if (loading) {
    return <div className="flex justify-center py-16"><div className="text-4xl animate-bounce">😓</div></div>;
  }
  if (notTeacher) {
    return <p className="p-8 text-center text-[var(--text-muted)]">{tt.classesPage.onlyTeacherDashboard}</p>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-[var(--text)]">😓 {t.hardPageTitle}</h1>
        <p className="text-sm text-[var(--text-muted)] truncate">{className}</p>
        <p className="text-sm text-[var(--text-muted)] mt-2">{t.hardPageSub}</p>
      </div>

      {rows.length === 0 ? (
        <div className="card"><p className="text-sm text-[var(--text-muted)]">{t.hardPageEmpty}</p></div>
      ) : (
        <ul className="card divide-y divide-[var(--border)]" style={{ padding: 0 }}>
          {rows.map(r => (
            <li key={r.word} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[var(--text)]">
                  {r.word}
                  {r.translation && <span className="font-normal text-[var(--text-muted)]"> — {r.translation}</span>}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{r.students.join(', ')}</p>
              </div>
              <span
                className="text-xs font-bold px-2 py-1 rounded-lg shrink-0"
                style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}
              >
                {t.studentsCount.replace('{n}', String(r.students.length))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
