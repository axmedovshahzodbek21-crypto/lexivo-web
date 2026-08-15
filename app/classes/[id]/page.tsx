'use client';
import { PageLoader, SectionLoader } from '@/components/Loader';
import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { loadCollections, loadCEFRCollection } from '@/lib/data';
import type { WordCollection } from '@/lib/types';

interface CollectionMeta {
  collection_name: string;
  label: string;
  total_units: number;
  display_order: number;
  color_hex: string;
  group_name: string;
}

const ACTIVITY_ICON: Record<string, string> = { learn: '📖', flashcard: '🃏', quiz: '🧠' };
const ACTIVITY_LABEL: Record<string, string> = { learn: 'Learn', flashcard: 'Flashcard', quiz: 'Quiz' };

type SortKey = 'lastActive' | 'xp' | 'progress' | 'name';
type FilterKey = 'all' | 'active' | 'inactive';
type Tab = 'students' | 'activity' | 'radar' | 'analytics' | 'srs' | 'curriculum';

interface AnalyticsRow {
  student_id: string;
  total_sessions: number;
  avg_session_seconds: number;
  total_words_learned: number;
  total_gate_attempts: number;
  total_gate_correct_first: number;
  genuine_mastery_pct: number | null;
  speed_flag_sessions: number;
  last_session_at: string | null;
  per_word_data_all: { word: string; outcome: string; seconds_to_mark: number; gate_attempts: number; gate_correct_first: boolean }[][] | null;
}

interface ActiveStudent {
  student_id: string;
  student_name: string;
  avatar_url: string | null;
  activity: string;
  collection_name: string | null;
  day_number: number | null;
  started_at: string;
}

interface ProgressPoint {
  study_date: string;
  words_learned: number;
  sessions_count: number;
  active_students: number;
}

interface HardWord {
  word_id: string;
  word: string;
  translation: string;
  attempts: number;
  correct_count: number;
  accuracy_pct: number;
}

interface Announcement {
  id: string;
  message: string;
  created_at: string;
}

interface StudentRow {
  student_id: string;
  name: string;
  avatar_url: string | null;
  xp: number;
  streak: number;
  last_study_date: string | null;
  total_words: number;
  collection_progress: Record<string, number>;
  total_units_sum: number;
}

interface ClassInfo {
  id: string;
  name: string;
  join_code: string;
  teacher_id: string;
}

interface Note {
  id: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

interface Target {
  id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ActivityRow {
  student_name: string;
  avatar_url: string | null;
  completion_type: string;
  collection_name: string;
  day_number: number;
  completed_at: string;
}

interface SRSRow {
  user_id: string;
  word: string;
  translation: string;
  stage: number;
  next_due: string;
}
interface WordForGrid { word: string; translation: string; }
interface HardWordRaw { user_id: string; word: string; }

interface CurrFolder { id: string; assignmentId: string; name: string; units: CurrUnit[]; }
interface CurrUnit { id: string; name: string; wordCount: number; }
interface CurrWordUnit { id: string; name: string; wordCount: number; }
interface CurrHW { id: string; unitId: string | null; classUnitId: string | null; collectionName: string | null; dayNumber: number | null; source: 'library' | 'class' | 'collection'; unitName: string; modes: string[]; dueDate: string | null; studentIds: string[] | null; progressByMode: Record<string, number>; }

function Avatar({ name, url, size = 38 }: { name: string; url: string | null; size?: number }) {
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.4 }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function lastActiveLabel(date: string | null): string {
  if (!date) return 'Never';
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (date >= today) return 'Today ✅';
  if (date >= yesterday) return 'Yesterday';
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dueDateLabel(due: string | null): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (due < today) return { text: `Overdue · ${new Date(due + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, overdue: true };
  if (due === today) return { text: 'Due today', overdue: false };
  if (due === tomorrow) return { text: 'Due tomorrow', overdue: false };
  return { text: `Due ${new Date(due + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, overdue: false };
}

function isInactive(date: string | null): boolean {
  if (!date) return true;
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  return date < threeDaysAgo;
}

function dayLabel(iso: string): string {
  const date = iso.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (date === today) return 'Today';
  if (date === yesterday) return 'Yesterday';
  return new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

// ── Analytics helpers ──────────────────────────────────────────────────────

function MiniPie({ learned, skipped, hard, size = 48 }: { learned: number; skipped: number; hard: number; size?: number }) {
  const total = learned + skipped + hard;
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--border)' }} />;
  const toAngle = (n: number) => (n / total) * 360;
  const learnedAngle = toAngle(learned);
  const skippedAngle = toAngle(skipped);
  const hardAngle = toAngle(hard);
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: `conic-gradient(#22c55e 0deg ${learnedAngle}deg, #f97316 ${learnedAngle}deg ${learnedAngle + skippedAngle}deg, #ef4444 ${learnedAngle + skippedAngle}deg ${learnedAngle + skippedAngle + hardAngle}deg)`,
      flexShrink: 0,
    }} />
  );
}

function LineChart({ points, width = 300, height = 80 }: { points: { x: number; y: number }[]; width?: number; height?: number }) {
  if (points.length < 2) return <div style={{ width, height, background: 'var(--surface-2)', borderRadius: 8 }} />;
  const maxY = Math.max(...points.map(p => p.y), 1);
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const sx = (i: number) => pad + (i / (points.length - 1)) * w;
  const sy = (y: number) => pad + h - (y / maxY) * h;
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const fillD = `${pathD} L${sx(points.length - 1).toFixed(1)},${(pad + h).toFixed(1)} L${pad},${(pad + h).toFixed(1)} Z`;
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#chartGrad)" />
      <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={sx(i)} cy={sy(p.y)} r="3" fill="var(--primary)" />
      ))}
    </svg>
  );
}

function classMasteryColor(pct: number): string {
  if (pct === 0) return 'var(--border)';
  if (pct < 25) return '#ef4444';
  if (pct < 50) return '#f97316';
  if (pct < 75) return '#eab308';
  if (pct < 90) return '#84cc16';
  return '#22c55e';
}

interface FolderHeatUnit { id: string; name: string; hasHw: boolean; pct: number; }
interface FolderHeatFolder { id: string; name: string; units: FolderHeatUnit[]; }

