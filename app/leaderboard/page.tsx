'use client';
import { PageLoader, SectionLoader } from '@/components/Loader';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { localDateStr } from '@/lib/storage';

interface LeaderboardEntry {
  user_id: string;
  name: string;
  avatar_url: string | null;
  xp: number;
  streak: number;
  last_study_date: string | null;
  today_count: number;
  total_learned: number;
  study_days: string[] | null;
}

const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_BG = [
  'rgba(255,215,0,0.12)',
  'rgba(192,192,192,0.12)',
  'rgba(205,127,50,0.12)',
];
const MEDAL_BORDER = [
  'rgba(255,215,0,0.4)',
  'rgba(192,192,192,0.35)',
  'rgba(205,127,50,0.35)',
];

function todayStr() {
  return localDateStr();
}

function Avatar({ name, url, size = 40 }: { name: string; url: string | null; size?: number }) {
  const initial = (name || '?').charAt(0).toUpperCase();
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
      {initial}
    </div>
  );
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const today = todayStr();

  const load = async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.rpc('get_leaderboard');
    if (err) {
      setError('Could not load leaderboard. Please try again.');
    } else {
      setEntries((data as LeaderboardEntry[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const myIndex = user ? entries.findIndex(e => e.user_id === user.id) : -1;
  const [selected, setSelected] = useState<LeaderboardEntry | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'starred'>('all');
  const [calMonth, setCalMonth] = useState<{ year: number; month: number }>(() => {
    const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() };
  });

  useEffect(() => {
    if (!user) return;
    supabase.from('saved_users').select('saved_user_id').eq('user_id', user.id)
      .then(({ data }) => { if (data) setSavedIds(new Set(data.map((r: {saved_user_id: string}) => r.saved_user_id))); });
  }, [user]);

  useEffect(() => {
    const n = new Date(); setCalMonth({ year: n.getFullYear(), month: n.getMonth() });
  }, [selected?.user_id]);

  const toggleSave = async (targetId: string) => {
    if (!user) return;
    const isSaved = savedIds.has(targetId);
    setSavedIds(prev => { const next = new Set(prev); isSaved ? next.delete(targetId) : next.add(targetId); return next; });
    if (isSaved) {
      await supabase.from('saved_users').delete().eq('user_id', user.id).eq('saved_user_id', targetId);
    } else {
      await supabase.from('saved_users').insert({ user_id: user.id, saved_user_id: targetId });
    }
  };

  return (
    <div className="flex flex-col min-h-screen animate-fade-in pb-24">
      {/* Profile modal */}
      {selected && (() => {
        const studiedSet = new Set(selected.study_days ?? []);
        const totalStudyDays = selected.study_days?.length ?? 0;
        const avgPerDay = totalStudyDays === 0 ? 0 : Math.round(selected.total_learned / totalStudyDays);
        const { year: cYear, month: cMonth } = calMonth;
        const daysInCMonth = new Date(cYear, cMonth + 1, 0).getDate();
        const activeDays = Array.from({ length: daysInCMonth }, (_, i) => {
          const d = i + 1;
          return `${cYear}-${String(cMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }).filter(d => studiedSet.has(d)).length;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setSelected(null)}>
            <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl p-5 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
              <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto" />
              <div className="flex flex-col items-center gap-2">
                <Avatar name={selected.name} url={selected.avatar_url} size={56} />
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-[var(--text)]">{selected.name}</p>
                  {user && selected.user_id !== user.id && (
                    <button onClick={() => toggleSave(selected.user_id)} className="text-2xl leading-none">
                      {savedIds.has(selected.user_id) ? '⭐' : '☆'}
                    </button>
                  )}
                </div>
              </div>
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { emoji: '📖', value: selected.total_learned, label: 'Words learned', color: '#3498DB' },
                  { emoji: '🔥', value: selected.streak,        label: 'Day streak',    color: '#E67E22' },
                ].map(s => (
                  <div key={s.label} className="flex flex-col items-center py-3 px-2 rounded-xl border" style={{ background: `${s.color}14`, borderColor: `${s.color}33` }}>
                    <span className="text-xl">{s.emoji}</span>
                    <span className="text-lg font-black mt-0.5" style={{ color: s.color }}>{s.value}</span>
                    <span className="text-[10px] text-[var(--text-muted)] text-center">{s.label}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { emoji: '📊', value: `~${avgPerDay}`, label: 'Words / day',      color: '#9B59B6' },
                  { emoji: '📅', value: `${activeDays}/${daysInCMonth}`, label: 'Days this month', color: '#E67E22' },
                ].map(s => (
                  <div key={s.label} className="flex flex-col items-center py-3 px-2 rounded-xl border" style={{ background: `${s.color}14`, borderColor: `${s.color}33` }}>
                    <span className="text-xl">{s.emoji}</span>
                    <span className="text-lg font-black mt-0.5" style={{ color: s.color }}>{s.value}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{s.label}</span>
                  </div>
                ))}
              </div>
              {/* Monthly calendar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setCalMonth(m => { const d = new Date(m.year, m.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-base text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
                  >‹</button>
                  <p className="text-xs font-bold text-[var(--text-muted)]">
                    {new Date(cYear, cMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                  <button
                    onClick={() => setCalMonth(m => { const d = new Date(m.year, m.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-base text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
                  >›</button>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                    <div key={d} className="text-center text-[9px] font-semibold text-[var(--text-muted)]">{d}</div>
                  ))}
                </div>
                {(() => {
                  const firstDay = new Date(cYear, cMonth, 1).getDay();
                  const todayDate = todayStr();
                  const cells: (number | null)[] = Array(firstDay).fill(null);
                  for (let d = 1; d <= daysInCMonth; d++) cells.push(d);
                  return (
                    <div className="grid grid-cols-7 gap-y-1">
                      {cells.map((d, i) => {
                        if (!d) return <div key={`e-${i}`} />;
                        const dateStr = `${cYear}-${String(cMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const studied = studiedSet.has(dateStr);
                        const isToday = dateStr === todayDate;
                        return (
                          <div key={d} className="flex items-center justify-center py-0.5">
                            <div className="w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-semibold"
                              style={{
                                background: studied ? '#2ECC71' : 'transparent',
                                color: studied ? 'white' : isToday ? 'var(--primary)' : 'var(--text-muted)',
                                border: isToday && !studied ? '1.5px solid var(--primary)' : 'none',
                              }}>
                              {d}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-[#2ECC71]" /><span className="text-[10px] text-[var(--text-muted)]">Studied</span></div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="w-full py-3 rounded-xl bg-[var(--surface-2)] text-sm font-semibold text-[var(--text)]">Close</button>
            </div>
          </div>
        );
      })()}
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg"
        >←</button>
        <div className="flex-1">
          <h1 className="font-bold text-[var(--text)]">🏆 Leaderboard</h1>
          <p className="text-xs text-[var(--text-muted)]">Top learners by total XP</p>
        </div>
        <button
          onClick={load}
          className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-lg hover:bg-[var(--primary-bg)] transition-colors"
          title="Refresh"
        >↻</button>
      </div>

      {/* All / Starred toggle */}
      <div className="flex gap-2 px-4 pt-3">
        {(['all', 'starred'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${filter === f ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
          >
            {f === 'all' ? 'All' : '⭐ Starred'}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <SectionLoader />
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-12">
            <p className="text-[var(--text-muted)] text-sm">{error}</p>
            <button onClick={load} className="mt-4 btn-primary text-sm">Try again</button>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">🏆</div>
            <p className="font-bold text-[var(--text)]">No entries yet</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">Be the first on the leaderboard!</p>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (() => {
          const visible = filter === 'starred' ? entries.filter(e => savedIds.has(e.user_id)) : entries;
          return (
          <>
            {filter === 'starred' && visible.length === 0 && (
              <div className="text-center py-20">
                <div className="text-5xl mb-3">⭐</div>
                <p className="font-bold text-[var(--text)]">No starred users yet</p>
                <p className="text-sm text-[var(--text-muted)] mt-1">Tap a user's profile and star them to follow their progress</p>
              </div>
            )}
            {/* Top 3 podium */}
            {visible.length >= 3 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[visible[1], visible[0], visible[2]].map((e, col) => {
                  const rank = col === 0 ? 2 : col === 1 ? 1 : 3;
                  const isMe = user && e.user_id === user.id;
                  return (
                    <div
                      key={e.user_id}
                      onClick={() => setSelected(e)}
                      className={`flex flex-col items-center rounded-2xl p-3 border transition-all cursor-pointer hover:opacity-80 ${col === 1 ? 'py-5' : 'py-3'}`}
                      style={{
                        background: MEDAL_BG[rank - 1],
                        borderColor: isMe ? 'var(--primary)' : MEDAL_BORDER[rank - 1],
                        boxShadow: isMe ? '0 0 0 2px var(--primary)' : undefined,
                      }}
                    >
                      <div className="text-2xl mb-1">{MEDAL[rank - 1]}</div>
                      <Avatar name={e.name} url={e.avatar_url} size={col === 1 ? 44 : 36} />
                      <p className="text-xs font-bold text-[var(--text)] mt-2 text-center truncate w-full">
                        {savedIds.has(e.user_id) ? '⭐ ' : ''}{e.name}{isMe ? ' 👤' : ''}
                      </p>
                      <p className="text-xs font-black mt-0.5" style={{ color: 'var(--primary)' }}>
                        {e.xp.toLocaleString()} XP
                      </p>
                      {e.streak > 0 && (
                        <p className="text-[10px] text-[var(--text-muted)]">🔥 {e.streak}</p>
                      )}
                      {e.last_study_date === today && (
                        <span className="mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)' }}>
                          TODAY
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Ranked list (4 onwards, or all if < 3) */}
            <div className="space-y-2">
              {visible.slice(visible.length >= 3 ? 3 : 0).map((e, i) => {
                const rank = (visible.length >= 3 ? 3 : 0) + i + 1;
                const isMe = user && e.user_id === user.id;
                return (
                  <div
                    key={e.user_id}
                    onClick={() => setSelected(e)}
                    className="flex items-center gap-3 rounded-2xl p-3 border transition-all cursor-pointer hover:opacity-80"
                    style={{
                      background: isMe ? 'var(--primary-bg)' : 'var(--surface)',
                      borderColor: isMe ? 'var(--primary)' : 'var(--border)',
                      boxShadow: isMe ? '0 0 0 1.5px var(--primary)' : undefined,
                    }}
                  >
                    <span className="w-7 text-center text-sm font-bold text-[var(--text-muted)]">{rank}</span>
                    <Avatar name={e.name} url={e.avatar_url} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {savedIds.has(e.user_id) && <span className="text-sm">⭐</span>}
                        <p className="font-bold text-sm text-[var(--text)] truncate">{e.name}</p>
                        {isMe && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--primary)', color: 'white' }}>YOU</span>}
                        {e.last_study_date === today && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)' }}>TODAY</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        {e.xp.toLocaleString()} XP{e.streak > 0 ? ` · 🔥 ${e.streak}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Your rank if outside top list */}
            {user && myIndex === -1 && (
              <div className="mt-4 rounded-2xl p-4 border border-dashed border-[var(--border)] text-center space-y-1">
                <p className="text-sm font-semibold text-[var(--text)]">You're not on the leaderboard yet</p>
                <p className="text-xs text-[var(--text-muted)]">Earn XP by learning words to appear here</p>
              </div>
            )}

            {!user && (
              <div className="mt-4 rounded-2xl p-4 border border-dashed border-[var(--border)] text-center space-y-2">
                <p className="text-sm font-semibold text-[var(--text)]">Sign in to appear on the leaderboard</p>
                <button onClick={() => router.push('/login')} className="btn-primary text-sm">Sign in</button>
              </div>
            )}

            <p className="text-center text-xs text-[var(--text-muted)] pt-2">
              Top 100 · ranked by total XP · opt out in Settings
            </p>
          </>
          );
        })()}
      </div>
    </div>
  );
}

