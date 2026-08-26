'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { displayXP } from '@/lib/storage';
import { classGradientColors } from '@/lib/class-gradient';

interface LeaderboardRow {
  student_id: string;
  name: string;
  avatar_url: string | null;
  xp: number;
  streak: number;
  total_words: number;
}

const AVATAR_COLORS = [
  '#6366f1', '#ec4899', '#22c55e', '#3b82f6',
  '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4',
];
function avatarColor(id: string) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function Avatar({ row }: { row: LeaderboardRow }) {
  if (row.avatar_url) {
    return <img src={row.avatar_url} alt={row.name} className="w-full h-full object-cover rounded-full" />;
  }
  return (
    <span className="text-white font-black text-sm leading-none">
      {row.name.charAt(0).toUpperCase()}
    </span>
  );
}

// Keyed by `${classId}::${userId}`, not classId alone — a bare classId key
// meant a removed student (or a different account on the same browser)
// could briefly see the previous viewer's cached leaderboard rendered
// before the membership check below resolves.
const _classLbCache = new Map<string, LeaderboardRow[]>();

const MEDALS = ['🥇', '🥈', '🥉'];
const PODIUM_HEIGHTS = [170, 120, 90]; // 1st, 2nd, 3rd in px
const PODIUM_COLORS = ['#f59e0b', '#94a3b8', '#cd7f32']; // gold, silver, bronze
const PODIUM_ORDER = [1, 0, 2]; // display order: 2nd, 1st, 3rd

