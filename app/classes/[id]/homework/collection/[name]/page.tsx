'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { loadCollections, loadCEFRCollection } from '@/lib/data';
import type { WordCollection } from '@/lib/types';
import { AssignedUnitCard, type AssignedUnit } from '../../_shared';

async function fetchCollectionByName(name: string): Promise<WordCollection | null> {
  if (name === '30 Days of Powerful Words') { const c = await loadCollections(); return c[0] ?? null; }
  if (name === '24 Vocabulary Challenge')   { const c = await loadCollections(); return c[1] ?? null; }
  if (name === 'Word Mastery')              { const c = await loadCollections(); return c[2] ?? null; }
  const lvl = ({ A1: 'a1', A2: 'a2', B1: 'b1' } as Record<string, 'a1'|'a2'|'b1'>)[name];
  return lvl ? loadCEFRCollection(lvl) : null;
}

export default function ClassCollectionHomeworkPage() {
  const { id: classId, name } = useParams<{ id: string; name: string }>();
  const collectionName = decodeURIComponent(name);
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<AssignedUnit[]>([]);
  const [completedModes, setCompletedModes] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, classId, name]);

  async function load() {
    const { data: hwRows } = await supabase
      .from('class_homework')
      .select('id, day_number, modes, due_date, student_ids')
      .eq('class_id', classId)
      .eq('collection_name', collectionName);

    const applicable = (hwRows ?? []).filter((h: any) => {
      const sids = h.student_ids as string[] | null;
      return sids === null || sids.includes(user!.id);
    });

    const col = await fetchCollectionByName(collectionName);

    const sorted = [...applicable].sort((a: any, b: any) => a.day_number - b.day_number);
    const built: AssignedUnit[] = sorted.map((h: any) => {
      const day = col?.days.find(d => d.dayNumber === h.day_number);
      return {
        hwId: h.id as string,
        badge: `Unit ${h.day_number}`,
        title: day?.topic ?? `Day ${h.day_number}`,
        wordCount: day?.words.length ?? 0,
        modes: (h.modes as string[]) ?? [],
        dueDate: (h.due_date as string | null) ?? null,
      };
    });

    const hwIds = built.map(u => u.hwId);
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

  const totalDone = units.filter(u => u.modes.length > 0 && u.modes.every(m => (completedModes[u.hwId] ?? new Set()).has(m))).length;
  const progressPct = units.length > 0 ? (totalDone / units.length) * 100 : 0;

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      <div
        className="relative px-5 pt-5 pb-8"
        style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 75%, transparent) 100%)',
          boxShadow: '0 8px 32px rgba(79,70,229,0.35)',
        }}
      >
        <button
          onClick={() => router.push(`/classes/${classId}/homework`)}
          className="flex items-center gap-1.5 text-sm text-white/80 mb-4 hover:text-white transition-colors"
        >
          ← Back
        </button>

        <h1
          className="text-2xl font-black text-white leading-tight mb-1"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
        >
          {collectionName}
        </h1>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="flex items-center gap-1 text-xs font-semibold bg-black/25 text-white rounded-full px-3 py-1">
            {units.length} unit{units.length !== 1 ? 's' : ''} assigned
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold bg-black/25 text-white rounded-full px-3 py-1">
            {totalDone}/{units.length} done
          </span>
        </div>

        <div className="h-2 rounded-full bg-white/25 overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {units.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <div className="text-5xl mb-4">📗</div>
            <p className="font-bold text-[var(--text)] mb-1">No units assigned yet</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-3 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {units.map(unit => (
            <AssignedUnitCard key={unit.hwId} classId={classId} unit={unit} completed={completedModes[unit.hwId] ?? new Set()} />
          ))}
        </div>
      )}
    </div>
  );
}
