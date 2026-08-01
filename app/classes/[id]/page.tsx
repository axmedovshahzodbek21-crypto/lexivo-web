'use client';
import { PageLoader, SectionLoader } from '@/components/Loader';
import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

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
type Tab = 'students' | 'activity' | 'radar' | 'analytics';

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

function AnalyticsTab({
  analyticsData, activeStudents, progressPoints, loading, students, collections, digestText, digestLoading, onDigest,
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
  const { user } = useAuth();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [collections, setCollections] = useState<CollectionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [notTeacher, setNotTeacher] = useState(false);
  const [tab, setTab] = useState<Tab>('students');

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

  const load = async () => {
    if (!user || !id) return;
    setLoading(true);
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
      <button onClick={() => router.back()} className="btn-primary">Go back</button>
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

  return (
    <div className="flex flex-col min-h-screen pb-24 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label="Go back">←</button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-[var(--text)] truncate">{classInfo?.name ?? 'Class Dashboard'}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-[var(--text-muted)]">Join code:</span>
            <code className="text-xs font-bold text-[var(--primary)]">{classInfo?.join_code}</code>
            <button onClick={copyCode} className="text-sm hover:scale-110 transition-transform" aria-label="Copy join code">{copied ? '✅' : '📋'}</button>
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <p className="text-xl font-black text-[var(--primary)] leading-tight">{visibleStudents.length}<span className="text-sm text-[var(--text-muted)] font-normal">/{students.length}</span></p>
          <p className="text-[10px] text-[var(--text-muted)]">students</p>
          <div className="flex gap-1.5">
            <button onClick={() => router.push(`/classes/${id}/words`)} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-bg)] transition-colors">
              📝 Words
            </button>
            <button onClick={() => { setShowAnnounce(true); setAnnounceText(''); }} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-bg)] transition-colors">
              📢 Announce
            </button>
            <button onClick={load} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-bg)] transition-colors">
              🔄 Refresh
            </button>
            {students.length > 0 && (
              <button onClick={exportCSV} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-bg)] transition-colors">
                📥 CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      {!loading && (
        <div className="flex border-b border-[var(--border)]">
          {(['students', 'activity', 'radar', 'analytics'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                tab === t
                  ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {t === 'students' ? '👥' : t === 'activity' ? '📡' : t === 'radar' ? '🎯' : '📊'}
              {' '}{t === 'students' ? 'Students' : t === 'activity' ? 'Activity' : t === 'radar' ? 'Radar' : 'Analytics'}
            </button>
          ))}
        </div>
      )}

      {/* Class stats bar — students tab only */}
      {!loading && tab === 'students' && classStats && (
        <div className="grid grid-cols-4 divide-x divide-[var(--border)] border-b border-[var(--border)]">
          {[
            { label: 'Total XP', value: classStats.totalXP.toLocaleString(), icon: '⚡' },
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
                        <p className="text-sm font-black text-[var(--primary)]">{s.xp} XP</p>
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