export default function ClassLeaderboardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [animated, setAnimated] = useState(false);
  const [className, setClassName] = useState('');
  const [notMember, setNotMember] = useState(false);

  useEffect(() => {
    if (!user) return;
    const cacheKey = `${id}::${user.id}`;
    const cached = _classLbCache.get(cacheKey);
    if (cached) {
      setRows(cached);
      setLoading(false);
      setTimeout(() => setAnimated(true), 60);
    } else {
      setLoading(true);
      setAnimated(false);
    }

    (async () => {
      // The leaderboard RPC is trusted to scope rows to p_class_id, but
      // nothing before this checked the *caller* is actually in that class
      // — any signed-in user could load another class's leaderboard by
      // editing the URL. Verify membership client-side too, matching the
      // pattern used on the words/homework pages.
      const { data: cls } = await supabase.from('classes').select('name, teacher_id').eq('id', id).maybeSingle();
      if (!cls) { setNotMember(true); setLoading(false); return; }
      if (cls.teacher_id !== user.id) {
        const { data: membership } = await supabase.from('class_members').select('id').eq('class_id', id).eq('student_id', user.id).maybeSingle();
        if (!membership) { setNotMember(true); setLoading(false); return; }
      }

      const { data } = await supabase.rpc('get_class_leaderboard', { p_class_id: id }).limit(200);
      const rows = (data as LeaderboardRow[]) ?? [];
      _classLbCache.set(cacheKey, rows);
      setRows(rows);
      setClassName(cls.name ?? '');
      setLoading(false);
      if (!cached) setTimeout(() => setAnimated(true), 60);
    })();
  }, [id, user]);

  if (notMember) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
        <div className="text-5xl">⛔</div>
        <p className="font-bold text-[var(--text)]">You&apos;re not in this class</p>
        <button onClick={() => router.push('/classes')} className="btn-primary">Go back</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { gradient: _grad, glow: _glow } = classGradientColors(id as string);

  const lbHero = (
    <div className={`bg-gradient-to-br ${_grad} px-5 pt-5 pb-7 relative`}
      style={{ boxShadow: `0 8px 32px ${_glow}cc` }}>
      <div style={{ position: 'absolute', right: 16, top: 8, fontSize: 80, fontWeight: 900, color: 'rgba(255,255,255,0.06)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>🏆</div>
      <button onClick={() => router.push(`/classes/${id}/home`)} className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium mb-4 transition-colors">← Back</button>
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
          style={{ background: 'rgba(255,255,255,0.18)', boxShadow: '0 4px 0 rgba(0,0,0,0.15)' }}>🏆</div>
        <div>
          <p className="text-xs font-black text-white/50 uppercase tracking-widest mb-0.5">{className || '...'}</p>
          <h1 className="text-2xl font-black text-white leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>Leaderboard</h1>
          <p className="text-sm text-white/60 mt-1">Ranked by XP earned in class</p>
        </div>
      </div>
    </div>
  );

  if (rows.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        {lbHero}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
          <span className="text-5xl">🏆</span>
          <h1 className="text-lg font-bold text-[var(--text)]">No rankings yet</h1>
          <p className="text-sm text-[var(--text-muted)]">Students need to earn XP to appear here</p>
        </div>
      </div>
    );
  }

  const myRank = rows.findIndex(r => r.student_id === user?.id) + 1;
  const top3 = rows.slice(0, 3);

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      {lbHero}
      {/* My position banner (if outside top 3) */}
      {myRank > 3 && (
        <div className="mx-4 mt-4 p-3 rounded-2xl bg-[var(--primary-bg)] border border-[var(--primary)]/30 flex items-center gap-3">
          <span className="text-2xl">🎓</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--text-muted)]">Your position</p>
            <p className="text-lg font-black text-[var(--primary)]">#{myRank} in class</p>
          </div>
          <p className="text-base font-bold text-[var(--primary)]">{displayXP(rows[myRank - 1]?.xp ?? 0)} XP</p>
        </div>
      )}

      {/* Podium */}
      {top3.length >= 2 && (
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-end justify-center gap-1.5" style={{ height: 290 }}>
            {PODIUM_ORDER.map(rankIdx => {
              const row = top3[rankIdx];
              if (!row) return <div key={rankIdx} className="flex-1" />;
              const isMe = row.student_id === user?.id;
              const targetH = PODIUM_HEIGHTS[rankIdx];
              const barColor = isMe ? 'var(--primary)' : PODIUM_COLORS[rankIdx];
              // CSS variables can't be used in hex-opacity shorthand — use fixed hex for glow
              const glowColor = isMe ? '#6c63ff' : PODIUM_COLORS[rankIdx];
              const medal = MEDALS[rankIdx];

              return (
                <div key={rankIdx} className="flex-1 flex flex-col items-center justify-end">
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                    style={{
                      backgroundColor: avatarColor(row.student_id),
                      border: isMe ? '2.5px solid var(--primary)' : 'none',
                      boxShadow: `0 4px 12px ${glowColor}55`,
                    }}
                  >
                    <Avatar row={row} />
                  </div>
                  {/* Name */}
                  <p
                    className="text-[11px] font-bold mt-1 truncate max-w-full px-1 text-center"
                    style={{ color: isMe ? 'var(--primary)' : 'var(--text)' }}
                  >
                    {row.name.split(' ')[0]}
                  </p>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)]">{displayXP(row.xp)} XP</p>
                  <span className="text-xl mb-1">{medal}</span>
                  {/* Animated bar */}
                  <div
                    className="w-full rounded-t-xl flex items-start justify-center pt-2 font-black text-white text-lg"
                    style={{
                      backgroundColor: barColor,
                      height: animated ? targetH : 0,
                      transition: 'height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      boxShadow: `0 -4px 16px ${glowColor}55`,
                    }}
                  >
                    {rankIdx + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full ranked list */}
      <div className="px-4 pb-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">
          All Rankings
        </h2>
        <div className="space-y-2">
          {rows.map((row, i) => {
            const rank = i + 1;
            const isMe = row.student_id === user?.id;
            return (
              <div
                key={row.student_id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-colors ${
                  isMe
                    ? 'bg-[var(--primary-bg)] border-[var(--primary)]/40'
                    : 'bg-[var(--surface)] border-[var(--border)]'
                }`}
              >
                {/* Rank */}
                <div className="w-8 flex justify-center shrink-0">
                  {rank <= 3
                    ? <span className="text-xl">{MEDALS[rank - 1]}</span>
                    : <span className="text-sm font-bold text-[var(--text-muted)]">#{rank}</span>}
                </div>
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ backgroundColor: avatarColor(row.student_id) }}
                >
                  <Avatar row={row} />
                </div>
                {/* Name + streak */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-bold truncate"
                    style={{ color: isMe ? 'var(--primary)' : 'var(--text)' }}
                  >
                    {row.name}
                  </p>
                  <button
                    className="text-xs text-[var(--text-muted)] hover:underline underline-offset-2 text-left"
                    onClick={() => router.push(`/classes/${id}/streak?userId=${row.student_id}&userName=${encodeURIComponent(row.name)}`)}
                  >
                    🔥 {row.streak} day streak
                  </button>
                </div>
                {/* XP */}
                <p
                  className="text-sm font-black shrink-0"
                  style={{ color: isMe ? 'var(--primary)' : 'var(--text)' }}
                >
                  {displayXP(row.xp)} XP
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
