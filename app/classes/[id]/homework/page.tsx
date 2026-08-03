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

interface AssignedFolder {
  id: string;
  name: string;
  units: FolderUnit[];
  showAll: boolean;
}

interface CWUnit {
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

export default function ClassHomeworkPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isTeacher, setIsTeacher] = useState(false);
  const [folders, setFolders] = useState<AssignedFolder[]>([]);
  const [cwUnits, setCwUnits] = useState<CWUnit[]>([]);
  const [completedModes, setCompletedModes] = useState<Record<string, Set<string>>>({});
  const [totalAssigned, setTotalAssigned] = useState(0);
  const [totalDone, setTotalDone] = useState(0);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, id]);

  async function load() {
    setLoading(true);

    const { data: cls } = await supabase.from('classes').select('teacher_id').eq('id', id).maybeSingle();
    const teacher = cls?.teacher_id === user!.id;
    setIsTeacher(teacher);

    if (teacher) { setLoading(false); return; }

    const userId = user!.id;

    const [assignsRes, cwUnitRes, hwRes] = await Promise.all([
      supabase.from('class_library_assignments').select('id, folder_id, teacher_folders(id, name)').eq('class_id', id),
      supabase.from('class_word_units').select('id, name, class_words(count)').eq('class_id', id).order('created_at'),
      supabase.from('class_homework').select('id, unit_id, class_unit_id, modes, due_date, student_ids').eq('class_id', id),
    ]);

    const assigns = (assignsRes.data ?? []) as any[];
    const cwUnitRows = (cwUnitRes.data ?? []) as any[];
    const allHw = (hwRes.data ?? []) as any[];

    const applicableHw = allHw.filter(h => {
      const sids = h.student_ids as string[] | null;
      return sids === null || sids.includes(userId);
    });

    const hwByLibUnit: Record<string, any> = {};
    const hwByCWUnit: Record<string, any> = {};
    for (const h of applicableHw) {
      if (h.unit_id) hwByLibUnit[h.unit_id] = h;
      if (h.class_unit_id) hwByCWUnit[h.class_unit_id] = h;
    }

    const hwIds = applicableHw.map(h => h.id);
    const modeMap: Record<string, Set<string>> = {};
    if (hwIds.length > 0) {
      const { data: prog } = await supabase
        .from('class_homework_progress').select('homework_id, mode')
        .eq('student_id', userId).in('homework_id', hwIds);
      for (const p of (prog ?? [])) {
        if (!modeMap[p.homework_id]) modeMap[p.homework_id] = new Set();
        modeMap[p.homework_id].add(p.mode);
      }
    }

    // Library folders
    let folderUnitsData: any[] = [];
    if (assigns.length > 0) {
      const folderIds = assigns.map((a: any) => a.teacher_folders.id as string);
      const { data: unitsData } = await supabase
        .from('teacher_units').select('id, folder_id, name, teacher_unit_words(count)')
        .in('folder_id', folderIds).order('created_at');
      folderUnitsData = (unitsData ?? []) as any[];
    }

    const built: AssignedFolder[] = assigns.map((a: any) => {
      const folder = a.teacher_folders;
      const units: FolderUnit[] = folderUnitsData
        .filter(u => u.folder_id === folder.id)
        .map(u => {
          const hw = hwByLibUnit[u.id] ?? null;
          const countList = u.teacher_unit_words as any[];
          return {
            id: u.id as string, name: u.name as string,
            wordCount: countList?.[0]?.count ?? 0,
            homeworkId: hw?.id ?? null,
            hwModes: hw ? (hw.modes as string[]) : null,
            hwDue: hw?.due_date ?? null,
          };
        });
      return { id: folder.id, name: folder.name, units, showAll: false };
    });

    // Class word units (assigned homework only shown)
    const builtCW: CWUnit[] = cwUnitRows.map((u: any) => {
      const hw = hwByCWUnit[u.id] ?? null;
      const countList = u.class_words as any[];
      return {
        id: u.id as string, name: u.name as string,
        wordCount: countList?.[0]?.count ?? 0,
        homeworkId: hw?.id ?? null,
        hwModes: hw ? (hw.modes as string[]) : null,
        hwDue: hw?.due_date ?? null,
      };
    }).filter((u: CWUnit) => u.homeworkId !== null);

    // Totals
    let assigned = 0, done = 0;
    for (const f of built) {
      for (const u of f.units) {
        if (u.homeworkId) {
          assigned++;
          if ((u.hwModes ?? []).every(m => (modeMap[u.homeworkId!] ?? new Set()).has(m))) done++;
        }
      }
    }
    for (const u of builtCW) {
      assigned++;
      if ((u.hwModes ?? []).every(m => (modeMap[u.homeworkId!] ?? new Set()).has(m))) done++;
    }

    setFolders(built);
    setCwUnits(builtCW);
    setCompletedModes(modeMap);
    setTotalAssigned(assigned);
    setTotalDone(done);
    setLoading(false);
  }

  function toggleShowAll(folderId: string) {
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, showAll: !f.showAll } : f));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Teacher redirect
  if (isTeacher) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <span className="text-5xl mb-4">📋</span>
        <p className="text-base font-bold text-[var(--text)] mb-2">Manage Homework from the Dashboard</p>
        <p className="text-sm text-[var(--text-muted)]">
          Go to the class Dashboard → Curriculum tab to assign library units as homework and track per-student progress.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className="p-4 space-y-1">

        {/* Progress bar */}
        {totalAssigned > 0 && (
          <div className="bg-[var(--primary-bg)] border border-[var(--primary)]/30 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-black text-[var(--text)]">My Progress</p>
              <p className="text-sm font-bold text-[var(--primary)]">{totalDone} / {totalAssigned} done</p>
            </div>
            <div className="h-1.5 bg-[var(--primary)]/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--primary)] rounded-full transition-all duration-500"
                style={{ width: `${totalAssigned > 0 ? (totalDone / totalAssigned) * 100 : 0}%` }}
              />
            </div>
            {totalDone === totalAssigned && totalAssigned > 0 && (
              <p className="text-xs font-bold text-[var(--primary)] mt-2">🎉 All done! Great work!</p>
            )}
          </div>
        )}

        {/* Empty */}
        {folders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="text-5xl">📚</span>
            <p className="text-base font-bold text-[var(--text)]">No homework yet</p>
            <p className="text-sm text-[var(--text-muted)]">Your teacher hasn&apos;t assigned any units yet</p>
          </div>
        )}

        {/* Library folders */}
        {folders.map(folder => {
          const hiddenCount = folder.units.filter(u => !u.homeworkId).length;
          const visible = folder.showAll
            ? folder.units
            : folder.units.filter(u => u.homeworkId !== null);

          return (
            <div key={folder.id} className="mb-4">
              {/* Folder header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="text-xs">📁</span>
                <p className="flex-1 text-xs font-bold text-[var(--text-muted)] truncate uppercase tracking-wide">{folder.name}</p>
                {hiddenCount > 0 && (
                  <button
                    onClick={() => toggleShowAll(folder.id)}
                    className="text-[10px] font-semibold text-[var(--primary)] shrink-0"
                  >
                    {folder.showAll ? 'Show less' : `${hiddenCount} hidden — Show all`}
                  </button>
                )}
              </div>

              {/* Units */}
              {visible.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] px-1 pb-2">No units assigned yet</p>
              )}
              <div className="space-y-2">
                {visible.map(unit => {
                  if (!unit.homeworkId) {
                    // Unassigned unit
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

                  // Assigned unit with homework
                  const modes = unit.hwModes ?? [];
                  const completed = completedModes[unit.homeworkId] ?? new Set();
                  const allDone = modes.length > 0 && modes.every(m => completed.has(m));
                  const due = dueLabel(unit.hwDue);

                  return (
                    <button
                      key={unit.id}
                      onClick={() => router.push(`/classes/${id}/homework/${unit.homeworkId}`)}
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
                              <span
                                key={m}
                                className="text-sm"
                                style={{ opacity: completed.has(m) ? 1 : 0.3 }}
                                title={m}
                              >
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
            </div>
          );
        })}

        {/* Class word units section */}
        {cwUnits.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-xs">📝</span>
              <p className="flex-1 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Class Words</p>
            </div>
            <div className="space-y-2">
              {cwUnits.map(unit => {
                const modes = unit.hwModes ?? [];
                const completed = completedModes[unit.homeworkId!] ?? new Set();
                const allDone = modes.length > 0 && modes.every(m => completed.has(m));
                const due = dueLabel(unit.hwDue);
                return (
                  <button
                    key={unit.id}
                    onClick={() => router.push(`/classes/${id}/homework/${unit.homeworkId}`)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                      allDone
                        ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                        : 'bg-[var(--surface)] border-[var(--border)] shadow-sm'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      allDone ? 'bg-green-100 dark:bg-green-900/50' : 'bg-amber-50 dark:bg-amber-950/30'
                    }`}>
                      {allDone ? (
                        <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span className="text-sm font-black text-amber-500">
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
          </div>
        )}

      </div>
    </div>
  );
}
