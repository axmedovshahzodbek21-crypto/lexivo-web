'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { AssignedUnitCard, UnassignedUnitCard, isHomeworkDone, type AssignedUnit } from '../../_shared';

interface UnassignedUnit {
  id: string;
  badge: string;
  title: string;
  wordCount: number;
}

export default function ClassFolderHomeworkPage() {
  const { id: classId, folderId } = useParams<{ id: string; folderId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [folderName, setFolderName] = useState('');
  const [className, setClassName] = useState('');
  const [assigned, setAssigned] = useState<AssignedUnit[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedUnit[]>([]);
  const [completedModes, setCompletedModes] = useState<Record<string, Set<string>>>({});
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, classId, folderId]);

  async function load() {
    const [folderRes, unitsRes, classRes] = await Promise.all([
      supabase.from('teacher_folders').select('id, name').eq('id', folderId).maybeSingle(),
      supabase.from('teacher_units').select('id, name, teacher_unit_words(count)').eq('folder_id', folderId).order('created_at'),
      supabase.from('classes').select('name').eq('id', classId).maybeSingle(),
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

    const builtAssigned: AssignedUnit[] = [];
    const builtUnassigned: UnassignedUnit[] = [];
    unitRows.forEach((u, i) => {
      const hw = hwByUnit[u.id] ?? null;
      const countList = u.teacher_unit_words as any[];
      const wordCount = countList?.[0]?.count ?? 0;
      const badge = `Unit ${i + 1}`;
      if (hw) {
        builtAssigned.push({
          hwId: hw.id as string,
          badge,
          title: u.name as string,
          wordCount,
          modes: (hw.modes as string[]) ?? [],
          dueDate: (hw.due_date as string | null) ?? null,
        });
      } else {
        builtUnassigned.push({ id: u.id as string, badge, title: u.name as string, wordCount });
      }
    });

    setFolderName((folderRes.data as any)?.name ?? 'Folder');
    setClassName((classRes.data as any)?.name ?? '');
    setAssigned(builtAssigned);
    setUnassigned(builtUnassigned);
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

  const doneCount = assigned.filter(u =>
    isHomeworkDone(u.modes, completedModes[u.hwId] ?? new Set())
  ).length;
  const progressPct = assigned.length > 0 ? (doneCount / assigned.length) * 100 : 0;

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div
        className="relative px-5 pt-5 pb-8"
        style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 75%, transparent) 100%)',
          boxShadow: '0 8px 32px rgba(79,70,229,0.35)',
        }}
      >
        <BackButton className="mb-4" />

        {className && (
          <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-1">{className}</p>
        )}
        <h1
          className="text-2xl font-black text-white leading-tight mb-1"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
        >
          📁 {folderName}
        </h1>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="flex items-center gap-1 text-xs font-semibold bg-black/25 text-white rounded-full px-3 py-1">
            {assigned.length} unit{assigned.length !== 1 ? 's' : ''} assigned
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold bg-black/25 text-white rounded-full px-3 py-1">
            {doneCount}/{assigned.length} done
          </span>
        </div>

        <div className="h-2 rounded-full bg-white/25 overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {assigned.length === 0 && unassigned.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <div className="text-5xl mb-4">📁</div>
            <p className="font-bold text-[var(--text)] mb-1">No units in this folder yet</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {assigned.map(unit => (
              <AssignedUnitCard key={unit.hwId} classId={classId} unit={unit} completed={completedModes[unit.hwId] ?? new Set()} />
            ))}
            {showAll && unassigned.map(unit => (
              <UnassignedUnitCard key={unit.id} badge={unit.badge} title={unit.title} wordCount={unit.wordCount} />
            ))}
          </div>

          {unassigned.length > 0 && (
            <button
              onClick={() => setShowAll(s => !s)}
              className="text-center text-xs font-semibold text-[var(--primary)] py-2"
            >
              {showAll ? 'Show less' : `${unassigned.length} more unit${unassigned.length !== 1 ? 's' : ''} in this folder — Show all`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
