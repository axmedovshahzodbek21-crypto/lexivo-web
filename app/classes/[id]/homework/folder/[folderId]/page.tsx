'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface FolderUnit {
  id: string;
  name: string;
  wordCount: number;
  homeworkId: string | null;
  hwModes: string[] | null;
  hwDue: string | null;
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

const MODE_ICON: Record<string, string> = { learn: '📖', flashcard: '🃏', quiz: '🧠', match: '🎯' };

export default function ClassFolderHomeworkPage() {
  const { id: classId, folderId } = useParams<{ id: string; folderId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [folderName, setFolderName] = useState('');
  const [units, setUnits] = useState<FolderUnit[]>([]);
  const [completedModes, setCompletedModes] = useState<Record<string, Set<string>>>({});
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, classId, folderId]);

  async function load() {
    const [folderRes, unitsRes] = await Promise.all([
      supabase.from('teacher_folders').select('id, name').eq('id', folderId).maybeSingle(),
      supabase.from('teacher_units').select('id, name, teacher_unit_words(count)').eq('folder_id', folderId).order('created_at'),
    ]);

    const unitRows = (unitsRes.data ?? []) as any[];
    const unitIds = unitRows.map(u => u.id as string);

    const { data: hwRows } = unitIds.length > 0
      ? await supabase
          .from('class_homework')
          .select('id, unit_id, modes, due_date, student_ids')
          .eq('class_id', classId)
          .in('unit_id', unitIds)
      : { data: [] as any[] };

    const applicable = (hwRows ?? []).filter((h: any) => {
      const sids = h.student_ids as string[] | null;
      return sids === null || sids.includes(user!.id);
    });
    const hwByUnit: Record<string, any> = {};
    for (const h of applicable) hwByUnit[h.unit_id] = h;

    const hwIds = applicable.map((h: any) => h.id as string);
    const modeMap: Record<string, Set<string>> = {};
    if (hwIds.length > 0) {
      const { data: prog } = await supabase
        .from('class_homework_progress').select('homework_id, mode')
        .eq('student_id', user!.id).in('homework_id', hwIds);
      for (const p of (prog ?? [])) {
        if (!modeMap[p.homework_id]) modeMap[p.homework_id] = new Set();
        modeMap[p.homework_id].add(p.mode);
      }
    }

    const built: FolderUnit[] = unitRows.map(u => {
      const hw = hwByUnit[u.id] ?? null;
      const countList = u.teacher_unit_words as any[];
      return {
        id: u.id as string,
        name: u.name as string,
        wordCount: countList?.[0]?.count ?? 0,
        homeworkId: hw?.id ?? null,
        hwModes: hw ? (hw.modes as string[]) : null,
        hwDue: hw?.due_date ?? null,
      };
    });

    setFolderName((folderRes.data as any)?.name ?? 'Folder');
    setUnits(built);
    setCompletedModes(modeMap);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const assignedUnits = units.filter(u => u.homeworkId !== null);
  const doneCount = assignedUnits.filter(u => {
    const modes = u.hwModes ?? [];
    const completed = completedModes[u.homeworkId!] ?? new Set();
    return modes.length > 0 && modes.every(m => completed.has(m));
  }).length;
  const hiddenCount = units.length - assignedUnits.length;
  const visible = showAll ? units : assignedUnits;

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className="p-4 space-y-4">

        <button
          onClick={() => router.push(`/classes/${classId}/homework`)}
          className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          ← Back
        </button>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">📁</span>
            <h1 className="text-lg font-black text-[var(--text)]">{folderName}</h1>
          </div>
          {assignedUnits.length > 0 && (
            <p className="text-xs text-[var(--text-muted)]">{doneCount}/{assignedUnits.length} units done</p>
          )}
        </div>

        {visible.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] px-1 py-8 text-center">No units assigned yet</p>
        )}

        <div className="space-y-2">
          {visible.map(unit => {
            if (!unit.homeworkId) {
              return (
                <div key={unit.id} className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--border)]/50 bg-[var(--surface)]/60">
                  <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] flex items-center justify-center shrink-0 text-lg">🔒</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-muted)] truncate">{unit.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{unit.wordCount} words · Not yet assigned</p>
                  </div>
                </div>
              );
            }

            const modes = unit.hwModes ?? [];
            const completed = completedModes[unit.homeworkId] ?? new Set();
            const allDone = modes.length > 0 && modes.every(m => completed.has(m));
            const due = dueLabel(unit.hwDue);

            return (
              <button
                key={unit.id}
                onClick={() => router.push(`/classes/${classId}/homework/${unit.homeworkId}`)}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                  allDone
                    ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                    : 'bg-[var(--surface)] border-[var(--border)] shadow-sm'
                }`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  allDone ? 'bg-green-100 dark:bg-green-900/50' : 'bg-[var(--primary-bg)]'
                }`}>
                  {allDone ? (
                    <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span className="text-sm font-black text-[var(--primary)]">
                      {completed.size}/{modes.length}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${allDone ? 'text-green-700 dark:text-green-400' : 'text-[var(--text)]'}`}>
                    {unit.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-1">
                      {modes.map(m => (
                        <span key={m} className="text-sm" style={{ opacity: completed.has(m) ? 1 : 0.3 }} title={m}>
                          {MODE_ICON[m] ?? m}
                        </span>
                      ))}
                    </div>
                    {due && (
                      <span className={`text-[10px] font-semibold ${due.overdue ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>
                        {due.text}
                      </span>
                    )}
                  </div>
                </div>
                <svg className="w-4 h-4 text-[var(--text-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>

        {hiddenCount > 0 && (
          <button
            onClick={() => setShowAll(s => !s)}
            className="w-full text-center text-xs font-semibold text-[var(--primary)] py-2"
          >
            {showAll ? 'Show less' : `${hiddenCount} more unit${hiddenCount !== 1 ? 's' : ''} in this folder — Show all`}
          </button>
        )}
      </div>
    </div>
  );
}
