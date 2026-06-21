'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

// Filled units per collection
const COLLECTION_TOTALS: Record<string, number> = { A1: 17, A2: 12, B1: 14 };

interface StudentRow {
  student_id: string;
  name: string;
  avatar_url: string | null;
  xp: number;
  streak: number;
  last_study_date: string | null;
  total_words: number;
  a1_learned: number;
  a2_learned: number;
  b1_learned: number;
}

interface ClassInfo {
  id: string;
  name: string;
  join_code: string;
  teacher_id: string;
}

function Avatar({ name, url, size = 38 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: 'var(--primary)', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: size * 0.4,
      }}
    >
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

export default function ClassDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [notTeacher, setNotTeacher] = useState(false);

  const load = async () => {
    if (!user || !id) return;
    setLoading(true);

    const { data: cls } = await supabase
      .from('classes')
      .select('*')
      .eq('id', id)
      .single();

    if (!cls || cls.teacher_id !== user.id) {
      setNotTeacher(true);
      setLoading(false);
      return;
    }
    setClassInfo(cls);

    const { data } = await supabase.rpc('get_class_dashboard', { p_class_id: id });
    setStudents((data as StudentRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); else setLoading(false); }, [user, id]);

  const copyCode = () => {
    if (!classInfo) return;
    navigator.clipboard.writeText(classInfo.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const removeStudent = async (studentId: string) => {
    if (!confirm('Remove this student from the class?')) return;
    await supabase.from('class_members').delete()
      .eq('class_id', id).eq('student_id', studentId);
    load();
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
        <div className="text-5xl">🔒</div>
        <p className="text-[var(--text-muted)]">Sign in to view this class</p>
        <button onClick={() => router.push('/login')} className="btn-primary">Sign in</button>
      </div>
    );
  }

  if (notTeacher) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
        <div className="text-5xl">⛔</div>
        <p className="font-bold text-[var(--text)]">Not your class</p>
        <p className="text-sm text-[var(--text-muted)]">Only the teacher can view this dashboard</p>
        <button onClick={() => router.back()} className="btn-primary">Go back</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-24 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg shrink-0"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-[var(--text)] truncate">{classInfo?.name ?? 'Class Dashboard'}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-[var(--text-muted)]">Join code:</span>
            <code className="text-xs font-bold text-[var(--primary)]">{classInfo?.join_code}</code>
            <button onClick={copyCode} className="text-sm hover:scale-110 transition-transform" title="Copy">
              {copied ? '✅' : '📋'}
            </button>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-black text-[var(--primary)]">{students.length}</p>
          <p className="text-[10px] text-[var(--text-muted)]">students</p>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="text-4xl animate-bounce">📊</div>
          </div>
        ) : students.length === 0 ? (
          <div className="card text-center py-12 space-y-3">
            <div className="text-5xl">👥</div>
            <p className="font-bold text-[var(--text)]">No students yet</p>
            <p className="text-sm text-[var(--text-muted)]">Share this code with your students:</p>
            <div className="flex items-center justify-center gap-2">
              <code className="text-xl font-black text-[var(--primary)] bg-[var(--primary-bg)] px-5 py-2.5 rounded-xl tracking-wider">
                {classInfo?.join_code}
              </code>
              <button onClick={copyCode} className="text-2xl">{copied ? '✅' : '📋'}</button>
            </div>
            <p className="text-xs text-[var(--text-muted)]">Students enter this code on the Classes page</p>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map((s, i) => (
              <div key={s.student_id} className="card space-y-3">
                {/* Student header */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[var(--text-muted)] w-5 text-center shrink-0">{i + 1}</span>
                  <Avatar name={s.name} url={s.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[var(--text)] truncate">{s.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">Last active: {lastActiveLabel(s.last_study_date)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-[var(--primary)]">{s.xp} XP</p>
                    <p className="text-[10px] text-[var(--text-muted)]">🔥 {s.streak} · 📚 {s.total_words}</p>
                  </div>
                </div>

                {/* Unit progress bars */}
                <div className="grid grid-cols-3 gap-3 pl-8">
                  {[
                    { label: 'A1', done: s.a1_learned, color: '#2ECC71' },
                    { label: 'A2', done: s.a2_learned, color: '#27AE60' },
                    { label: 'B1', done: s.b1_learned, color: '#3498DB' },
                  ].map(({ label, done, color }) => (
                    <div key={label}>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] mb-1">{label}</p>
                      <ProgressBar done={done} total={COLLECTION_TOTALS[label]} color={color} />
                    </div>
                  ))}
                </div>

                {/* Remove button */}
                <div className="pl-8">
                  <button
                    onClick={() => removeStudent(s.student_id)}
                    className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                  >
                    Remove from class
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