function AnalyticsTab({
  analyticsData, activeStudents, progressPoints, loading, students, collections, classId, digestText, digestLoading, onDigest,
}: {
  analyticsData: AnalyticsRow[];
  activeStudents: ActiveStudent[];
  progressPoints: ProgressPoint[];
  loading: boolean;
  students: StudentRow[];
  collections: CollectionMeta[];
  classId: string;
  digestText: string;
  digestLoading: boolean;
  onDigest: () => void;
}) {
  const studentName = (id: string) => students.find(s => s.student_id === id)?.name ?? 'Unknown';

  const [folderHeatmap, setFolderHeatmap] = useState<FolderHeatFolder[]>([]);
  useEffect(() => {
    if (!classId || students.length === 0) return;
    (async () => {
      const { data: assigns } = await supabase
        .from('class_library_assignments')
        .select('id, teacher_folders(id, name)')
        .eq('class_id', classId);
      if (!assigns || assigns.length === 0) return;
      const folderIds = (assigns as any[]).map((a: any) => a.teacher_folders.id);
      const { data: unitData } = await supabase
        .from('teacher_units').select('id, folder_id, name')
        .in('folder_id', folderIds).order('position').order('created_at');
      const unitIds = (unitData ?? []).map((u: any) => u.id);
      const { data: hwData } = unitIds.length > 0
        ? await supabase.from('class_homework').select('id, unit_id, modes, student_ids').eq('class_id', classId).in('unit_id', unitIds)
        : { data: [] };
      const hwIds = (hwData ?? []).map((h: any) => h.id);
      const { data: progData } = hwIds.length > 0
        ? await supabase.from('class_homework_progress').select('homework_id, student_id, mode').in('homework_id', hwIds)
        : { data: [] };
      const prog = (progData ?? []) as { homework_id: string; student_id: string; mode: string }[];
      const hwMap = new Map<string, { id: string; modes: string[]; studentIds: string[] | null }>();
      for (const h of (hwData ?? []) as any[]) hwMap.set(h.unit_id, { id: h.id, modes: h.modes, studentIds: h.student_ids });
      setFolderHeatmap((assigns as any[]).map((a: any) => ({
        id: a.teacher_folders.id,
        name: a.teacher_folders.name,
        units: ((unitData ?? []) as any[])
          .filter((u: any) => u.folder_id === a.teacher_folders.id)
          .map((u: any) => {
            const hw = hwMap.get(u.id);
            if (!hw) return { id: u.id, name: u.name, hasHw: false, pct: 0 };
            const assigned = hw.studentIds ?? students.map(s => s.student_id);
            const n = assigned.length;
            if (n === 0) return { id: u.id, name: u.name, hasHw: true, pct: 0 };
            const completed = assigned.filter(sid =>
              hw.modes.every(mode => prog.some(p => p.homework_id === hw.id && p.student_id === sid && p.mode === mode))
            ).length;
            return { id: u.id, name: u.name, hasHw: true, pct: Math.round((completed / n) * 100) };
          }),
      })));
    })();
  }, [classId, students]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex justify-center py-12"><div className="text-4xl animate-bounce">📊</div></div>;

  if (analyticsData.length === 0 && activeStudents.length === 0) {
    return (
      <div className="card text-center py-16 space-y-3">
        <div className="text-5xl">📊</div>
        <p className="font-bold text-[var(--text)]">No session data yet</p>
        <p className="text-sm text-[var(--text-muted)]">Data appears here once students complete learn sessions with Phase 4 active.</p>
      </div>
    );
  }

  // Flatten per-word data from all students
  const allWords: { word: string; seconds: number }[] = [];
  for (const row of analyticsData) {
    for (const session of row.per_word_data_all ?? []) {
      for (const w of session ?? []) {
        if (w.outcome === 'learned') allWords.push({ word: w.word, seconds: w.seconds_to_mark });
      }
    }
  }
  const wordMap: Record<string, number[]> = {};
  for (const { word, seconds } of allWords) {
    if (!wordMap[word]) wordMap[word] = [];
    wordMap[word].push(seconds);
  }
  const wordStats = Object.entries(wordMap)
    .map(([word, times]) => ({ word, avg: times.reduce((s, v) => s + v, 0) / times.length }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10);
  const maxAvg = wordStats[0]?.avg ?? 1;

  // Speed-flagged students
  const speedFlagged = analyticsData.filter(r => r.speed_flag_sessions > 0);

  // Progress chart data
  const chartPoints = progressPoints.map((p, i) => ({ x: i, y: p.words_learned }));

  const ACTIVITY_ICON: Record<string, string> = { learn: '📖', flashcard: '🃏', quiz: '🧠' };

  return (
    <div className="space-y-5">
      {/* Live studying now */}
      <div>
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">
          🟢 Studying now ({activeStudents.length})
        </p>
        {activeStudents.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] px-1">No one studying right now</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeStudents.map(s => (
              <div key={s.student_id} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
                <span className="text-sm font-semibold text-[var(--text)]">{s.student_name}</span>
                <span className="text-xs text-[var(--text-muted)]">{ACTIVITY_ICON[s.activity] ?? '📖'}</span>
                {s.collection_name && <span className="text-[10px] text-[var(--text-muted)]">{s.collection_name} {s.day_number ? `U${s.day_number}` : ''}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Speed flag warnings */}
      {speedFlagged.length > 0 && (
        <div>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">⚡ Speed flags (&gt;10 words/min)</p>
          <div className="space-y-2">
            {speedFlagged.map(r => (
              <div key={r.student_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'color-mix(in srgb, var(--danger) 8%, var(--surface-2))' }}>
                <span className="text-lg">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--text)]">{studentName(r.student_id)}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{r.speed_flag_sessions} flagged session{r.speed_flag_sessions > 1 ? 's' : ''} · possible rushing</p>
                </div>
                {r.genuine_mastery_pct != null && (
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: r.genuine_mastery_pct < 60 ? 'var(--danger)' : 'var(--success)' }}>{r.genuine_mastery_pct}%</p>
                    <p className="text-[9px] text-[var(--text-muted)]">gate accuracy</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress over time */}
      {progressPoints.length > 1 && (
        <div>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">📈 Words learned (last 30 days)</p>
          <div className="card p-3 overflow-hidden">
            <div className="w-full overflow-x-auto">
              <LineChart points={chartPoints} width={Math.max(300, chartPoints.length * 28)} height={88} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-[var(--text-muted)]">{progressPoints[0]?.study_date?.slice(5)}</span>
              <span className="text-[9px] text-[var(--text-muted)] font-semibold">
                Total: {progressPoints.reduce((s, p) => s + p.words_learned, 0)} words
              </span>
              <span className="text-[9px] text-[var(--text-muted)]">{progressPoints[progressPoints.length - 1]?.study_date?.slice(5)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Per-word time bar chart */}
      {wordStats.length > 0 && (
        <div>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">⏱ Slowest words (avg seconds to mark)</p>
          <div className="card p-3 space-y-2">
            {wordStats.map(({ word, avg }) => {
              const pct = (avg / maxAvg) * 100;
              const color = avg > 30 ? 'var(--danger)' : avg > 15 ? '#f97316' : 'var(--success)';
              return (
                <div key={word} className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text)] w-24 truncate shrink-0">{word}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] w-8 text-right shrink-0">{avg.toFixed(0)}s</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-student summary with pie charts */}
      {analyticsData.length > 0 && (
        <div>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">👤 Per-student overview</p>
          <div className="space-y-2">
            {analyticsData.map(r => {
              const wordData = (r.per_word_data_all ?? []).flat();
              const learned = wordData.filter(w => w.outcome === 'learned').length;
              const skipped = wordData.filter(w => w.outcome === 'skipped').length;
              const hard = wordData.filter(w => w.outcome === 'too-hard').length;
              return (
                <div key={r.student_id} className="card flex items-center gap-3 p-3">
                  <MiniPie learned={learned} skipped={skipped} hard={hard} size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--text)] truncate">{studentName(r.student_id)}</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      <span className="text-green-500 font-semibold">{learned}✓</span>
                      {' · '}
                      <span className="text-orange-500">{skipped}⏭</span>
                      {' · '}
                      <span className="text-red-500">{hard}😤</span>
                      {' · '}{r.total_sessions} session{r.total_sessions !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {r.genuine_mastery_pct != null ? (
                      <>
                        <p className="text-sm font-black" style={{ color: r.genuine_mastery_pct >= 80 ? 'var(--success)' : r.genuine_mastery_pct >= 60 ? '#f97316' : 'var(--danger)' }}>
                          {r.genuine_mastery_pct}%
                        </p>
                        <p className="text-[9px] text-[var(--text-muted)]">mastery</p>
                      </>
                    ) : (
                      <p className="text-[10px] text-[var(--text-muted)]">no gate data</p>
                    )}
                    {r.speed_flag_sessions > 0 && <p className="text-[9px] text-[var(--danger)] font-semibold mt-0.5">⚡ {r.speed_flag_sessions} flags</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Library Folder Heatmap */}
      {folderHeatmap.length > 0 && (
        <div>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">📁 Library Homework Completion</p>
          <div className="card p-3 space-y-3">
            <p className="text-[10px] text-[var(--text-muted)]">% of assigned students who completed all modes · dashed = no homework assigned</p>
            {folderHeatmap.map(folder => {
              const hwUnits = folder.units.filter(u => u.hasHw);
              const avgPct = hwUnits.length > 0
                ? Math.round(hwUnits.reduce((s, u) => s + u.pct, 0) / hwUnits.length)
                : null;
              return (
                <div key={folder.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-[var(--text)]">📁 {folder.name}</span>
                    {avgPct !== null
                      ? <span className="text-[9px] font-semibold" style={{ color: classMasteryColor(avgPct) }}>{avgPct}% avg</span>
                      : <span className="text-[9px] text-[var(--text-muted)]">no homework yet</span>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {folder.units.map((unit, i) => (
                      <div
                        key={unit.id}
                        title={unit.hasHw ? `${unit.name}: ${unit.pct}% completed` : `${unit.name}: no homework assigned`}
                        className="flex items-center justify-center text-[8px] font-black"
                        style={{
                          width: 28, height: 28, borderRadius: 5,
                          ...(unit.hasHw
                            ? { background: classMasteryColor(unit.pct), color: 'white', opacity: unit.pct === 0 ? 0.4 : 1 }
                            : { background: 'transparent', color: 'var(--text-muted)', border: '1px dashed var(--border)', opacity: 0.5 }),
                        }}
                      >{i + 1}</div>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-[var(--border)]">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded" style={{ border: '1px dashed var(--border)' }} />
                <span className="text-[9px] text-[var(--text-muted)]">No HW</span>
              </div>
              {[{ color: 'var(--border)', label: '0%' }, { color: '#ef4444', label: '<25%' }, { color: '#eab308', label: '50%' }, { color: '#84cc16', label: '75%' }, { color: '#22c55e', label: '90%+' }].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded" style={{ background: color }} />
                  <span className="text-[9px] text-[var(--text-muted)]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Class Mastery Heatmap */}
      {students.length > 0 && collections.length > 0 && (
        <div>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">🗺 Class Mastery Heatmap</p>
          <div className="card p-3 space-y-3">
            <p className="text-[10px] text-[var(--text-muted)]">% of class that has completed each unit · tap for details</p>
            {collections.map(col => {
              const completionPcts = Array.from({ length: col.total_units }, (_, i) => {
                const unit = i + 1;
                const done = students.filter(s => (s.collection_progress[col.collection_name] ?? 0) >= unit).length;
                return students.length > 0 ? Math.round((done / students.length) * 100) : 0;
              });
              const avgPct = completionPcts.length > 0
                ? Math.round(completionPcts.reduce((s, v) => s + v, 0) / completionPcts.length)
                : 0;
              return (
                <div key={col.collection_name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-[var(--text)]">{col.label}</span>
                    <span className="text-[9px] font-semibold" style={{ color: classMasteryColor(avgPct) }}>{avgPct}% avg</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {completionPcts.map((pct, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-center rounded text-[8px] font-black text-white"
                        style={{
                          width: 28, height: 28,
                          background: classMasteryColor(pct),
                          opacity: pct === 0 ? 0.35 : 1,
                          fontSize: 8,
                        }}
                        title={`Unit ${i + 1}: ${pct}% of class completed`}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {/* Legend */}
            <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-[var(--border)]">
              {[
                { color: 'var(--border)', label: '0%' },
                { color: '#ef4444', label: '<25%' },
                { color: '#eab308', label: '50%' },
                { color: '#84cc16', label: '75%' },
                { color: '#22c55e', label: '90%+' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded" style={{ background: color }} />
                  <span className="text-[9px] text-[var(--text-muted)]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Weekly Digest */}
      <div>
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">🤖 AI Weekly Digest</p>
        <div className="card space-y-3">
          <p className="text-xs text-[var(--text-muted)]">Generate a personalised coaching summary based on this week&apos;s data.</p>
          <button
            onClick={onDigest}
            disabled={digestLoading || analyticsData.length === 0}
            className="w-full btn-primary py-3 disabled:opacity-50"
          >
            {digestLoading ? '✨ Generating…' : '✨ Generate digest'}
          </button>
          {digestText && (
            <div className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap bg-[var(--surface-2)] rounded-xl p-3 animate-fade-in">
              {digestText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const SRS_COLORS = ['#9CA3AF', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981'];
const SRS_LABELS = ['New', '+1d', '+3d', '+7d', '+14d', '✓'];

function SRSTab({
  srsRows, gridWords, hardWordsRaw, srsNames, loading,
}: {
  srsRows: SRSRow[];
  gridWords: WordForGrid[];
  hardWordsRaw: HardWordRaw[];
  srsNames: Record<string, string>;
  loading: boolean;
}) {
  if (loading) return <div className="flex justify-center py-12"><div className="text-4xl animate-bounce">📚</div></div>;

  const today = new Date().toISOString().slice(0, 10);
  const studentIds = [...new Set(srsRows.map(r => r.user_id))];

  const wordStageMap = new Map<string, Map<string, number>>();
  for (const r of srsRows) {
    if (!wordStageMap.has(r.word)) wordStageMap.set(r.word, new Map());
    wordStageMap.get(r.word)!.set(r.user_id, r.stage);
  }

  const hardCounts = new Map<string, number>();
  for (const h of hardWordsRaw) hardCounts.set(h.word, (hardCounts.get(h.word) ?? 0) + 1);
  const hardSorted = [...hardCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="space-y-5">
      {/* Per-student overview */}
      <section>
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">Student SRS Overview</p>
        {studentIds.length === 0 ? (
          <div className="card text-center py-10 space-y-2">
            <p className="text-4xl">📚</p>
            <p className="text-sm text-[var(--text-muted)]">No SRS data yet — students need to study class words first.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {studentIds.map(uid => {
              const entries = srsRows.filter(r => r.user_id === uid);
              const dueToday = entries.filter(r => r.next_due <= today && r.stage < 5).length;
              const overdue = entries.filter(r => r.next_due < today && r.stage < 5).length;
              const stageCounts = Array.from({ length: 6 }, (_, s) => entries.filter(r => r.stage === s).length);
              const total = entries.length;
              return (
                <div key={uid} className="card space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-[var(--text)]">{srsNames[uid] ?? uid.slice(0, 8)}</p>
                    <div className="flex items-center gap-3 text-xs">
                      {dueToday > 0 && <span style={{ color: '#F59E0B' }} className="font-bold">{dueToday} due</span>}
                      {overdue > 0 && <span className="text-[var(--danger)] font-bold">{overdue} overdue</span>}
                      <span className="text-[var(--text-muted)]">{total} words</span>
                    </div>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden">
                    {stageCounts.map((count, s) =>
                      count > 0 ? (
                        <div key={s} title={`Stage ${s}: ${count}`} style={{ flex: count, background: SRS_COLORS[s] }} />
                      ) : null
                    )}
                    {total === 0 && <div className="flex-1 rounded-full" style={{ background: 'var(--surface-2)' }} />}
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {stageCounts.map((count, s) => count > 0 ? (
                      <span key={s} className="text-[10px]" style={{ color: SRS_COLORS[s] }}>{SRS_LABELS[s]}: {count}</span>
                    ) : null)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Word Mastery Grid */}
      {gridWords.length > 0 && studentIds.length > 0 && (
        <section>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">Word Mastery Grid</p>
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 text-left px-3 py-2 font-semibold border-b border-r text-[var(--text-muted)]" style={{ background: 'var(--surface)', borderColor: 'var(--border)', minWidth: 130 }}>Word</th>
                    {studentIds.map(uid => (
                      <th key={uid} className="px-2 py-2 text-center font-medium text-[var(--text-muted)] border-b" style={{ borderColor: 'var(--border)', minWidth: 64 }}>
                        <span className="block truncate max-w-[72px]">{srsNames[uid] ?? uid.slice(0, 6)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gridWords.map((w, i) => {
                    const byUser = wordStageMap.get(w.word) ?? new Map<string, number>();
                    const rowBg = i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)';
                    return (
                      <tr key={w.word}>
                        <td className="sticky left-0 z-10 px-3 py-1.5 border-r font-medium text-[var(--text)]" style={{ background: rowBg, borderColor: 'var(--border)' }}>
                          <span className="block">{w.word}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">{w.translation}</span>
                        </td>
                        {studentIds.map(uid => {
                          const stage = byUser.get(uid);
                          return (
                            <td key={uid} className="px-1 py-1 text-center" style={{ background: rowBg }}>
                              <div
                                className="mx-auto w-8 h-7 rounded-md flex items-center justify-center text-[9px] font-bold"
                                title={stage !== undefined ? SRS_LABELS[stage] : 'Not studied'}
                                style={stage !== undefined
                                  ? { background: SRS_COLORS[stage], color: 'white' }
                                  : { border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                              >
                                {stage !== undefined ? SRS_LABELS[stage] : '–'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 border-t flex flex-wrap gap-3" style={{ borderColor: 'var(--border)' }}>
              {SRS_COLORS.map((c, s) => (
                <span key={s} className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ background: c }} />{SRS_LABELS[s]}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Class Hard Words */}
      {hardSorted.length > 0 && (
        <section>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">Class Hard Words</p>
          <div className="space-y-2">
            {hardSorted.map(([word, count], i) => {
              const info = gridWords.find(w => w.word === word);
              const maxCount = hardSorted[0][1];
              return (
                <div key={word} className="card flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-black" style={{ background: 'color-mix(in srgb, var(--danger) 15%, transparent)', color: 'var(--danger)' }}>
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="font-bold text-sm text-[var(--text)]">{word}</span>
                      {info && <span className="text-xs text-[var(--primary)]">{info.translation}</span>}
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full" style={{ width: `${(count / maxCount) * 100}%`, background: 'var(--danger)' }} />
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{count} student{count !== 1 ? 's' : ''} got this wrong</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

const HW_MODE_ICON: Record<string, string> = { learn: '📖', flashcard: '🃏', quiz: '🧠', match: '🎯' };
const HW_MODE_LABEL: Record<string, string> = { learn: 'Learn', flashcard: 'Cards', quiz: 'Quiz', match: 'Match' };
const HW_MODE_COLOR: Record<string, string> = { learn: '#3B82F6', flashcard: '#8B5CF6', quiz: '#EC4899', match: '#10B981' };
const REQUIRED_MODES = ['learn', 'flashcard', 'quiz'];
const OPTIONAL_MODES = ['match'];

const COLLECTION_META = [
  { name: '30 Days of Powerful Words', emoji: '🔥', totalDays: 30 },
  { name: '24 Vocabulary Challenge',   emoji: '⚡', totalDays: 24 },
  { name: 'Word Mastery',              emoji: '🏆', totalDays: 32 },
  { name: 'A1',                        emoji: '🟢', totalDays: 23 },
  { name: 'A2',                        emoji: '🔵', totalDays: 30 },
  { name: 'B1',                        emoji: '🟡', totalDays: 26 },
];

async function fetchCollectionByName(name: string): Promise<WordCollection | null> {
  if (name === '30 Days of Powerful Words') { const c = await loadCollections(); return c[0] ?? null; }
  if (name === '24 Vocabulary Challenge')   { const c = await loadCollections(); return c[1] ?? null; }
  if (name === 'Word Mastery')              { const c = await loadCollections(); return c[2] ?? null; }
  const lvl = ({ A1: 'a1', A2: 'a2', B1: 'b1' } as Record<string, 'a1'|'a2'|'b1'>)[name];
  return lvl ? loadCEFRCollection(lvl) : null;
}

function CurriculumTab({
  classId,
  students,
}: {
  classId: string;
  students: { studentId: string; name: string }[];
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<CurrFolder[]>([]);
  const [cwUnits, setCwUnits] = useState<CurrWordUnit[]>([]);
  const [homework, setHomework] = useState<CurrHW[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedCW, setExpandedCW] = useState<Set<string>>(new Set());

  // Folder picker modal
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [availFolders, setAvailFolders] = useState<{ id: string; name: string; unitCount: number }[]>([]);
  const [folderPickerLoading, setFolderPickerLoading] = useState(false);

  // Class word unit modals
  const [cwUnitCreating, setCwUnitCreating] = useState(false);
  const [cwUnitNewName, setCwUnitNewName] = useState('');
  const [cwUnitRenaming, setCwUnitRenaming] = useState<CurrWordUnit | null>(null);
  const [cwUnitRenameName, setCwUnitRenameName] = useState('');
  const [cwWordsMgr, setCwWordsMgr] = useState<CurrWordUnit | null>(null);
  const [cwWordsAll, setCwWordsAll] = useState<{ id: string; word: string; translation: string; unitId: string | null }[]>([]);
  const [cwWordsPending, setCwWordsPending] = useState<Record<string, boolean>>({});
  const [cwWordsSaving, setCwWordsSaving] = useState(false);

  // Assign homework modal — supports library units, class word units, and collections
  const [hwUnit, setHwUnit] = useState<{ id: string; name: string; isClassWords?: boolean } | null>(null);
  const [hwModes, setHwModes] = useState<Set<string>>(new Set(['learn', 'flashcard', 'quiz']));
  const [hwDueDate, setHwDueDate] = useState('');
  const [hwWho, setHwWho] = useState<'class' | 'specific'>('class');
  const [hwStudentIds, setHwStudentIds] = useState<Set<string>>(new Set());
  const [hwSaving, setHwSaving] = useState(false);
  const [hwCollectionName, setHwCollectionName] = useState<string | null>(null);
  const [hwDayNumber, setHwDayNumber] = useState<number | null>(null);

  // Collection picker
  const [collOpenStates, setCollOpenStates] = useState<Record<string, boolean>>({});
  const [collPickerOpen, setCollPickerOpen] = useState(false);
  const [collPickerStep, setCollPickerStep] = useState<1 | 2>(1);
  const [collPickerCollName, setCollPickerCollName] = useState('');
  const [collPickerDays, setCollPickerDays] = useState<{ dayNumber: number; topic: string; wordCount: number }[]>([]);
  const [collPickerLoading, setCollPickerLoading] = useState(false);

  // Homework detail modal
  const [hwDetail, setHwDetail] = useState<CurrHW | null>(null);
  const [detailProgress, setDetailProgress] = useState<{ studentId: string; name: string; modes: Set<string> }[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [hwDeleting, setHwDeleting] = useState(false);

  const loadCurriculum = async () => {
    setLoading(true);
    const [assignsRes, cwUnitRes] = await Promise.all([
      supabase.from('class_library_assignments').select('id, folder_id, teacher_folders(id, name)').eq('class_id', classId),
      supabase.from('class_word_units').select('id, name, class_words(count)').eq('class_id', classId).order('created_at'),
    ]);

    const assigns = (assignsRes.data ?? []) as any[];
    const cwUnitRows = (cwUnitRes.data ?? []) as any[];

    // Library folders
    let parsedFolders: CurrFolder[] = [];
    if (assigns.length > 0) {
      const folderIds = assigns.map((a: any) => a.teacher_folders.id);
      const { data: unitData } = await supabase
        .from('teacher_units').select('id, folder_id, name, teacher_unit_words(count)')
        .in('folder_id', folderIds).order('position').order('created_at');
      parsedFolders = assigns.map((a: any) => ({
        id: a.teacher_folders.id, assignmentId: a.id, name: a.teacher_folders.name,
        units: (unitData ?? [])
          .filter((u: any) => u.folder_id === a.teacher_folders.id)
          .map((u: any) => ({ id: u.id, name: u.name, wordCount: u.teacher_unit_words?.[0]?.count ?? 0 })),
      }));
    }

    const parsedCW: CurrWordUnit[] = cwUnitRows.map((u: any) => ({
      id: u.id, name: u.name, wordCount: u.class_words?.[0]?.count ?? 0,
    }));

    // Homework
    const { data: hwData } = await supabase
      .from('class_homework')
      .select('id, unit_id, class_unit_id, collection_name, day_number, modes, due_date, student_ids, teacher_units(name), class_word_units(name)')
      .eq('class_id', classId).order('created_at', { ascending: false });

    let parsedHw: CurrHW[] = [];
    if (hwData && hwData.length > 0) {
      const hwIds = (hwData as any[]).map(h => h.id);
      const { data: progData } = await supabase
        .from('class_homework_progress').select('homework_id, student_id, mode').in('homework_id', hwIds);
      parsedHw = (hwData as any[]).map(h => {
        const rows = (progData ?? []).filter((p: any) => p.homework_id === h.id);
        const progressByMode: Record<string, number> = {};
        for (const mode of (h.modes ?? [])) {
          progressByMode[mode] = new Set(rows.filter((p: any) => p.mode === mode).map((p: any) => p.student_id)).size;
        }
        const collName = h.collection_name as string | null;
        const dayNum = h.day_number as number | null;
        const isCollection = collName != null;
        const isClass = h.class_unit_id != null;
        const source: CurrHW['source'] = isCollection ? 'collection' : isClass ? 'class' : 'library';
        const unitName = isCollection
          ? `${collName} · Day ${dayNum}`
          : isClass ? (h.class_word_units?.name ?? 'Unit') : (h.teacher_units?.name ?? 'Unit');
        return {
          id: h.id, unitId: h.unit_id ?? null, classUnitId: h.class_unit_id ?? null,
          collectionName: collName, dayNumber: dayNum,
          source, unitName,
          modes: h.modes ?? [], dueDate: h.due_date, studentIds: h.student_ids, progressByMode,
        };
      });
    }

    setFolders(parsedFolders);
    setCwUnits(parsedCW);
    setHomework(parsedHw);
    setLoading(false);
  };

  useEffect(() => { loadCurriculum(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openFolderPicker = async () => {
    if (!user) return;
    setShowFolderPicker(true);
    setFolderPickerLoading(true);
    const assignedIds = new Set(folders.map(f => f.id));
    const { data } = await supabase.from('teacher_folders').select('id, name, teacher_units(count)').eq('teacher_id', user.id).order('position');
    setAvailFolders(
      ((data ?? []) as any[])
        .filter(f => !assignedIds.has(f.id))
        .map(f => ({ id: f.id, name: f.name, unitCount: f.teacher_units?.[0]?.count ?? 0 }))
    );
    setFolderPickerLoading(false);
  };

  const assignFolder = async (folderId: string) => {
    await supabase.from('class_library_assignments').insert({ class_id: classId, folder_id: folderId });
    setShowFolderPicker(false);
    await loadCurriculum();
  };

  const unassignFolder = async (assignmentId: string) => {
    if (!confirm('Remove this folder from the class? Students will lose access to its units.')) return;
    await supabase.from('class_library_assignments').delete().eq('id', assignmentId);
    await loadCurriculum();
  };

  const openHwModal = (unit: { id: string; name: string; isClassWords?: boolean }) => {
    setHwUnit(unit);
    setHwModes(new Set(['learn', 'flashcard', 'quiz']));
    setHwDueDate('');
    setHwWho('class');
    setHwStudentIds(new Set());
  };

  const closeHwModal = () => {
    setHwUnit(null);
    setHwCollectionName(null);
    setHwDayNumber(null);
  };

  const saveHomework = async () => {
    if (!user || (!hwUnit && !hwCollectionName)) return;
    setHwSaving(true);
    const { error } = await supabase.from('class_homework').insert({
      class_id: classId,
      ...(hwCollectionName
        ? { collection_name: hwCollectionName, day_number: hwDayNumber }
        : hwUnit!.isClassWords ? { class_unit_id: hwUnit!.id } : { unit_id: hwUnit!.id }),
      modes: [...hwModes],
      due_date: hwDueDate || null,
      student_ids: hwWho === 'class' ? null : [...hwStudentIds],
    });
    if (error) { console.error('[saveHomework]', error); alert(`Failed to save: ${error.message}`); setHwSaving(false); return; }
    closeHwModal();
    setHwSaving(false);
    await loadCurriculum();
  };

  const pickCollection = async (name: string) => {
    setCollPickerCollName(name);
    setCollPickerStep(2);
    setCollPickerLoading(true);
    const col = await fetchCollectionByName(name);
    setCollPickerDays((col?.days ?? []).map(d => ({ dayNumber: d.dayNumber, topic: d.topic, wordCount: d.words.length })));
    setCollPickerLoading(false);
  };

  const pickCollectionDay = (dayNumber: number, topic: string) => {
    setCollPickerOpen(false);
    setCollPickerStep(1);
    setHwCollectionName(collPickerCollName);
    setHwDayNumber(dayNumber);
    openHwModal({ id: 'collection', name: `${collPickerCollName} · Day ${dayNumber}: ${topic}` });
  };

  const createCWUnit = async () => {
    if (!user || !cwUnitNewName.trim()) return;
    await supabase.from('class_word_units').insert({ class_id: classId, teacher_id: user.id, name: cwUnitNewName.trim() });
    setCwUnitCreating(false);
    setCwUnitNewName('');
    await loadCurriculum();
  };

  const renameCWUnit = async () => {
    if (!cwUnitRenaming || !cwUnitRenameName.trim()) return;
    await supabase.from('class_word_units').update({ name: cwUnitRenameName.trim() }).eq('id', cwUnitRenaming.id);
    setCwUnitRenaming(null);
    await loadCurriculum();
  };

  const deleteCWUnit = async (unit: CurrWordUnit) => {
    if (!confirm(`Delete unit "${unit.name}"? Words will remain but lose their unit assignment.`)) return;
    await supabase.from('class_word_units').delete().eq('id', unit.id);
    await loadCurriculum();
  };

  const openManageWords = async (unit: CurrWordUnit) => {
    const { data } = await supabase.from('class_words').select('id, word, translation, unit_id').eq('class_id', classId).order('created_at');
    const words = (data ?? []) as any[];
    const pending: Record<string, boolean> = {};
    for (const w of words) pending[w.id] = w.unit_id === unit.id;
    setCwWordsAll(words);
    setCwWordsPending(pending);
    setCwWordsMgr(unit);
  };

  const saveManageWords = async () => {
    if (!cwWordsMgr) return;
    setCwWordsSaving(true);
    for (const w of cwWordsAll) {
      const shouldBe = cwWordsPending[w.id] ?? false;
      const isMember = w.unitId === cwWordsMgr.id;
      if (shouldBe && !isMember) await supabase.from('class_words').update({ unit_id: cwWordsMgr.id }).eq('id', w.id);
      else if (!shouldBe && isMember) await supabase.from('class_words').update({ unit_id: null }).eq('id', w.id);
    }
    setCwWordsSaving(false);
    setCwWordsMgr(null);
    await loadCurriculum();
  };

  const openHwDetail = async (hw: CurrHW) => {
    setHwDetail(hw);
    setDetailLoading(true);
    const { data } = await supabase.from('class_homework_progress').select('student_id, mode').eq('homework_id', hw.id);
    const byStudent: Record<string, Set<string>> = {};
    for (const p of (data ?? []) as any[]) {
      if (!byStudent[p.student_id]) byStudent[p.student_id] = new Set();
      byStudent[p.student_id].add(p.mode);
    }
    const targetStudents = hw.studentIds ? students.filter(s => hw.studentIds!.includes(s.studentId)) : students;
    setDetailProgress(targetStudents.map(s => ({ studentId: s.studentId, name: s.name, modes: byStudent[s.studentId] ?? new Set() })));
    setDetailLoading(false);
  };

  const deleteHomework = async () => {
    if (!hwDetail || !confirm('Delete this homework assignment?')) return;
    setHwDeleting(true);
    await supabase.from('class_homework').delete().eq('id', hwDetail.id);
    setHwDetail(null);
    setHwDeleting(false);
    await loadCurriculum();
  };

  const totalStudentsForHw = (hw: CurrHW) => hw.studentIds ? hw.studentIds.length : students.length;

  if (loading) return <div className="flex justify-center py-12"><div className="text-4xl animate-bounce">📋</div></div>;

  return (
    <div className="space-y-6">
      {/* ── Library ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">📚 Library</p>
          <button onClick={openFolderPicker} className="text-xs font-semibold text-[var(--primary)] hover:opacity-70 transition-opacity">+ Assign Folder</button>
        </div>

        {folders.length === 0 ? (
          <div className="card text-center py-12 space-y-3">
            <div className="text-4xl">📚</div>
            <p className="font-bold text-[var(--text)]">No folders assigned</p>
            <p className="text-sm text-[var(--text-muted)]">Assign a folder from your library to give students access to its units.</p>
            <button onClick={openFolderPicker} className="btn-primary">+ Assign Folder</button>
          </div>
        ) : (
          <div className="space-y-3">
            {folders.map((folder, fi) => {
              const isOpen = expanded.has(folder.id);
              const FOLDER_COLORS = [
                { gradient: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', edge: '#3730A3', glow: 'rgba(79,70,229,0.3)' },
                { gradient: 'linear-gradient(135deg, #0891B2 0%, #0EA5E9 100%)', edge: '#0E7490', glow: 'rgba(8,145,178,0.3)' },
                { gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', edge: '#B45309', glow: 'rgba(217,119,6,0.3)' },
                { gradient: 'linear-gradient(135deg, #DC2626 0%, #F87171 100%)', edge: '#B91C1C', glow: 'rgba(220,38,38,0.3)' },
                { gradient: 'linear-gradient(135deg, #059669 0%, #34D399 100%)', edge: '#047857', glow: 'rgba(5,150,105,0.3)' },
              ];
              const colors = FOLDER_COLORS[fi % FOLDER_COLORS.length];
              return (
                <div key={folder.id} style={{ borderRadius: 20, overflow: 'hidden', boxShadow: `0 6px 0 ${colors.edge}, 0 10px 30px ${colors.glow}` }}>
                  <button
                    className="w-full flex items-center gap-3 text-left px-4 py-4 transition-opacity hover:opacity-90"
                    style={{ background: colors.gradient }}
                    onClick={() => setExpanded(prev => { const next = new Set(prev); if (isOpen) { next.delete(folder.id); } else { next.add(folder.id); } return next; })}
                  >
                    <span className="text-2xl shrink-0" style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.3))' }}>📁</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm truncate" style={{ color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.35)' }}>{folder.name}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{folder.units.length} unit{folder.units.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); unassignFolder(folder.assignmentId); }}
                      className="text-xs px-2 py-1 rounded-lg transition-colors shrink-0 mr-1"
                      style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.15)' }}
                    >Remove</button>
                    <span className="shrink-0 text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="space-y-1 p-2" style={{ background: 'var(--surface)' }}>
                      {folder.units.length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)] text-center py-4">No units in this folder</p>
                      ) : folder.units.map(unit => {
                        const hw = homework.find(h => h.source === 'library' && h.unitId === unit.id);
                        return (
                          <div key={unit.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[var(--text)] truncate">{unit.name}</p>
                              <p className="text-xs text-[var(--text-muted)]">{unit.wordCount} words</p>
                            </div>
                            {hw ? (
                              <button onClick={() => openHwDetail(hw)} className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 transition-colors">✓ Assigned</button>
                            ) : (
                              <button onClick={() => openHwModal(unit)} className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-[var(--primary-bg)] text-[var(--primary)] hover:opacity-80 transition-opacity">+ Assign</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Class Words ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">📝 Class Words</p>
          <button onClick={() => { setCwUnitNewName(''); setCwUnitCreating(true); }} className="text-xs font-semibold text-amber-500 hover:opacity-70 transition-opacity">+ New Unit</button>
        </div>

        {cwUnits.length === 0 ? (
          <div className="card text-center py-10 space-y-2">
            <div className="text-4xl">📝</div>
            <p className="font-bold text-[var(--text)]">No units yet</p>
            <p className="text-sm text-[var(--text-muted)]">Create a unit to organise class words into homework groups.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cwUnits.map(unit => {
              const isOpen = expandedCW.has(unit.id);
              const hw = homework.find(h => h.source === 'class' && h.classUnitId === unit.id);
              return (
                <div key={unit.id} style={{ borderRadius: 20, overflow: 'hidden', boxShadow: '0 6px 0 #B45309, 0 10px 30px rgba(217,119,6,0.3)' }}>
                  <button
                    className="w-full flex items-center gap-3 text-left px-4 py-4 transition-opacity hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)' }}
                    onClick={() => setExpandedCW(prev => { const next = new Set(prev); if (isOpen) { next.delete(unit.id); } else { next.add(unit.id); } return next; })}
                  >
                    <span className="text-2xl shrink-0" style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.3))' }}>📝</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm truncate" style={{ color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.35)' }}>{unit.name}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{unit.wordCount} word{unit.wordCount !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={e => { e.stopPropagation(); setCwUnitRenameName(unit.name); setCwUnitRenaming(unit); }} className="text-xs px-2 py-1 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.15)' }}>Rename</button>
                      <button onClick={e => { e.stopPropagation(); deleteCWUnit(unit); }} className="text-xs px-2 py-1 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.15)' }}>Delete</button>
                      <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.8)' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="flex gap-2 p-3" style={{ background: 'var(--surface)' }}>
                      <button onClick={() => openManageWords(unit)} className="flex-1 text-sm font-semibold py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">✏️ Manage Words</button>
                      {hw ? (
                        <button onClick={() => openHwDetail(hw)} className="flex-1 text-sm font-semibold py-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 transition-colors">📋 View Progress</button>
                      ) : (
                        <button onClick={() => openHwModal({ ...unit, isClassWords: true })} className="flex-1 text-sm font-semibold py-2 rounded-xl bg-[var(--primary-bg)] text-[var(--primary)] hover:opacity-80 transition-opacity">+ Assign HW</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Collections ── */}
      {(() => {
        const collHw = homework.filter(h => h.source === 'collection');
        const groups: Record<string, typeof homework> = {};
        for (const h of collHw) { const n = h.collectionName!; if (!groups[n]) groups[n] = []; groups[n].push(h); }
        const groupEntries = Object.entries(groups);
        return (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">📗 Collections</p>
              <button onClick={() => { setCollPickerOpen(true); setCollPickerStep(1); }} className="text-xs font-semibold text-green-600 dark:text-green-400 hover:opacity-70 transition-opacity">+ Assign Day</button>
            </div>
            {groupEntries.length === 0 ? (
              <div className="card text-center py-8 space-y-2">
                <div className="text-3xl">📗</div>
                <p className="text-sm font-bold text-[var(--text)]">Pre-built Collection Days</p>
                <p className="text-xs text-[var(--text-muted)]">Assign a day from 30 Days, A1, A2, B1, and more directly as homework.</p>
                <button onClick={() => { setCollPickerOpen(true); setCollPickerStep(1); }} className="btn-primary text-xs px-4 py-2 !mt-3">+ Assign a Day</button>
              </div>
            ) : (
              <div className="space-y-3">
                {groupEntries.map(([collName, days]) => {
                  const open = collOpenStates[collName] ?? false;
                  const setOpen = (v: boolean) => setCollOpenStates(p => ({ ...p, [collName]: v }));
                  return (
                    <div key={collName} style={{ borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(135deg, #166534, #15803d)', boxShadow: '0 4px 16px rgba(22,101,52,0.35)' }}>
                      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                        <span className="text-xl shrink-0">📗</span>
                        <div className="flex-1 min-w-0">
                          <p style={{ fontWeight: 900, fontSize: 14, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }} className="truncate">{collName}</p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{days.length} day{days.length !== 1 ? 's' : ''} assigned</p>
                        </div>
                        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 700 }}>{open ? '▲' : '▼'}</span>
                      </button>
                      {open && (
                        <div className="space-y-2" style={{ background: 'var(--surface)', padding: '12px' }}>
                          {days.sort((a, b) => (a.dayNumber ?? 0) - (b.dayNumber ?? 0)).map(hw => {
                            const total = totalStudentsForHw(hw);
                            const due = dueDateLabel(hw.dueDate);
                            const allDone = hw.modes.every(m => (hw.progressByMode[m] ?? 0) >= total && total > 0);
                            const avgDone = total > 0 ? Math.floor(hw.modes.reduce((s, m) => s + (hw.progressByMode[m] ?? 0), 0) / hw.modes.length) : 0;
                            return (
                              <button key={hw.id} onClick={() => openHwDetail(hw)} className="w-full text-left" style={{ borderRadius: 12, padding: '12px 14px', background: 'var(--surface-2)', border: allDone ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border)' }}>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex-1 min-w-0">
                                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }} className="truncate">Day {hw.dayNumber}: {hw.unitName.split(': ')[1] ?? hw.unitName}</p>
                                    {due && <span style={{ fontSize: 10, color: due.overdue ? 'var(--danger)' : 'var(--text-muted)' }}>{due.text}</span>}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p style={{ fontSize: 14, fontWeight: 900, color: allDone ? '#22c55e' : 'var(--text)' }}>{avgDone}/{total}</p>
                                    <p style={{ fontSize: 9, color: 'var(--text-muted)' }}>avg done</p>
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  {hw.modes.map(mode => {
                                    const done = hw.progressByMode[mode] ?? 0;
                                    const pct = total === 0 ? 0 : (done / total) * 100;
                                    const color = HW_MODE_COLOR[mode] ?? 'var(--primary)';
                                    return (
                                      <div key={mode} className="flex items-center gap-2">
                                        <span style={{ fontSize: 11, width: 60, color }}>{HW_MODE_ICON[mode]} {HW_MODE_LABEL[mode] ?? mode}</span>
                                        <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: 'var(--surface)' }}>
                                          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', width: 32, textAlign: 'right' }}>{done}/{total}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Homework ── */}
      <div>
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-3">📋 Homework</p>
        {homework.length === 0 ? (
          <div className="card text-center py-10 space-y-2">
            <div className="text-4xl">📋</div>
            <p className="text-sm text-[var(--text-muted)]">No homework assigned yet — expand a folder and tap + Homework on a unit.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {homework.map(hw => {
              const total = totalStudentsForHw(hw);
              const due = dueDateLabel(hw.dueDate);
              const allDone = hw.modes.every(m => (hw.progressByMode[m] ?? 0) >= total && total > 0);
              const allModeDone = total > 0 ? Math.floor(hw.modes.reduce((sum, m) => sum + (hw.progressByMode[m] ?? 0), 0) / hw.modes.length) : 0;
              return (
                <button key={hw.id} onClick={() => openHwDetail(hw)} className="w-full text-left active:scale-[0.985] transition-transform" style={{
                  borderRadius: 16,
                  padding: '14px 16px',
                  background: 'var(--surface)',
                  boxShadow: allDone
                    ? '0 8px 20px rgba(34,197,94,0.18), 0 2px 5px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.07)'
                    : '0 8px 20px rgba(0,0,0,0.38), 0 2px 5px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.07)',
                  border: allDone ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  display: 'block',
                }}>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <p className="font-bold text-sm text-[var(--text)] truncate">{hw.unitName}</p>
                        {hw.source === 'class' && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: 'rgba(245,158,11,0.18)', color: '#F59E0B' }}>Class</span>}
                        {hw.source === 'collection' && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: 'rgba(34,197,94,0.15)', color: '#16a34a' }}>📗</span>}
                        {due && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                            color: due.overdue ? 'var(--danger)' : 'var(--text-muted)',
                            background: due.overdue ? 'color-mix(in srgb, var(--danger) 10%, transparent)' : 'var(--surface-2)',
                          }}>{due.text}</span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{total} student{total !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p style={{ fontSize: 15, fontWeight: 900, color: allDone ? '#22c55e' : 'var(--text)' }}>{allModeDone}/{total}</p>
                      <p style={{ fontSize: 9, color: 'var(--text-muted)' }}>{allDone ? 'all done ✓' : 'avg done'}</p>
                    </div>
                  </div>
                  {/* Per-mode bars */}
                  <div className="space-y-2">
                    {hw.modes.map(mode => {
                      const done = hw.progressByMode[mode] ?? 0;
                      const pct = total === 0 ? 0 : (done / total) * 100;
                      const color = HW_MODE_COLOR[mode] ?? 'var(--primary)';
                      return (
                        <div key={mode} className="flex items-center gap-2.5">
                          <div className="flex items-center gap-1.5 shrink-0" style={{ width: 76 }}>
                            <span style={{ fontSize: 13, lineHeight: 1 }}>{HW_MODE_ICON[mode]}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color }}>{HW_MODE_LABEL[mode] ?? mode}</span>
                          </div>
                          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 7, background: 'var(--surface-2)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 70%, white))`, boxShadow: `0 0 6px ${color}80` }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', width: 36, textAlign: 'right' }} className="shrink-0">{done}/{total}</span>
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create class word unit modal ── */}
      {cwUnitCreating && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setCwUnitCreating(false)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto" />
            <p className="font-bold text-[var(--text)]">New Unit</p>
            <input
              autoFocus value={cwUnitNewName} onChange={e => setCwUnitNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createCWUnit()}
              placeholder="Unit name" className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
            />
            <div className="flex gap-3">
              <button onClick={() => setCwUnitCreating(false)} className="flex-1 btn-ghost py-3 text-sm">Cancel</button>
              <button onClick={createCWUnit} disabled={!cwUnitNewName.trim()} className="flex-1 btn-primary py-3 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rename class word unit modal ── */}
      {cwUnitRenaming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setCwUnitRenaming(null)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto" />
            <p className="font-bold text-[var(--text)]">Rename Unit</p>
            <input
              autoFocus value={cwUnitRenameName} onChange={e => setCwUnitRenameName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && renameCWUnit()}
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]"
            />
            <div className="flex gap-3">
              <button onClick={() => setCwUnitRenaming(null)} className="flex-1 btn-ghost py-3 text-sm">Cancel</button>
              <button onClick={renameCWUnit} disabled={!cwUnitRenameName.trim()} className="flex-1 btn-primary py-3 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manage words modal ── */}
      {cwWordsMgr && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setCwWordsMgr(null)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 space-y-4 max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto shrink-0" />
            <p className="font-bold text-[var(--text)] shrink-0">Words in &ldquo;{cwWordsMgr.name}&rdquo;</p>
            {cwWordsAll.length === 0 ? (
              <p className="text-sm text-center text-[var(--text-muted)] py-6">No words in this class yet.</p>
            ) : (
              <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
                {cwWordsAll.map(w => (
                  <label key={w.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-[var(--surface-2)] transition-colors">
                    <input
                      type="checkbox" checked={cwWordsPending[w.id] ?? false}
                      onChange={e => setCwWordsPending(prev => ({ ...prev, [w.id]: e.target.checked }))}
                      className="w-4 h-4 rounded accent-[var(--primary)]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)] truncate">{w.word}</p>
                      <p className="text-xs text-[var(--primary)] truncate">{w.translation}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-3 shrink-0">
              <button onClick={() => setCwWordsMgr(null)} className="flex-1 btn-ghost py-3 text-sm">Cancel</button>
              <button onClick={saveManageWords} disabled={cwWordsSaving} className="flex-1 btn-primary py-3 disabled:opacity-50">
                {cwWordsSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Folder picker modal ── */}
      {showFolderPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowFolderPicker(false)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 space-y-4 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto shrink-0" />
            <p className="font-bold text-[var(--text)] shrink-0">Assign a Folder</p>
            {folderPickerLoading ? (
              <div className="flex justify-center py-8"><div className="text-3xl animate-bounce">📁</div></div>
            ) : availFolders.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <p className="text-4xl">📁</p>
                <p className="text-sm text-[var(--text-muted)]">All your library folders are already assigned, or you haven&apos;t created any yet.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {availFolders.map(f => (
                  <button key={f.id} onClick={() => assignFolder(f.id)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors hover:bg-[var(--primary-bg)]" style={{ background: 'var(--surface-2)' }}>
                    <span className="text-xl">📁</span>
                    <div>
                      <p className="font-semibold text-sm text-[var(--text)]">{f.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{f.unitCount} unit{f.unitCount !== 1 ? 's' : ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowFolderPicker(false)} className="w-full btn-ghost py-3 shrink-0">Cancel</button>
          </div>
        </div>
      )}

      {/* ── Collection picker — step 1 (pick collection) ── */}
      {collPickerOpen && collPickerStep === 1 && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setCollPickerOpen(false)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 space-y-4 max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto shrink-0" />
            <p className="font-bold text-[var(--text)] shrink-0">Pick a Collection</p>
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {COLLECTION_META.map(c => (
                <button key={c.name} onClick={() => pickCollection(c.name)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-[var(--primary-bg)] transition-colors" style={{ background: 'var(--surface-2)' }}>
                  <span className="text-2xl">{c.emoji}</span>
                  <div>
                    <p className="font-semibold text-sm text-[var(--text)]">{c.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{c.totalDays} days</p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setCollPickerOpen(false)} className="w-full btn-ghost py-3 shrink-0">Cancel</button>
          </div>
        </div>
      )}

      {/* ── Collection picker — step 2 (pick day) ── */}
      {collPickerOpen && collPickerStep === 2 && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => { setCollPickerOpen(false); setCollPickerStep(1); }}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 space-y-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto shrink-0" />
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setCollPickerStep(1)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← Back</button>
              <p className="font-bold text-[var(--text)] flex-1 truncate">{collPickerCollName}</p>
            </div>
            {collPickerLoading ? (
              <div className="flex justify-center py-8"><div className="text-3xl animate-bounce">📗</div></div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {collPickerDays.map(d => {
                  const alreadyAssigned = homework.some(h => h.collectionName === collPickerCollName && h.dayNumber === d.dayNumber);
                  return (
                    <button key={d.dayNumber} onClick={() => !alreadyAssigned && pickCollectionDay(d.dayNumber, d.topic)}
                      disabled={alreadyAssigned}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${alreadyAssigned ? 'opacity-50 cursor-default' : 'hover:bg-[var(--primary-bg)]'}`}
                      style={{ background: 'var(--surface-2)' }}>
                      <div className="shrink-0 w-8 text-center">
                        <p className="text-xs font-black text-[var(--primary)]">{d.dayNumber}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[var(--text)] truncate">{d.topic}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{d.wordCount} words{alreadyAssigned ? ' · Assigned ✓' : ''}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <button onClick={() => { setCollPickerOpen(false); setCollPickerStep(1); }} className="w-full btn-ghost py-3 shrink-0">Cancel</button>
          </div>
        </div>
      )}

      {/* ── Assign homework modal ── */}
      {hwUnit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={closeHwModal}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 space-y-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto shrink-0" />
            <p className="font-bold text-[var(--text)] shrink-0">Assign: {hwUnit.name}</p>

            <div className="shrink-0">
              <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Modes</p>
              <div className="flex flex-wrap gap-2">
                {[...REQUIRED_MODES, ...OPTIONAL_MODES].map(mode => {
                  const required = REQUIRED_MODES.includes(mode);
                  const active = hwModes.has(mode);
                  return (
                    <button
                      key={mode}
                      disabled={required}
                      onClick={() => setHwModes(prev => { const next = new Set(prev); if (next.has(mode)) { next.delete(mode); } else { next.add(mode); } return next; })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                      style={{ background: active ? 'var(--primary)' : 'var(--surface-2)', color: active ? 'white' : 'var(--text-muted)', borderColor: active ? 'var(--primary)' : 'var(--border)', opacity: required ? 0.75 : 1 }}
                    >
                      {HW_MODE_ICON[mode]} {mode.charAt(0).toUpperCase() + mode.slice(1)}{required ? ' *' : ''}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">* Required</p>
            </div>

            <div className="shrink-0">
              <label className="text-xs font-semibold text-[var(--text-muted)] mb-1.5 block">Due Date (optional)</label>
              <input type="date" value={hwDueDate} onChange={e => setHwDueDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]" />
            </div>

            <div className="shrink-0">
              <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">Assign to</p>
              <div className="flex gap-2">
                {(['class', 'specific'] as const).map(who => (
                  <button key={who} onClick={() => setHwWho(who)} className="flex-1 py-2 rounded-xl text-sm font-semibold border transition-all"
                    style={{ background: hwWho === who ? 'var(--primary)' : 'var(--surface-2)', color: hwWho === who ? 'white' : 'var(--text-muted)', borderColor: hwWho === who ? 'var(--primary)' : 'var(--border)' }}>
                    {who === 'class' ? '👥 Whole Class' : '👤 Specific Students'}
                  </button>
                ))}
              </div>
            </div>

            {hwWho === 'specific' && (
              <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
                {students.map(s => {
                  const checked = hwStudentIds.has(s.studentId);
                  return (
                    <label key={s.studentId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-[var(--surface-2)] transition-colors">
                      <input type="checkbox" checked={checked} onChange={() => setHwStudentIds(prev => { const next = new Set(prev); if (next.has(s.studentId)) { next.delete(s.studentId); } else { next.add(s.studentId); } return next; })} className="w-4 h-4 rounded accent-[var(--primary)]" />
                      <span className="text-sm font-medium text-[var(--text)]">{s.name}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex gap-3 shrink-0">
              <button onClick={closeHwModal} className="flex-1 btn-ghost py-3 text-sm">Cancel</button>
              <button onClick={saveHomework} disabled={hwSaving || (hwWho === 'specific' && hwStudentIds.size === 0)} className="flex-1 btn-primary py-3 disabled:opacity-50">
                {hwSaving ? 'Saving…' : 'Assign 📋'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Homework detail modal ── */}
      {hwDetail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setHwDetail(null)}>
          <div
            className="w-full max-w-md flex flex-col max-h-[82vh]"
            style={{
              background: 'var(--surface)',
              borderRadius: '24px 24px 0 0',
              boxShadow: '0 -12px 40px rgba(0,0,0,0.6), 0 -2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 shrink-0">
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
            </div>

            {/* Header */}
            <div className="shrink-0 px-5 pt-3 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)' }} className="truncate">{hwDetail.unitName}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {hwDetail.modes.map(m => {
                      const color = HW_MODE_COLOR[m] ?? 'var(--primary)';
                      return (
                        <span key={m} style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: `color-mix(in srgb, ${color} 20%, transparent)`,
                          color,
                          border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
                        }}>{HW_MODE_ICON[m]} {HW_MODE_LABEL[m]}</span>
                      );
                    })}
                    {(() => { const d = dueDateLabel(hwDetail.dueDate); return d ? <span style={{ fontSize: 10, color: d.overdue ? 'var(--danger)' : 'var(--text-muted)' }}>· {d.text}</span> : null; })()}
                  </div>
                </div>
                <button
                  onClick={deleteHomework}
                  disabled={hwDeleting}
                  className="shrink-0 active:scale-95 transition-transform disabled:opacity-50"
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 10,
                    background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
                    color: 'var(--danger)',
                    border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
                  }}
                >{hwDeleting ? 'Deleting…' : '🗑 Delete'}</button>
              </div>
            </div>

            {/* Student list */}
            <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3 space-y-2">
              {detailLoading ? (
                <div className="flex justify-center py-10"><div className="text-3xl animate-bounce">📋</div></div>
              ) : detailProgress.length === 0 ? (
                <p className="text-sm text-center text-[var(--text-muted)] py-8">No students assigned</p>
              ) : detailProgress.map(sp => {
                const doneModes = hwDetail.modes.filter(m => sp.modes.has(m));
                const allDone = doneModes.length === hwDetail.modes.length;
                return (
                  <div key={sp.studentId} style={{
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'var(--surface-2)',
                    boxShadow: allDone
                      ? 'inset 0 2px 5px rgba(0,0,0,0.2), 0 0 0 1px rgba(34,197,94,0.2)'
                      : 'inset 0 2px 5px rgba(0,0,0,0.2)',
                  }}>
                    <div className="flex items-center justify-between mb-2.5">
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{sp.name}</p>
                      <span style={{
                        fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                        background: allDone ? 'linear-gradient(135deg, #22c55e, #15803d)' : 'var(--border)',
                        color: allDone ? 'white' : 'var(--text-muted)',
                        boxShadow: allDone ? '0 2px 6px rgba(34,197,94,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' : 'inset 0 1px 3px rgba(0,0,0,0.2)',
                      }}>
                        {allDone ? '✓ Done' : `${doneModes.length}/${hwDetail.modes.length}`}
                      </span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {hwDetail.modes.map(m => {
                        const done = sp.modes.has(m);
                        const color = HW_MODE_COLOR[m] ?? 'var(--primary)';
                        return (
                          <span key={m} style={{
                            fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 20,
                            display: 'flex', alignItems: 'center', gap: 4,
                            ...(done ? {
                              background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 70%, #000))`,
                              color: 'white',
                              boxShadow: `0 2px 8px color-mix(in srgb, ${color} 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.2)`,
                            } : {
                              background: 'var(--surface)',
                              color: 'var(--text-muted)',
                              boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.25)',
                            }),
                          }}>
                            <span style={{ opacity: done ? 1 : 0.35, fontSize: 12 }}>{HW_MODE_ICON[m]}</span>
                            {HW_MODE_LABEL[m] ?? m}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Close */}
            <div className="shrink-0 px-5 pb-6 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => setHwDetail(null)}
                className="w-full active:scale-[0.98] transition-transform"
                style={{
                  padding: '14px', borderRadius: 14, fontWeight: 700, fontSize: 14,
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.2), 0 1px 0 rgba(255,255,255,0.04)',
                  border: 'none',
                }}
              >Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ done, total, color }: { done: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.min(100, (done / total) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap font-medium">{done}/{total}</span>
    </div>
  );
}

const _topicsCache: Record<string, Record<number, string>> = {};

type CachedClass = { classInfo: ClassInfo; students: StudentRow[]; collections: CollectionMeta[]; hardWords: HardWord[] };
const _classCache = new Map<string, CachedClass>();

async function fetchTopics(collectionName: string): Promise<Record<number, string>> {
  if (_topicsCache[collectionName]) return _topicsCache[collectionName];
  try {
    const fileMap: Record<string, string> = { A1: '/data/a1_collection.json', A2: '/data/a2_collection.json', B1: '/data/b1_collection.json', Advanced: '/data/advanced_collection.json' };
    let result: Record<number, string>;
    if (fileMap[collectionName]) {
      const data = await (await fetch(fileMap[collectionName])).json();
      result = Object.fromEntries((data.days as { dayNumber: number; topic: string }[]).map(d => [d.dayNumber, d.topic]));
    } else {
      const data = await (await fetch('/data/word_data.json')).json();
      const col = (data as { name: string; days: { dayNumber: number; topic: string }[] }[]).find(c => c.name === collectionName);
      result = col ? Object.fromEntries(col.days.map(d => [d.dayNumber, d.topic])) : {};
    }
    _topicsCache[collectionName] = result;
    return result;
  } catch { return {}; }
}

type UnitRow = { day_number: number; learn_done: boolean; flashcard_done: boolean; quiz_done: boolean; completed_at: string | null };
type CollectionModal = { student: StudentRow; collectionName: string; label: string; total: number; color: string };

export default function ClassDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [collections, setCollections] = useState<CollectionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [notTeacher, setNotTeacher] = useState(false);
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab') as Tab | null;
    return t && ['students','activity','radar','analytics','srs','curriculum'].includes(t) ? t : 'students';
  });

  // Sort & filter
  const [sortBy, setSortBy] = useState<SortKey>('lastActive');
  const [filterBy, setFilterBy] = useState<FilterKey>('all');

  // Notes state
  const [noteTarget, setNoteTarget] = useState<StudentRow | null>(null);
  const [noteText, setNoteText] = useState('');
  const [sending, setSending] = useState(false);
  const [studentNotes, setStudentNotes] = useState<Record<string, Note[]>>({});

  // Targets state
  const [targetStudent, setTargetStudent] = useState<StudentRow | null>(null);
  const [targetTitle, setTargetTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [settingTarget, setSettingTarget] = useState(false);
  const [studentTargets, setStudentTargets] = useState<Record<string, Target[]>>({});

  // Hard Word Radar
  const [hardWords, setHardWords] = useState<HardWord[]>([]);

  // Activity feed
  const [activityFeed, setActivityFeed] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [announceText, setAnnounceText] = useState('');
  const [announcing, setAnnouncing] = useState(false);

  // Collection drill-down
  const [collectionModal, setCollectionModal] = useState<CollectionModal | null>(null);
  const [unitRows, setUnitRows] = useState<UnitRow[]>([]);
  const [unitTopics, setUnitTopics] = useState<Record<number, string>>({});
  const [unitLoading, setUnitLoading] = useState(false);

  // Analytics tab
  const [analyticsData, setAnalyticsData] = useState<AnalyticsRow[]>([]);
  const [activeStudents, setActiveStudents] = useState<ActiveStudent[]>([]);
  const [progressPoints, setProgressPoints] = useState<ProgressPoint[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [digestText, setDigestText] = useState('');
  const [digestLoading, setDigestLoading] = useState(false);

  // SRS tab
  const [srsRows, setSrsRows] = useState<SRSRow[]>([]);
  const [gridWords, setGridWords] = useState<WordForGrid[]>([]);
  const [hardWordsRaw, setHardWordsRaw] = useState<HardWordRaw[]>([]);
  const [srsNames, setSrsNames] = useState<Record<string, string>>({});
  const [srsLoading, setSrsLoading] = useState(false);
  const [srsLoaded, setSrsLoaded] = useState(false);

  // Streak calendar
  const [streakModal, setStreakModal] = useState<StudentRow | null>(null);
  const [studyDates, setStudyDates] = useState<Set<string>>(new Set());
  const [streakLoading, setStreakLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const visibleStudents = useMemo(() => {
    let list = [...students];
    if (filterBy === 'active') list = list.filter(s => s.last_study_date && s.last_study_date >= sevenDaysAgo);
    else if (filterBy === 'inactive') list = list.filter(s => !s.last_study_date || s.last_study_date < sevenDaysAgo);
    list.sort((a, b) => {
      if (sortBy === 'xp') return b.xp - a.xp;
      if (sortBy === 'progress') return Object.values(b.collection_progress).reduce((s, v) => s + v, 0) - Object.values(a.collection_progress).reduce((s, v) => s + v, 0);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (!a.last_study_date && !b.last_study_date) return 0;
      if (!a.last_study_date) return 1;
      if (!b.last_study_date) return -1;
      return b.last_study_date.localeCompare(a.last_study_date);
    });
    return list;
  }, [students, sortBy, filterBy]);

  const classStats = useMemo(() => {
    if (students.length === 0) return null;
    const n = students.length;
    const totalXP = students.reduce((s, r) => s + r.xp, 0);
    const avgStreak = students.reduce((s, r) => s + r.streak, 0) / n;
    const avgWords = students.reduce((s, r) => s + r.total_words, 0) / n;
    const activeCount = students.filter(r => r.last_study_date && r.last_study_date >= sevenDaysAgo).length;
    return { totalXP, avgStreak, avgWords, activeCount, n };
  }, [students]);

  // Group activity by calendar day
  const groupedActivity = useMemo(() => {
    const groups: { label: string; items: ActivityRow[] }[] = [];
    let currentLabel = '';
    for (const item of activityFeed) {
      const label = dayLabel(item.completed_at);
      if (label !== currentLabel) {
        groups.push({ label, items: [item] });
        currentLabel = label;
      } else {
        groups[groups.length - 1].items.push(item);
      }
    }
    return groups;
  }, [activityFeed]);

  const loadNotes = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('class_notes')
      .select('id, student_id, message, created_at, read_at')
      .eq('class_id', id)
      .order('created_at', { ascending: false });
    if (!data) return;
    const map: Record<string, Note[]> = {};
    for (const n of data) {
      if (!map[n.student_id]) map[n.student_id] = [];
      map[n.student_id].push(n);
    }
    setStudentNotes(map);
  };

  const loadTargets = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('class_targets')
      .select('id, student_id, title, due_date, completed_at, created_at')
      .eq('class_id', id)
      .order('created_at', { ascending: false });
    if (!data) return;
    const map: Record<string, Target[]> = {};
    for (const t of data) {
      if (!map[t.student_id]) map[t.student_id] = [];
      map[t.student_id].push(t);
    }
    setStudentTargets(map);
  };

  const loadAnnouncements = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('class_announcements')
      .select('id, message, created_at')
      .eq('class_id', id)
      .order('created_at', { ascending: false });
    setAnnouncements((data as Announcement[]) ?? []);
  };

  const postAnnouncement = async () => {
    if (!user || !announceText.trim()) return;
    setAnnouncing(true);
    await supabase.from('class_announcements').insert({
      class_id: id,
      teacher_id: user.id,
      message: announceText.trim(),
    });
    setAnnounceText('');
    await loadAnnouncements();
    setAnnouncing(false);
  };

  const deleteAnnouncement = async (announcementId: string) => {
    if (!confirm('Delete this announcement?')) return;
    await supabase.from('class_announcements').delete().eq('id', announcementId);
    setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
  };

  const loadActivity = async () => {
    if (!id) return;
    setActivityLoading(true);
    const { data } = await supabase.rpc('get_class_activity', { p_class_id: id });
    setActivityFeed((data as ActivityRow[]) ?? []);
    setActivityLoading(false);
  };

  const loadAnalytics = async () => {
    if (!id) return;
    setAnalyticsLoading(true);
    const [{ data: ad }, { data: pd }] = await Promise.all([
      supabase.rpc('get_class_analytics', { p_class_id: id }),
      supabase.rpc('get_class_progress_over_time', { p_class_id: id, p_days: 30 }),
    ]);
    setAnalyticsData((ad as AnalyticsRow[]) ?? []);
    setProgressPoints((pd as ProgressPoint[]) ?? []);
    setAnalyticsLoading(false);
  };

  const loadActiveStudents = async () => {
    if (!id) return;
    const { data } = await supabase.rpc('get_active_students', { p_class_id: id });
    setActiveStudents((data as ActiveStudent[]) ?? []);
  };

  const loadSRS = async () => {
    if (!id) return;
    setSrsLoading(true);
    const [{ data: srs }, { data: words }, { data: hard }] = await Promise.all([
      supabase.from('class_srs_states').select('user_id, word, translation, stage, next_due').eq('class_id', id),
      supabase.from('class_words').select('word, translation').eq('class_id', id).order('word'),
      supabase.from('class_hard_words').select('user_id, word').eq('class_id', id),
    ]);
    setSrsRows((srs as SRSRow[]) ?? []);
    setGridWords((words as WordForGrid[]) ?? []);
    setHardWordsRaw((hard as HardWordRaw[]) ?? []);
    const uids = [...new Set(((srs as SRSRow[]) ?? []).map(r => r.user_id))];
    if (uids.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', uids);
      const map: Record<string, string> = {};
      for (const p of (profiles as { id: string; name: string }[]) ?? []) map[p.id] = p.name;
      setSrsNames(map);
    }
    setSrsLoading(false);
    setSrsLoaded(true);
  };

  const load = async () => {
    if (!user || !id) return;
    const cached = _classCache.get(id);
    if (cached) {
      setClassInfo(cached.classInfo);
      setStudents(cached.students);
      setCollections(cached.collections);
      setHardWords(cached.hardWords);
      setLoading(false); // show stale data immediately, refresh silently below
    } else {
      setLoading(true);
    }
    const { data: cls } = await supabase.from('classes').select('*').eq('id', id).single();
    if (!cls || cls.teacher_id !== user.id) { setNotTeacher(true); setLoading(false); return; }
    setClassInfo(cls);
    const [{ data }, { data: colData }] = await Promise.all([
      supabase.rpc('get_class_dashboard', { p_class_id: id }),
      supabase.from('collections').select('*').order('display_order'),
    ]);
    setStudents((data as StudentRow[]) ?? []);
    setCollections((colData as CollectionMeta[]) ?? []);
    const { data: hwData } = await supabase.rpc('get_hard_words', { p_class_id: id });
    setHardWords((hwData as HardWord[]) ?? []);
    _classCache.set(id, {
      classInfo: cls as ClassInfo,
      students: (data as StudentRow[]) ?? [],
      collections: (colData as CollectionMeta[]) ?? [],
      hardWords: (hwData as HardWord[]) ?? [],
    });
    await Promise.all([loadNotes(), loadTargets(), loadAnnouncements()]);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); else setLoading(false); }, [user, id]);
  useEffect(() => { if (tab === 'activity' && activityFeed.length === 0) loadActivity(); }, [tab]);
  useEffect(() => {
    if (tab !== 'analytics') return;
    if (analyticsData.length === 0) loadAnalytics();
    loadActiveStudents();
    const id30s = setInterval(loadActiveStudents, 30_000);
    return () => clearInterval(id30s);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'srs' && !srsLoaded) loadSRS(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!streakModal || !id) return;
    setStreakLoading(true);
    setStudyDates(new Set());
    supabase.rpc('get_student_study_calendar', { p_class_id: id, p_student_id: streakModal.student_id })
      .then(({ data }) => {
        setStudyDates(new Set((data as { study_date: string }[] ?? []).map(r => r.study_date)));
        setStreakLoading(false);
      });
  }, [streakModal]);

  useEffect(() => {
    if (!collectionModal || !id) return;
    setUnitLoading(true);
    setUnitRows([]);
    Promise.all([
      supabase.rpc('get_student_collection_progress', { p_class_id: id, p_student_id: collectionModal.student.student_id, p_collection_name: collectionModal.collectionName }),
      fetchTopics(collectionModal.collectionName),
    ]).then(([{ data }, topics]) => {
      setUnitRows((data as UnitRow[]) ?? []);
      setUnitTopics(topics);
      setUnitLoading(false);
    });
  }, [collectionModal]);

  const openCollection = (s: StudentRow, col: CollectionMeta) =>
    setCollectionModal({ student: s, collectionName: col.collection_name, label: col.label, total: col.total_units, color: col.color_hex });

  const copyCode = () => {
    if (!classInfo) return;
    navigator.clipboard.writeText(classInfo.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportCSV = () => {
    const headers = ['Name', 'Last Active', 'XP', 'Streak', 'Words Learned', ...collections.map(c => `${c.label} (/${c.total_units})`)];
    const rows = students.map(s => [
      s.name, s.last_study_date ?? 'Never', s.xp, s.streak, s.total_words,
      ...collections.map(c => s.collection_progress[c.collection_name] ?? 0),
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(classInfo?.name ?? 'class').replace(/[^a-z0-9]/gi, '-')}-progress-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const removeStudent = async (studentId: string) => {
    if (!confirm('Remove this student from the class?')) return;
    await supabase.from('class_members').delete().eq('class_id', id).eq('student_id', studentId);
    load();
  };

  const openNoteModal = async (s: StudentRow) => {
    setNoteTarget(s);
    setNoteText('');
    const unread = (studentNotes[s.student_id] ?? []).filter(n => !n.read_at);
    if (unread.length > 0) {
      await supabase.from('class_notes').update({ read_at: new Date().toISOString() }).in('id', unread.map(n => n.id));
      await loadNotes();
    }
  };

  const sendNote = async () => {
    if (!user || !noteTarget || !noteText.trim()) return;
    setSending(true);
    await supabase.from('class_notes').insert({ class_id: id, student_id: noteTarget.student_id, teacher_id: user.id, message: noteText.trim() });
    setNoteText('');
    await loadNotes();
    setSending(false);
  };

  const addTarget = async () => {
    if (!user || !targetStudent || !targetTitle.trim()) return;
    setSettingTarget(true);
    await supabase.from('class_targets').insert({ class_id: id, student_id: targetStudent.student_id, teacher_id: user.id, title: targetTitle.trim(), due_date: targetDate || null });
    setTargetTitle('');
    setTargetDate('');
    await loadTargets();
    setSettingTarget(false);
  };

  const deleteTarget = async (targetId: string) => {
    if (!confirm('Delete this target?')) return;
    await supabase.from('class_targets').delete().eq('id', targetId);
    await loadTargets();
  };

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
      <div className="text-5xl">🔒</div>
      <p className="text-[var(--text-muted)]">Sign in to view this class</p>
      <button onClick={() => router.push('/login')} className="btn-primary">Sign in</button>
    </div>
  );

  if (notTeacher) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
      <div className="text-5xl">⛔</div>
      <p className="font-bold text-[var(--text)]">Not your class</p>
      <p className="text-sm text-[var(--text-muted)]">Only the teacher can view this dashboard</p>
      <button onClick={() => router.push(`/classes/${id}/home`)} className="btn-primary">Go back</button>
    </div>
  );

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'lastActive', label: '🕐 Active' },
    { key: 'xp', label: '⚡ XP' },
    { key: 'progress', label: '📈 Progress' },
    { key: 'name', label: '🔤 Name' },
  ];

  const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: '✅ Active' },
    { key: 'inactive', label: '😴 Inactive' },
  ];

  const _n = (id as string).split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
  const _grad = ['from-indigo-500 to-purple-500','from-pink-500 to-rose-400','from-emerald-500 to-teal-400','from-blue-500 to-cyan-400','from-amber-500 to-orange-400','from-violet-500 to-purple-400','from-red-500 to-pink-400','from-cyan-500 to-blue-400'][_n % 8];
  const _glow = ['#818cf8','#ec4899','#22c55e','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4'][_n % 8];

  return (
    <div className="flex flex-col min-h-screen pb-24 animate-fade-in">
      {/* Gradient hero header */}
      <div className={`bg-gradient-to-br ${_grad} px-5 pt-5 pb-6 relative`}
        style={{ boxShadow: `0 8px 32px ${_glow}cc` }}>
        <div style={{ position: 'absolute', right: 16, top: 8, fontSize: 80, fontWeight: 900, color: 'rgba(255,255,255,0.06)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>🏫</div>
        <button onClick={() => router.push(`/classes/${id}/home`)} className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium mb-4 transition-colors">← Back</button>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ background: 'rgba(255,255,255,0.18)', boxShadow: '0 4px 0 rgba(0,0,0,0.15)' }}>🏫</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-white/50 uppercase tracking-widest mb-0.5">Teacher Dashboard</p>
            <h1 className="text-2xl font-black text-white leading-tight truncate" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>{classInfo?.name ?? '…'}</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-white/60">Join code:</p>
              <code className="text-xs font-black text-white/90">{classInfo?.join_code}</code>
              <button onClick={copyCode} className="text-sm hover:scale-110 transition-transform" aria-label="Copy join code">{copied ? '✅' : '📋'}</button>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-black text-white leading-tight">{students.length}</p>
            <p className="text-xs text-white/60">students</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => router.push(`/classes/${id}/words`)} className="text-xs font-bold px-3 py-1.5 rounded-xl text-white transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}>📝 Words</button>
          <button onClick={() => { setShowAnnounce(true); setAnnounceText(''); }} className="text-xs font-bold px-3 py-1.5 rounded-xl text-white transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}>📢 Announce</button>
          <button onClick={load} className="text-xs font-bold px-3 py-1.5 rounded-xl text-white transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}>🔄 Refresh</button>
          {students.length > 0 && (
            <button onClick={exportCSV} className="text-xs font-bold px-3 py-1.5 rounded-xl text-white transition-opacity hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}>📥 CSV</button>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      {!loading && (
        <div className="flex overflow-x-auto border-b border-[var(--border)]">
          {(['students', 'activity', 'radar', 'analytics', 'srs', 'curriculum'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 shrink-0 py-2.5 text-xs font-semibold transition-colors ${
                tab === t
                  ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {t === 'students' ? '👥' : t === 'activity' ? '📡' : t === 'radar' ? '🎯' : t === 'analytics' ? '📊' : t === 'srs' ? '📚' : '📋'}
              {' '}{t === 'students' ? 'Students' : t === 'activity' ? 'Activity' : t === 'radar' ? 'Radar' : t === 'analytics' ? 'Analytics' : t === 'srs' ? 'SRS' : 'Curriculum'}
            </button>
          ))}
        </div>
      )}

      {/* Class stats bar — students tab only */}
      {!loading && tab === 'students' && classStats && (
        <div className="grid grid-cols-4 divide-x divide-[var(--border)] border-b border-[var(--border)]">
          {[
            { label: 'Total XP', value: (classStats.totalXP / 10).toLocaleString(), icon: '⚡' },
            { label: 'Avg streak', value: `${classStats.avgStreak.toFixed(1)}d`, icon: '🔥' },
            { label: 'Avg items', value: Math.round(classStats.avgWords).toString(), icon: '📚' },
            { label: 'Active', value: `${classStats.activeCount}/${classStats.n}`, icon: '✅' },
          ].map(stat => (
            <div key={stat.label} className="flex flex-col items-center py-2.5 px-1">
              <p className="text-base font-black text-[var(--text)] leading-tight">{stat.icon} {stat.value}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sort & Filter bar — students tab only */}
      {!loading && tab === 'students' && students.length > 0 && (
        <div className="px-4 py-2.5 border-b border-[var(--border)] space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] shrink-0">Sort:</span>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`shrink-0 text-xs px-3 py-1 rounded-full font-medium transition-all ${sortBy === opt.key ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] shrink-0">Filter:</span>
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setFilterBy(opt.key)}
                className={`shrink-0 text-xs px-3 py-1 rounded-full font-medium transition-all ${filterBy === opt.key ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12"><div className="text-4xl animate-bounce">📊</div></div>

        ) : tab === 'activity' ? (
          /* ── Activity feed ── */
          activityLoading ? (
            <div className="flex justify-center py-12"><div className="text-4xl animate-bounce">📡</div></div>
          ) : activityFeed.length === 0 ? (
            <div className="card text-center py-12 space-y-3">
              <div className="text-5xl">📡</div>
              <p className="font-bold text-[var(--text)]">No activity yet</p>
              <p className="text-sm text-[var(--text-muted)]">Activity appears here as students complete units</p>
            </div>
          ) : (
            <div className="space-y-5">
              {groupedActivity.map(group => (
                <div key={group.label}>
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">{group.label}</p>
                  <div className="space-y-2">
                    {group.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-2.5 px-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                        <Avatar name={item.student_name} url={item.avatar_url} size={34} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--text)] leading-tight">
                            <span className="font-semibold">{item.student_name}</span>
                            {' '}completed {ACTIVITY_ICON[item.completion_type]}{' '}
                            <span className="font-medium">{ACTIVITY_LABEL[item.completion_type]}</span>
                            {' · '}<span className="text-[var(--text-muted)]">{item.collection_name} Unit {item.day_number}</span>
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{timeAgo(item.completed_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )

        ) : tab === 'analytics' ? (
          /* ── Analytics tab ── */
          <AnalyticsTab
            analyticsData={analyticsData}
            activeStudents={activeStudents}
            progressPoints={progressPoints}
            loading={analyticsLoading}
            students={students}
            collections={collections}
            classId={id ?? ''}
            digestText={digestText}
            digestLoading={digestLoading}
            onDigest={async () => {
              setDigestLoading(true);
              try {
                const payload = analyticsData.map(r => {
                  const s = students.find(st => st.student_id === r.student_id);
                  return {
                    studentName: s?.name ?? 'Unknown',
                    totalSessions: r.total_sessions,
                    totalWordsLearned: r.total_words_learned,
                    avgSessionSeconds: r.avg_session_seconds,
                    genuineMasteryPct: r.genuine_mastery_pct,
                    speedFlagSessions: r.speed_flag_sessions,
                  };
                });
                const res = await fetch('/api/digest', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ classId: id, analytics: payload }),
                });
                const json = await res.json();
                setDigestText(json.digest ?? json.error ?? 'Error generating digest');
              } catch { setDigestText('Error connecting to AI service'); }
              setDigestLoading(false);
            }}
          />

        ) : tab === 'radar' ? (
          /* ── Hard Word Radar tab ── */
          hardWords.length === 0 ? (
            <div className="card text-center py-16 space-y-3">
              <div className="text-5xl">📡</div>
              <p className="font-bold text-[var(--text)]">No data yet</p>
              <p className="text-sm text-[var(--text-muted)]">Words appear here once students have studied them at least 3 times.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--primary-bg)] border border-[var(--primary)]/20">
                <span className="text-lg shrink-0">📡</span>
                <p className="text-xs text-[var(--text)]">Words ranked by how often students struggle — lowest accuracy first.</p>
              </div>
              {hardWords.map((w, i) => {
                const pct = w.accuracy_pct;
                const barColor = pct < 30 ? 'var(--danger)' : pct < 60 ? '#f97316' : 'var(--success)';
                return (
                  <div key={w.word_id} className="card flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-black" style={{ background: `color-mix(in srgb, ${barColor} 15%, transparent)`, color: barColor }}>
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--text)]">{w.word}</span>
                        <span className="text-[var(--text-muted)] text-sm">·</span>
                        <span className="text-[var(--primary)] text-sm">{w.translation}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">{w.correct_count}/{w.attempts} correct · {pct}% accuracy</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )

        ) : tab === 'srs' ? (
          /* ── SRS tab ── */
          <SRSTab
            srsRows={srsRows}
            gridWords={gridWords}
            hardWordsRaw={hardWordsRaw}
            srsNames={srsNames}
            loading={srsLoading}
          />

        ) : tab === 'curriculum' ? (
          /* ── Curriculum tab ── */
          <CurriculumTab
            classId={id ?? ''}
            students={students.map(s => ({ studentId: s.student_id, name: s.name }))}
          />

        ) : (
          /* ── Students tab ── */
          students.length === 0 ? (
            <div className="card text-center py-12 space-y-3">
              <div className="text-5xl">👥</div>
              <p className="font-bold text-[var(--text)]">No students yet</p>
              <p className="text-sm text-[var(--text-muted)]">Share this code with your students:</p>
              <div className="flex items-center justify-center gap-2">
                <code className="text-xl font-black text-[var(--primary)] bg-[var(--primary-bg)] px-5 py-2.5 rounded-xl tracking-wider">{classInfo?.join_code}</code>
                <button onClick={copyCode} className="text-2xl" aria-label="Copy join code">{copied ? '✅' : '📋'}</button>
              </div>
            </div>
          ) : visibleStudents.length === 0 ? (
            <div className="card text-center py-10 space-y-2">
              <div className="text-4xl">😴</div>
              <p className="font-bold text-[var(--text)]">No inactive students</p>
              <p className="text-sm text-[var(--text-muted)]">Everyone studied in the last 7 days!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleStudents.map((s, i) => {
                const notes = studentNotes[s.student_id] ?? [];
                const unreadNotes = notes.filter(n => !n.read_at).length;
                const targets = studentTargets[s.student_id] ?? [];
                const activeTargets = targets.filter(t => !t.completed_at).length;
                const totalProgress = Object.values(s.collection_progress).reduce((sum, v) => sum + v, 0);
                return (
                  <div key={s.student_id} className="card space-y-3" style={isInactive(s.last_study_date) ? { borderLeft: '3px solid var(--danger)', background: 'color-mix(in srgb, var(--danger) 4%, var(--surface))' } : {}}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[var(--text-muted)] w-5 text-center shrink-0">{i + 1}</span>
                      <Avatar name={s.name} url={s.avatar_url} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm text-[var(--text)] truncate">{s.name}</p>
                          {isInactive(s.last_study_date) && <span className="text-[10px] font-bold text-[var(--danger)] shrink-0">⚠️ Inactive</span>}
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">Last active: {lastActiveLabel(s.last_study_date)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-[var(--primary)]">{(s.xp / 10).toFixed(1)} XP</p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          <button onClick={() => { const now = new Date(); setCalendarMonth({ year: now.getFullYear(), month: now.getMonth() }); setStreakModal(s); }} className="font-semibold hover:opacity-70 transition-opacity">🔥 {s.streak} ↗</button>
                          {' · 📚 '}{s.total_words}
                        </p>
                      </div>
                    </div>

                    <div className="pl-8">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-[var(--text-muted)]">Overall progress</span>
                        <span className="text-[10px] font-bold text-[var(--text-muted)]">{totalProgress}/{s.total_units_sum} units</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${s.total_units_sum > 0 ? Math.min(100, (totalProgress / s.total_units_sum) * 100) : 0}%`, background: 'linear-gradient(90deg, #2ECC71, #3498DB)' }} />
                      </div>
                    </div>

                    <div className="pl-8 space-y-2">
                      {(() => {
                        const groups: { name: string; cols: CollectionMeta[] }[] = [];
                        for (const col of collections) {
                          const g = groups.find(g => g.name === col.group_name);
                          if (g) g.cols.push(col); else groups.push({ name: col.group_name, cols: [col] });
                        }
                        return groups.map(({ name, cols }) => (
                          <div key={name}>
                            <p className="text-[10px] font-semibold text-[var(--text-muted)] pt-1">{name}</p>
                            <div className="grid gap-2 mt-1" style={{ gridTemplateColumns: `repeat(${Math.min(cols.length, 4)}, 1fr)` }}>
                              {cols.map(col => (
                                <button key={col.collection_name} onClick={() => openCollection(s, col)} className="text-left hover:opacity-75 transition-opacity">
                                  <p className="text-[10px] font-bold text-[var(--text-muted)] mb-1">{col.label} ↗</p>
                                  <ProgressBar done={s.collection_progress[col.collection_name] ?? 0} total={col.total_units} color={col.color_hex} />
                                </button>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>

                    <div className="flex items-center gap-4 pl-8">
                      <button onClick={() => openNoteModal(s)} className="flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:opacity-70 transition-opacity">
                        ✉️ Note
                        {unreadNotes > 0 && <span className="bg-[var(--primary)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unreadNotes}</span>}
                      </button>
                      <button onClick={() => { setTargetStudent(s); setTargetTitle(''); setTargetDate(''); }} className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
                        🎯 Target
                        {activeTargets > 0 && <span className="bg-[var(--surface-2)] text-[var(--text-muted)] text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-[var(--border)]">{activeTargets}</span>}
                      </button>
                      <button onClick={() => removeStudent(s.student_id)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors ml-auto">Remove</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Note modal */}
      {noteTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setNoteTarget(null)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 space-y-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto shrink-0" />
            <div className="flex items-center gap-3 shrink-0">
              <Avatar name={noteTarget.name} url={noteTarget.avatar_url} size={36} />
              <div><p className="font-bold text-[var(--text)]">{noteTarget.name}</p><p className="text-xs text-[var(--text-muted)]">Send a note</p></div>
            </div>
            {(studentNotes[noteTarget.student_id] ?? []).length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                <p className="text-xs font-semibold text-[var(--text-muted)]">Previous notes</p>
                {(studentNotes[noteTarget.student_id] ?? []).map(n => (
                  <div key={n.id} className="rounded-xl px-3 py-2.5 text-sm" style={{ background: 'var(--surface-2)' }}>
                    <p className="text-[var(--text)]">{n.message}</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">{timeAgo(n.created_at)} {n.read_at ? '· Seen ✓' : '· Not seen yet'}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="shrink-0 space-y-3">
              <textarea placeholder={`Write a note to ${noteTarget.name}…`} value={noteText} onChange={e => setNoteText(e.target.value)} rows={3} autoFocus className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm resize-none focus:outline-none focus:border-[var(--primary)]" />
              <div className="flex gap-3">
                <button onClick={() => setNoteTarget(null)} className="flex-1 btn-ghost py-3 text-sm">Cancel</button>
                <button onClick={sendNote} disabled={sending || !noteText.trim()} className="flex-1 btn-primary py-3 disabled:opacity-50">{sending ? 'Sending…' : 'Send ✉️'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Announce modal */}
      {showAnnounce && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowAnnounce(false)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 space-y-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto shrink-0" />
            <div className="flex items-center justify-between shrink-0">
              <div>
                <p className="font-bold text-[var(--text)]">📢 Class Announcement</p>
                <p className="text-xs text-[var(--text-muted)]">Sent to all students in {classInfo?.name}</p>
              </div>
            </div>

            {/* Past announcements */}
            {announcements.length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                <p className="text-xs font-semibold text-[var(--text-muted)]">Past announcements</p>
                {announcements.map(a => (
                  <div key={a.id} className="rounded-xl px-3 py-2.5 flex items-start gap-2" style={{ background: 'var(--surface-2)' }}>
                    <p className="flex-1 text-sm text-[var(--text)]">{a.message}</p>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-[10px] text-[var(--text-muted)]">{timeAgo(a.created_at)}</p>
                      <button onClick={() => deleteAnnouncement(a.id)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors block">✕ Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Compose */}
            <div className="shrink-0 space-y-3">
              <textarea
                placeholder="Write an announcement for all students…"
                value={announceText}
                onChange={e => setAnnounceText(e.target.value)}
                rows={3}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm resize-none focus:outline-none focus:border-[var(--primary)]"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowAnnounce(false)} className="flex-1 btn-ghost py-3 text-sm">Cancel</button>
                <button onClick={postAnnouncement} disabled={announcing || !announceText.trim()} className="flex-1 btn-primary py-3 disabled:opacity-50">
                  {announcing ? 'Posting…' : 'Post 📢'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Target modal */}
      {targetStudent && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setTargetStudent(null)}>
          <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 space-y-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto shrink-0" />
            <div className="flex items-center gap-3 shrink-0">
              <Avatar name={targetStudent.name} url={targetStudent.avatar_url} size={36} />
              <div><p className="font-bold text-[var(--text)]">{targetStudent.name}</p><p className="text-xs text-[var(--text-muted)]">Set a target</p></div>
            </div>
            {(studentTargets[targetStudent.student_id] ?? []).length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                <p className="text-xs font-semibold text-[var(--text-muted)]">Active targets</p>
                {(studentTargets[targetStudent.student_id] ?? []).map(t => {
                  const due = dueDateLabel(t.due_date);
                  return (
                    <div key={t.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
                      <span className="text-base mt-0.5 shrink-0">{t.completed_at ? '✅' : '🎯'}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm text-[var(--text)] ${t.completed_at ? 'line-through opacity-50' : ''}`}>{t.title}</p>
                        {due && <p className={`text-[10px] mt-0.5 font-medium ${due.overdue && !t.completed_at ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}>{t.completed_at ? `Completed ${timeAgo(t.completed_at)}` : due.text}</p>}
                        {t.completed_at && !due && <p className="text-[10px] mt-0.5 text-[var(--text-muted)]">Completed {timeAgo(t.completed_at)}</p>}
                      </div>
                      <button onClick={() => deleteTarget(t.id)} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors shrink-0 mt-1" aria-label="Delete target">✕</button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="shrink-0 space-y-3">
              <input type="text" placeholder='e.g. "Complete A1 Unit 5 by Friday"' value={targetTitle} onChange={e => setTargetTitle(e.target.value)} autoFocus className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]" />
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">Due date (optional)</label>
                <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--primary)]" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setTargetStudent(null)} className="flex-1 btn-ghost py-3 text-sm">Cancel</button>
                <button onClick={addTarget} disabled={settingTarget || !targetTitle.trim()} className="flex-1 btn-primary py-3 disabled:opacity-50">{settingTarget ? 'Setting…' : 'Set target 🎯'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Streak calendar modal */}
      {streakModal && (() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().slice(0, 10);
        const { year, month } = calendarMonth;
        const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDow = new Date(year, month, 1).getDay();
        const startOffset = firstDow === 0 ? 6 : firstDow - 1;
        const rows: (number | null)[][] = [];
        let dn = 1 - startOffset;
        while (dn <= daysInMonth) {
          const row: (number | null)[] = [];
          for (let c = 0; c < 7; c++) { row.push(dn >= 1 && dn <= daysInMonth ? dn : null); dn++; }
          rows.push(row);
        }
        const ds = (d: number) => `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isToday = (d: number) => ds(d) === todayStr;
        const isStudied = (d: number) => studyDates.has(ds(d));
        const isFuture = (d: number) => new Date(year, month, d) > today;
        const nowMonth = new Date(); nowMonth.setDate(1); nowMonth.setHours(0,0,0,0);
        const thisMonth = new Date(year, month, 1);
        const canNext = thisMonth < nowMonth;
        const prev = () => setCalendarMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 });
        const next = () => setCalendarMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 });
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setStreakModal(null)}>
            <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
              <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto mb-4" />
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={streakModal.name} url={streakModal.avatar_url} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-[var(--text)] truncate">{streakModal.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Study calendar</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl font-black text-orange-400">🔥 {streakModal.streak}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">day streak</p>
                </div>
              </div>
              {streakLoading ? (
                <div className="flex justify-center py-8"><div className="text-3xl animate-bounce">📅</div></div>
              ) : (
                <div className="bg-[var(--surface-2)] rounded-2xl p-4">
                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={prev} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--border)] text-[var(--text)] text-lg font-bold" aria-label="Previous month">‹</button>
                    <p className="font-bold text-sm text-[var(--text)]">{MONTH_NAMES[month]} {year}</p>
                    <button onClick={next} disabled={!canNext} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--border)] text-[var(--text)] text-lg font-bold disabled:opacity-25" aria-label="Next month">›</button>
                  </div>
                  {/* Day headers */}
                  <div className="grid grid-cols-7 mb-2">
                    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                      <div key={d} className="text-center text-[10px] font-semibold text-[var(--text-muted)]">{d}</div>
                    ))}
                  </div>
                  {/* Rows */}
                  <div className="space-y-1">
                    {rows.map((row, ri) => (
                      <div key={ri} className="grid grid-cols-7 gap-1">
                        {row.map((day, ci) => day === null ? <div key={ci} /> : (
                          <div key={ci} className="aspect-square flex items-center justify-center rounded-xl" style={{
                            background: isStudied(day) ? 'var(--primary)' : 'transparent',
                            border: isToday(day) ? '2px solid var(--primary)' : 'none',
                            opacity: isFuture(day) ? 0.25 : 1,
                          }}>
                            <span className="text-xs font-bold" style={{ color: isStudied(day) ? '#fff' : isFuture(day) ? 'var(--text-muted)' : 'var(--text)' }}>{day}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-5 mt-4 pt-3 border-t border-[var(--border)]">
                    <div className="flex items-center gap-1.5">
                      <div style={{ width: 14, height: 14, borderRadius: 4, border: '2px solid var(--primary)' }} />
                      <span className="text-[10px] text-[var(--text-muted)]">Today</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--primary)' }} />
                      <span className="text-[10px] text-[var(--text-muted)]">Studied</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Collection drill-down modal */}
      {collectionModal && (() => {
        const c = collectionModal.color;
        const learnedCount = unitRows.filter(r => r.learn_done).length;
        const pct = collectionModal.total > 0 ? learnedCount / collectionModal.total : 0;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setCollectionModal(null)}>
            <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
              {/* Colored header */}
              <div className="p-5 shrink-0 rounded-t-3xl" style={{ background: `linear-gradient(135deg, ${c}18 0%, transparent 70%)` }}>
                <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto mb-4" />
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={collectionModal.student.name} url={collectionModal.student.avatar_url} size={42} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[var(--text)] truncate">{collectionModal.student.name}</p>
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1" style={{ background: `${c}22`, color: c }}>{collectionModal.label}</span>
                  </div>
                  {!unitLoading && (
                    <div className="text-right shrink-0">
                      <p style={{ fontSize: 24, fontWeight: 900, color: c, lineHeight: 1 }}>
                        {learnedCount}<span className="text-sm font-normal text-[var(--text-muted)]">/{collectionModal.total}</span>
                      </p>
                      <p className="text-[9px] text-[var(--text-muted)] mt-0.5">learned</p>
                    </div>
                  )}
                </div>
                {!unitLoading && (
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${c}20` }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.round(pct * 100)}%`, background: c, transition: 'width 0.4s ease' }} />
                  </div>
                )}
              </div>
              {/* Unit grid */}
              <div className="overflow-y-auto flex-1 px-4 pb-8 pt-3">
                {unitLoading ? (
                  <div className="flex justify-center py-8"><div className="text-3xl animate-bounce">📊</div></div>
                ) : (() => {
                  const latestDoneUnit = unitRows.filter(r => r.completed_at).sort((a, b) => (b.completed_at! > a.completed_at! ? 1 : -1))[0];
                  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });
                  return (
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: collectionModal.total }, (_, i) => {
                        const unit = unitRows.find(r => r.day_number === i + 1);
                        const learnDone = unit?.learn_done ?? false;
                        const flashDone = unit?.flashcard_done ?? false;
                        const quizDone = unit?.quiz_done ?? false;
                        const allDone = learnDone && flashDone && quizDone;
                        const anyDone = learnDone || flashDone || quizDone;
                        const isLatest = allDone && latestDoneUnit?.day_number === i + 1;
                        return (
                          <div key={i + 1} className="relative flex flex-col items-center gap-1.5 pt-4 pb-2.5 rounded-2xl" style={{
                            background: allDone ? `${c}25` : 'var(--surface-2)',
                            border: `2px solid ${allDone ? c : 'transparent'}`,
                            boxShadow: isLatest ? `0 0 12px ${c}55` : 'none',
                          }}>
                            {/* Corner check badge */}
                            {allDone && (
                              <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white" style={{ background: c }}>✓</div>
                            )}
                            {/* Latest chip */}
                            {isLatest && (
                              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[8px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap text-white" style={{ background: c }}>LATEST</div>
                            )}
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black" style={{
                              background: allDone ? c : anyDone ? `${c}25` : 'var(--border)',
                              color: allDone ? '#fff' : anyDone ? c : 'var(--text-muted)',
                            }}>
                              {allDone ? '✓' : i + 1}
                            </div>
                            <div className="flex gap-0.5">
                              {[{ e: '📖', d: learnDone }, { e: '🃏', d: flashDone }, { e: '🧠', d: quizDone }].map(({ e, d }, ei) => (
                                <span key={ei} className="text-[11px]" style={{ opacity: d ? 1 : 0.2 }}>{e}</span>
                              ))}
                            </div>
                            {allDone && unit?.completed_at && (
                              <p className="text-[9px] font-semibold" style={{ color: c }}>{fmtDate(unit.completed_at)}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
