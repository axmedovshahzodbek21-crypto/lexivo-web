'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { loadCollections, loadCEFRCollection } from '@/lib/data';
import type { WordCollection } from '@/lib/types';

async function fetchCollectionByName(name: string): Promise<WordCollection | null> {
  if (name === '30 Days of Powerful Words') { const c = await loadCollections(); return c[0] ?? null; }
  if (name === '24 Vocabulary Challenge')   { const c = await loadCollections(); return c[1] ?? null; }
  if (name === 'Word Mastery')              { const c = await loadCollections(); return c[2] ?? null; }
  const lvl = ({ A1: 'a1', A2: 'a2', B1: 'b1' } as Record<string, 'a1'|'a2'|'b1'>)[name];
  return lvl ? loadCEFRCollection(lvl) : null;
}

const MODE_ICON: Record<string, string> = { learn: '📖', flashcard: '🃏', quiz: '❓', match: '🎯' };
const MODE_LABEL: Record<string, string> = { learn: 'Learn', flashcard: 'Cards', quiz: 'Quiz', match: 'Match' };
const MODE_COLOR: Record<string, string> = { learn: '#4f46e5', flashcard: '#ea580c', quiz: '#d97706', match: '#db2777' };

function dueLabel(due: string | null): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (due < today) return { text: `Overdue · ${due}`, overdue: true };
  if (due === today) return { text: 'Due today', overdue: false };
  if (due === tomorrow) return { text: 'Due tomorrow', overdue: false };
  return { text: `Due ${due}`, overdue: false };
}

interface AssignedUnit {
  hwId: string;
  dayNumber: number;
  topic: string;
  wordCount: number;
  modes: string[];
  dueDate: string | null;
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

    const built: AssignedUnit[] = applicable
      .map((h: any) => {
        const day = col?.days.find(d => d.dayNumber === h.day_number);
        return {
          hwId: h.id as string,
          dayNumber: h.day_number as number,
          topic: day?.topic ?? `Day ${h.day_number}`,
          wordCount: day?.words.length ?? 0,
          modes: (h.modes as string[]) ?? [],
          dueDate: (h.due_date as string | null) ?? null,
        };
      })
      .sort((a, b) => a.dayNumber - b.dayNumber);

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

function AssignedUnitCard({
  classId, unit, completed,
}: { classId: string; unit: AssignedUnit; completed: Set<string> }) {
  const allDone = unit.modes.length > 0 && unit.modes.every(m => completed.has(m));
  const due = dueLabel(unit.dueDate);
  const nonMatchModes = unit.modes.filter(m => m !== 'match');
  const hasMatch = unit.modes.includes('match');
  const learnAssigned = unit.modes.includes('learn');
  const learnDone = completed.has('learn');
  const gatedByLearn = (mode: string) => mode !== 'learn' && learnAssigned && !learnDone;
  const progressPct = unit.modes.length > 0
    ? (unit.modes.filter(m => completed.has(m)).length / unit.modes.length) * 100
    : 0;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'var(--surface)',
        border: allDone ? '1.5px solid #22c55e' : '1.5px solid var(--border)',
        boxShadow: allDone
          ? '0 0 0 3px rgba(34,197,94,0.1), 0 4px 16px rgba(0,0,0,0.08)'
          : '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      <div
        className="h-1.5"
        style={{ background: allDone ? '#22c55e' : 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 75%, transparent) 100%)' }}
      />

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
              style={{ background: allDone ? '#22c55e' : 'var(--primary)' }}
            >
              Unit {unit.dayNumber}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">{unit.wordCount} words</span>
            {allDone && <span className="text-[10px] font-bold text-green-500">✓ Done</span>}
          </div>
          <h3 className="font-bold text-[var(--text)] text-sm leading-tight truncate">{unit.topic}</h3>
          {due && (
            <p className={`text-xs font-semibold mt-1 ${due.overdue ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>
              {due.overdue ? '⚠️ ' : '📅 '}{due.text}
            </p>
          )}
        </div>

        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: allDone ? '#22c55e' : 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 75%, transparent) 100%)',
            }}
          />
        </div>

        {nonMatchModes.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {nonMatchModes.map(mode => (
              <GridModeButton
                key={mode}
                classId={classId}
                hwId={unit.hwId}
                mode={mode}
                done={completed.has(mode)}
                locked={gatedByLearn(mode)}
              />
            ))}
          </div>
        )}
        {hasMatch && (
          <GridModeButton
            classId={classId}
            hwId={unit.hwId}
            mode="match"
            done={completed.has('match')}
            locked={gatedByLearn('match')}
            wide
          />
        )}
      </div>
    </div>
  );
}

function GridModeButton({
  classId, hwId, mode, done, locked, wide,
}: { classId: string; hwId: string; mode: string; done: boolean; locked?: boolean; wide?: boolean }) {
  const color = MODE_COLOR[mode] ?? 'var(--primary)';
  const icon = MODE_ICON[mode] ?? '📖';
  const label = MODE_LABEL[mode] ?? mode;
  const base = `flex items-center justify-center ${wide ? 'flex-row gap-2 py-2.5 px-4' : 'flex-col gap-1.5 py-3'} rounded-xl text-xs font-bold transition-all`;

  if (locked) {
    return (
      <div
        title="Complete Learn first"
        className={`${base} cursor-not-allowed select-none`}
        style={{ background: 'var(--surface-2)', border: '1.5px dashed var(--border)', opacity: 0.4 }}
      >
        <span className={wide ? 'text-base' : 'text-xl'}>🔒</span>
        <span className="text-[var(--text-muted)]">{label}</span>
      </div>
    );
  }
  if (done) {
    return (
      <Link
        href={`/classes/${classId}/homework/${hwId}?mode=${mode}`}
        className={`${base} active:scale-95`}
        style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.35)', color: '#16a34a' }}
      >
        <span className={wide ? 'text-base' : 'text-xl'}>✓</span>
        <span>{label}</span>
      </Link>
    );
  }
  return (
    <Link
      href={`/classes/${classId}/homework/${hwId}?mode=${mode}`}
      className={`${base} text-white active:scale-95 hover:opacity-90`}
      style={{ background: color, boxShadow: `0 3px 12px ${color}66` }}
    >
      <span className={wide ? 'text-base' : 'text-xl'}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
