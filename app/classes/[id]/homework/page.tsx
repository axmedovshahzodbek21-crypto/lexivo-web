'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface Homework {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  due_date: string | null;
  created_at: string;
}

function dueLabel(due: string | null): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (due < today) return { text: `Overdue · ${due}`, overdue: true };
  if (due === today) return { text: 'Due today', overdue: false };
  if (due === tomorrow) return { text: 'Due tomorrow', overdue: false };
  return { text: `Due ${due}`, overdue: false };
}

export default function ClassHomeworkPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [isTeacher, setIsTeacher] = useState(false);
  const [hw, setHw] = useState<Homework[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [completionCounts, setCompletionCounts] = useState<Record<string, number>>({});
  const [memberCount, setMemberCount] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', id).maybeSingle();
      const teacher = cls?.teacher_id === user.id;
      setIsTeacher(teacher);

      const { data: hwData } = await supabase
        .from('class_homework')
        .select('id, class_id, teacher_id, title, due_date, created_at')
        .eq('class_id', id)
        .order('created_at', { ascending: false });
      const homeworks = (hwData ?? []) as Homework[];
      setHw(homeworks);

      if (teacher) {
        const { data: members } = await supabase.from('class_members').select('student_id').eq('class_id', id);
        setMemberCount(members?.length ?? 0);

        if (homeworks.length > 0) {
          const hwIds = homeworks.map(h => h.id);
          const { data: comps } = await supabase
            .from('class_homework_completions').select('homework_id').in('homework_id', hwIds);
          const counts: Record<string, number> = {};
          for (const comp of comps ?? []) {
            counts[comp.homework_id] = (counts[comp.homework_id] ?? 0) + 1;
          }
          setCompletionCounts(counts);
        }
      } else if (homeworks.length > 0) {
        const hwIds = homeworks.map(h => h.id);
        const { data: comps } = await supabase
          .from('class_homework_completions').select('homework_id')
          .eq('student_id', user.id).in('homework_id', hwIds);
        setCompletedIds(new Set((comps ?? []).map(c => c.homework_id)));
      }

      setLoading(false);
    })();
  }, [id, user]);

  const addHomework = async () => {
    if (!title.trim() || !user) return;
    setAdding(true);
    try {
      const { data: newHw } = await supabase.from('class_homework').insert({
        class_id: id, teacher_id: user.id, title: title.trim(),
        ...(dueDate ? { due_date: dueDate } : {}),
      }).select().maybeSingle();
      if (newHw) setHw(prev => [newHw as Homework, ...prev]);
      setTitle(''); setDueDate(''); setShowForm(false);
    } catch (_) {}
    setAdding(false);
  };

  const toggleComplete = async (hwItem: Homework) => {
    if (!user) return;
    const isDone = completedIds.has(hwItem.id);
    setCompletedIds(prev => { const n = new Set(prev); isDone ? n.delete(hwItem.id) : n.add(hwItem.id); return n; });
    try {
      if (isDone) {
        await supabase.from('class_homework_completions').delete().eq('homework_id', hwItem.id).eq('student_id', user.id);
      } else {
        await supabase.from('class_homework_completions').upsert({ homework_id: hwItem.id, student_id: user.id }, { onConflict: 'homework_id,student_id' });
      }
    } catch (_) {
      setCompletedIds(prev => { const n = new Set(prev); isDone ? n.add(hwItem.id) : n.delete(hwItem.id); return n; });
    }
  };

  const deleteHomework = async (hwItem: Homework) => {
    if (!confirm(`Delete "${hwItem.title}"?`)) return;
    const { error } = await supabase.from('class_homework').delete().eq('id', hwItem.id);
    if (!error) setHw(prev => prev.filter(h => h.id !== hwItem.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const doneCount = hw.filter(h => completedIds.has(h.id)).length;

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className="p-4 space-y-4">

        {/* Teacher: add form */}
        {isTeacher && (
          !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-[var(--primary)]/40 text-sm font-bold text-[var(--primary)] hover:bg-[var(--primary-bg)] transition-colors"
            >
              + New Assignment
            </button>
          ) : (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-3">
              <p className="text-sm font-bold text-[var(--text)]">New Assignment</p>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addHomework()}
                placeholder="e.g. Study Unit 5 vocabulary"
                autoFocus
                className="w-full px-3 py-2.5 text-sm rounded-xl bg-[var(--surface-2)] text-[var(--text)] border-none outline-none placeholder:text-[var(--text-muted)]"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--text-muted)] shrink-0">Due date (optional)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="flex-1 px-3 py-1.5 text-sm rounded-xl bg-[var(--surface-2)] text-[var(--text)] border-none outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowForm(false); setTitle(''); setDueDate(''); }}
                  className="flex-1 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addHomework}
                  disabled={adding || !title.trim()}
                  className="flex-1 py-2 text-sm font-bold text-white bg-[var(--primary)] rounded-xl disabled:opacity-50 transition-opacity"
                >
                  {adding ? '…' : 'Add'}
                </button>
              </div>
            </div>
          )
        )}

        {/* Student: progress bar */}
        {!isTeacher && hw.length > 0 && (
          <div className="bg-[var(--primary-bg)] border border-[var(--primary)]/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-black text-[var(--text)]">My Progress</p>
              <p className="text-sm font-bold text-[var(--primary)]">{doneCount} / {hw.length} done</p>
            </div>
            <div className="h-1.5 bg-[var(--primary)]/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--primary)] rounded-full transition-all duration-500"
                style={{ width: `${hw.length > 0 ? (doneCount / hw.length) * 100 : 0}%` }}
              />
            </div>
            {doneCount === hw.length && hw.length > 0 && (
              <p className="text-xs font-bold text-[var(--primary)] mt-2">🎉 All done! Great work!</p>
            )}
          </div>
        )}

        {/* Empty state */}
        {hw.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="text-5xl">📋</span>
            <p className="text-base font-bold text-[var(--text)]">
              {isTeacher ? 'No assignments yet' : 'No homework yet'}
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              {isTeacher ? 'Create an assignment above' : "Your teacher hasn't assigned anything yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {hw.map(hwItem => {
              const isDone = completedIds.has(hwItem.id);
              const due = dueLabel(hwItem.due_date);
              const count = completionCounts[hwItem.id] ?? 0;
              return (
                <div
                  key={hwItem.id}
                  className={`flex items-start gap-3 p-4 rounded-2xl border transition-colors ${
                    isDone && !isTeacher
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                      : 'bg-[var(--surface)] border-[var(--border)]'
                  }`}
                >
                  {!isTeacher ? (
                    <button
                      onClick={() => toggleComplete(hwItem)}
                      className={`w-6 h-6 mt-0.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors text-xs font-bold ${
                        isDone ? 'bg-green-500 border-green-500 text-white' : 'border-[var(--border)] hover:border-[var(--primary)]'
                      }`}
                    >
                      {isDone && '✓'}
                    </button>
                  ) : (
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-[var(--primary-bg)] flex items-center justify-center">
                      <span className="text-base font-black text-[var(--primary)]">{count}</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${
                      isDone && !isTeacher
                        ? 'line-through text-green-600 dark:text-green-400'
                        : 'text-[var(--text)]'
                    }`}>
                      {hwItem.title}
                    </p>
                    {due && (
                      <p className={`text-xs mt-0.5 ${due.overdue ? 'text-red-500 font-bold' : 'text-[var(--text-muted)]'}`}>
                        {due.text}
                      </p>
                    )}
                    {isTeacher && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {memberCount > 0 ? `${count} / ${memberCount} completed` : `${count} completed`}
                      </p>
                    )}
                  </div>

                  {isTeacher && (
                    <button
                      onClick={() => deleteHomework(hwItem)}
                      className="text-[var(--text-muted)] hover:text-red-500 transition-colors shrink-0 mt-0.5 text-sm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
