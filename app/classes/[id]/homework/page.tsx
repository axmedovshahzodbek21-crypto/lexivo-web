'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { WordCollection } from '@/lib/types';
import { readingPassages } from '@/lib/reading-data';
import { isHomeworkDone, dueLabel, fetchCollectionByName, MODE_ICON } from './_shared';
import { classGradientColors } from '@/lib/class-gradient';

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
}

interface CWUnit {
  id: string;
  name: string;
  wordCount: number;
  homeworkId: string | null;
  hwModes: string[] | null;
  hwDue: string | null;
}

interface CollHW {
  id: string;
  collectionName: string;
  dayNumber: number;
  topic: string;
  wordCount: number;
  hwModes: string[];
  hwDue: string | null;
}

interface PassageHW {
  homeworkId: string;
  title: string;
  topic: string;
  hwModes: string[];
  hwDue: string | null;
}

type CachedHW = {
  isTeacher: boolean;
  folders: AssignedFolder[];
  cwUnits: CWUnit[];
  collHwItems: CollHW[];
  passageItems: PassageHW[];
  completedModes: Record<string, string[]>;
  totalAssigned: number;
  totalDone: number;
};
const _cache: Record<string, CachedHW> = {};

export default function ClassHomeworkPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const cacheKey = user ? `${user.id}:${id}` : null;
  const cached = cacheKey ? (_cache[cacheKey] ?? null) : null;

  const [loading, setLoading] = useState(cached === null);
  const [className, setClassName] = useState('');
  const [, setIsTeacher] = useState(cached?.isTeacher ?? false);
  const [folders, setFolders] = useState<AssignedFolder[]>(cached?.folders ?? []);
  const [cwUnits, setCwUnits] = useState<CWUnit[]>(cached?.cwUnits ?? []);
  const [collHwItems, setCollHwItems] = useState<CollHW[]>(cached?.collHwItems ?? []);
  const [passageItems, setPassageItems] = useState<PassageHW[]>(cached?.passageItems ?? []);
  const [completedModes, setCompletedModes] = useState<Record<string, Set<string>>>(
    cached ? Object.fromEntries(Object.entries(cached.completedModes).map(([k, v]) => [k, new Set(v)])) : {}
  );
  const [totalAssigned, setTotalAssigned] = useState(cached?.totalAssigned ?? 0);
  const [totalDone, setTotalDone] = useState(cached?.totalDone ?? 0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadIdRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, id]);

  async function load() {
    const myLoadId = ++loadIdRef.current;
    setLoadError(null);
    try {
      await loadInner(myLoadId);
    } catch (err) {
      if (loadIdRef.current !== myLoadId) return;
      // folders/cwUnits/etc. are only ever updated below on a full success,
      // so on error they still hold whatever was showing before this call
      // (cached data for a background refresh, or the initial empty state
      // for a true first load) — just stop the spinner rather than clearing
      // anything, and don't let one bad row (e.g. a stale
      // class_library_assignments row whose teacher_folders was deleted)
      // take down the whole tab. A Supabase error used to resolve with
      // { data: null, error } instead of throwing, so it fell through to
      // the same "no homework" empty state as a genuinely-empty class —
      // now surfaced via loadError so the student can tell the difference.
      console.error('homework load error', err);
      setLoadError(err instanceof Error ? err.message : String(err));
    }
    if (loadIdRef.current === myLoadId) setLoading(false);
  }

  async function loadInner(myLoadId: number) {
    const { data: cls, error: clsErr } = await supabase.from('classes').select('name, teacher_id').eq('id', id).maybeSingle();
    if (clsErr) throw clsErr;
    if (loadIdRef.current !== myLoadId) return;
    const teacher = (cls as any)?.teacher_id === user!.id;
    setIsTeacher(teacher);
    setClassName((cls as any)?.name ?? '');

    if (teacher) {
      router.replace(`/classes/${id}?tab=curriculum`);
      return;
    }

    const userId = user!.id;

    const [assignsRes, cwUnitRes, hwRes] = await Promise.all([
      supabase.from('class_library_assignments').select('id, folder_id, teacher_folders(id, name)').eq('class_id', id),
      supabase.from('class_word_units').select('id, name, class_words(count)').eq('class_id', id).order('created_at'),
      supabase.from('class_homework').select('id, unit_id, class_unit_id, collection_name, day_number, passage_id, modes, due_date, student_ids').eq('class_id', id),
    ]);

    if (assignsRes.error || cwUnitRes.error || hwRes.error) throw (assignsRes.error ?? cwUnitRes.error ?? hwRes.error);
    if (loadIdRef.current !== myLoadId) return;

    // teacher_folders is a joined row that can come back null (e.g. the
    // referenced folder was deleted but this assignment row wasn't cleaned
    // up) — skip that one malformed row instead of crashing on it and
    // taking down every other valid assignment with it.
    const assigns = ((assignsRes.data ?? []) as any[]).filter(a => a.teacher_folders != null);
    const cwUnitRows = (cwUnitRes.data ?? []) as any[];
    const allHw = (hwRes.data ?? []) as any[];

    const applicableHw = allHw.filter(h => {
      const sids = h.student_ids as string[] | null;
      return sids === null || sids.includes(userId);
    });

    const hwByLibUnit: Record<string, any> = {};
    const hwByCWUnit: Record<string, any> = {};
    const collHwRows: any[] = [];
    const passageHwRows: any[] = [];
    for (const h of applicableHw) {
      if (h.unit_id) hwByLibUnit[h.unit_id] = h;
      else if (h.class_unit_id) hwByCWUnit[h.class_unit_id] = h;
      else if (h.collection_name) collHwRows.push(h);
      else if (h.passage_id != null) passageHwRows.push(h);
    }

    const hwIds = applicableHw.map(h => h.id);
    const modeMap: Record<string, Set<string>> = {};
    if (hwIds.length > 0) {
      const { data: prog, error: progErr } = await supabase
        .from('class_homework_progress').select('homework_id, mode')
        .eq('student_id', userId).in('homework_id', hwIds);
      if (progErr) throw progErr;
      for (const p of (prog ?? [])) {
        if (!modeMap[p.homework_id]) modeMap[p.homework_id] = new Set();
        modeMap[p.homework_id].add(p.mode);
      }
    }

    // Library folders
    let folderUnitsData: any[] = [];
    if (assigns.length > 0) {
      const folderIds = assigns.map((a: any) => a.teacher_folders.id as string);
      const { data: unitsData, error: unitsErr } = await supabase
        .from('teacher_units').select('id, folder_id, name, teacher_unit_words(count)')
        .in('folder_id', folderIds).order('created_at');
      if (unitsErr) throw unitsErr;
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
      return { id: folder.id, name: folder.name, units };
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

    // Collection HW — look up topic + wordCount from local JSON
    const collItems: CollHW[] = [];
    if (collHwRows.length > 0) {
      const colCache: Record<string, WordCollection | null> = {};
      for (const h of collHwRows) {
        const name = h.collection_name as string;
        const day = h.day_number as number;
        if (!(name in colCache)) colCache[name] = await fetchCollectionByName(name);
        const col = colCache[name];
        const dayData = col?.days.find((d: any) => d.dayNumber === day);
        collItems.push({
          id: h.id,
          collectionName: name,
          dayNumber: day,
          topic: dayData?.topic ?? `Day ${day}`,
          wordCount: dayData?.words.length ?? 0,
          hwModes: (h.modes as string[]) ?? [],
          hwDue: (h.due_date as string | null) ?? null,
        });
      }
    }

    // Reading passages
    const passageBuilt: PassageHW[] = passageHwRows.map((h: any) => {
      const found = readingPassages.find(p => p.id === (h.passage_id as number));
      return {
        homeworkId: h.id,
        title: found?.title ?? 'Reading Passage',
        topic: found?.topic ?? '',
        hwModes: (h.modes as string[]) ?? ['read'],
        hwDue: (h.due_date as string | null) ?? null,
      };
    });

    // Totals
    let assigned = 0, done = 0;
    for (const f of built) {
      for (const u of f.units) {
        if (u.homeworkId) {
          assigned++;
          if (isHomeworkDone(u.hwModes ?? [], modeMap[u.homeworkId!] ?? new Set())) done++;
        }
      }
    }
    for (const u of builtCW) {
      assigned++;
      if (isHomeworkDone(u.hwModes ?? [], modeMap[u.homeworkId!] ?? new Set())) done++;
    }
    for (const h of collItems) {
      assigned++;
      if (isHomeworkDone(h.hwModes, modeMap[h.id] ?? new Set())) done++;
    }
    for (const p of passageBuilt) {
      assigned++;
      if (isHomeworkDone(p.hwModes, modeMap[p.homeworkId] ?? new Set())) done++;
    }

    if (loadIdRef.current !== myLoadId) return;

    if (cacheKey) _cache[cacheKey] = {
      isTeacher: false,
      folders: built,
      cwUnits: builtCW,
      collHwItems: collItems,
      passageItems: passageBuilt,
      completedModes: Object.fromEntries(Object.entries(modeMap).map(([k, v]) => [k, [...v]])),
      totalAssigned: assigned,
      totalDone: done,
    };

    setFolders(built);
    setCwUnits(builtCW);
    setCollHwItems(collItems);
    setPassageItems(passageBuilt);
    setCompletedModes(modeMap);
    setTotalAssigned(assigned);
    setTotalDone(done);
  }

  const collFolders: { name: string; items: CollHW[] }[] = [];
  for (const item of collHwItems) {
    let folder = collFolders.find(f => f.name === item.collectionName);
    if (!folder) {
      folder = { name: item.collectionName, items: [] };
      collFolders.push(folder);
    }
    folder.items.push(item);
  }
  for (const folder of collFolders) folder.items.sort((a, b) => a.dayNumber - b.dayNumber);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { gradient: _grad, glow: _glow } = classGradientColors(id as string);

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div className={`bg-gradient-to-br ${_grad} px-5 pt-5 pb-7 relative`}
        style={{ boxShadow: `0 8px 32px ${_glow}cc` }}>
        <div style={{ position: 'absolute', right: 16, top: 8, fontSize: 80, fontWeight: 900, color: 'rgba(255,255,255,0.06)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>📋</div>
        <button onClick={() => router.push(`/classes/${id}/home`)} className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium mb-4 transition-colors">← Back</button>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ background: 'rgba(255,255,255,0.18)', boxShadow: '0 4px 0 rgba(0,0,0,0.15)' }}>📋</div>
          <div>
            <p className="text-xs font-black text-white/50 uppercase tracking-widest mb-0.5">{className || '...'}</p>
            <h1 className="text-2xl font-black text-white leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>Homework</h1>
            <p className="text-sm text-white/60 mt-1">Assigned folders to review</p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-1">

        {loadError && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-4 flex items-start gap-2.5">
            <span className="text-lg shrink-0">⚠️</span>
            <div>
              <p className="font-bold text-red-700 dark:text-red-400 text-xs">Couldn&apos;t load homework</p>
              <p className="text-red-600 dark:text-red-500 text-[11px] mt-0.5 break-all">{loadError}</p>
            </div>
          </div>
        )}

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
        {folders.length === 0 && cwUnits.length === 0 && collFolders.length === 0 && passageItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="text-5xl">📚</span>
            <p className="text-base font-bold text-[var(--text)]">No homework yet</p>
            <p className="text-sm text-[var(--text-muted)]">Your teacher hasn&apos;t assigned any units yet</p>
          </div>
        )}

        {/* Library folders — shown as folder tiles only; units live on their own page */}
        {folders.length > 0 && (
          <div className="mb-4 space-y-2">
            {folders.map(folder => {
              const assignedUnits = folder.units.filter(u => u.homeworkId !== null);
              const doneCount = assignedUnits.filter(u => {
                return isHomeworkDone(u.hwModes ?? [], completedModes[u.homeworkId!] ?? new Set());
              }).length;
              const allDone = assignedUnits.length > 0 && doneCount === assignedUnits.length;

              return (
                <button
                  key={folder.id}
                  onClick={() => router.push(`/classes/${id}/homework/folder/${folder.id}`)}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                    allDone
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                      : 'bg-[var(--surface)] border-[var(--border)] shadow-sm'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-lg ${
                    allDone ? 'bg-green-100 dark:bg-green-900/50' : 'bg-[var(--primary-bg)]'
                  }`}>
                    {allDone ? (
                      <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : <span>📁</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${allDone ? 'text-green-700 dark:text-green-400' : 'text-[var(--text)]'}`}>
                      {folder.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {assignedUnits.length} unit{assignedUnits.length !== 1 ? 's' : ''} assigned · {doneCount}/{assignedUnits.length} done
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-[var(--text-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </div>
        )}

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
                const allDone = isHomeworkDone(modes, completed);
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

        {/* Reading passages section */}
        {passageItems.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-xs">📚</span>
              <p className="flex-1 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Reading</p>
            </div>
            <div className="space-y-2">
              {passageItems.map(item => {
                const modes = item.hwModes;
                const completed = completedModes[item.homeworkId] ?? new Set();
                const allDone = isHomeworkDone(modes, completed);
                const due = dueLabel(item.hwDue);
                return (
                  <button
                    key={item.homeworkId}
                    onClick={() => router.push(`/classes/${id}/homework/${item.homeworkId}`)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                      allDone
                        ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                        : 'bg-[var(--surface)] border-[var(--border)] shadow-sm'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-lg ${
                      allDone ? 'bg-green-100 dark:bg-green-900/50' : 'bg-amber-50 dark:bg-amber-950/30'
                    }`}>
                      {allDone ? (
                        <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : <span>📚</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${allDone ? 'text-green-700 dark:text-green-400' : 'text-[var(--text)]'}`}>
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-[var(--text-muted)] truncate">{item.topic}</span>
                        {due && (
                          <span className={`text-[10px] font-semibold shrink-0 ${due.overdue ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>
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

        {/* Collections section — grouped into folders, one per collection */}
        {collFolders.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-xs">📗</span>
              <p className="flex-1 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Collections</p>
            </div>
            <div className="space-y-2">
              {collFolders.map(folder => {
                const doneCount = folder.items.filter(item =>
                  isHomeworkDone(item.hwModes, completedModes[item.id] ?? new Set())
                ).length;
                const allDone = doneCount === folder.items.length;
                return (
                  <button
                    key={folder.name}
                    onClick={() => router.push(`/classes/${id}/homework/collection/${encodeURIComponent(folder.name)}`)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                      allDone
                        ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                        : 'bg-[var(--surface)] border-[var(--border)] shadow-sm'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-lg ${
                      allDone ? 'bg-green-100 dark:bg-green-900/50' : 'bg-green-50 dark:bg-green-950/30'
                    }`}>
                      {allDone ? (
                        <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : <span>📗</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${allDone ? 'text-green-700 dark:text-green-400' : 'text-[var(--text)]'}`}>
                        {folder.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {folder.items.length} unit{folder.items.length !== 1 ? 's' : ''} assigned · {doneCount}/{folder.items.length} done
                      </p>
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
