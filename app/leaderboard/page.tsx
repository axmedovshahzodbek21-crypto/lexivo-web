'use client';
import { SectionLoader } from '@/components/Loader';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { localDateStr, displayXP, getSettings, saveSettings } from '@/lib/storage';
import { pushStats, pushSettings } from '@/lib/sync';
import { avatarColor } from '@/lib/class-gradient';

interface LeaderboardEntry {
  user_id: string;
  name: string;
  avatar_url: string | null;
  xp: number;
  streak: number;
  last_study_date: string | null;
  today_count: number;
  total_learned: number;
}

// Fetched separately, only for the one profile a viewer opens — the bulk
// get_leaderboard() RPC used to include these day-by-day arrays for every
// row (up to 100 users' full history shipped to every visitor), even
// though the UI only ever renders them for a single opened profile card.
interface LeaderboardProfileHistory {
  study_days: string[];
  review_days: string[];
  word_goal_days: string[];
}


function todayStr() {
  return localDateStr();
}

function Avatar({ name, url, size = 40, userId }: { name: string; url: string | null; size?: number; userId: string }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  const bg = avatarColor(userId);
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
        background: bg, color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: size * 0.4,
      }}
    >
      {initial}
    </div>
  );
}

let _leaderboardCache: LeaderboardEntry[] | null = null;

export default function LeaderboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const today = todayStr();

  const [syncError, setSyncError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    if (_leaderboardCache) {
      setEntries(_leaderboardCache);
      setLoading(false);
    } else {
      setLoading(true);
      setError('');
      setSyncError('');
    }
    try {
      await Promise.all([pushStats(), pushSettings()]);
    } catch (e) {
      setSyncError(String(e));
    }
    const { data, error: err } = await supabase.rpc('get_leaderboard').limit(500);
    if (err) {
      if (!_leaderboardCache) setError('Could not load leaderboard. Please try again.');
    } else {
      _leaderboardCache = (data as LeaderboardEntry[]) ?? [];
      setEntries(_leaderboardCache);
    }
    setLoading(false);
  };

  const manualSync = async () => {
    if (!user) return;
    setSyncing(true);
    saveSettings({ ...getSettings(), showOnLeaderboard: true });
    await load();
    setSyncing(false);
  };

  useEffect(() => { load(); }, []);

  // When auth resolves after the initial load(), upsert show_on_leaderboard
  // then re-fetch so the user appears without a manual refresh
  useEffect(() => {
    if (!user) return;
    if (getSettings().showOnLeaderboard === false) return;
    (async () => {
      // No settings_updated_at here — avoids triggering pullAll to overwrite local settings
      const { error: upsertErr } = await supabase.from('user_data').upsert({
        id: user.id,
        show_on_leaderboard: true,
      });
      if (upsertErr) {
        // This upsert is the entire reason the user would newly appear on
        // the leaderboard here — silently swallowing its error (as before)
        // meant the re-fetch below ran regardless and just came back
        // without this user, with nothing telling anyone the write failed.
        console.error('[leaderboard] show_on_leaderboard upsert failed:', upsertErr);
        return;
      }
      // Re-fetch entries so the current user now appears
      const { data } = await supabase.rpc('get_leaderboard').limit(500);
      if (data) {
        // Previously left _leaderboardCache holding the pre-auth fetch (which
        // may have missed this user entirely) — load() below always trusts
        // the cache first, so navigating away and back showed a stale
        // "not on leaderboard" flash until the background re-fetch caught up.
        _leaderboardCache = data as LeaderboardEntry[];
        setEntries(_leaderboardCache);
      }
    })();
  }, [user?.id]);

  const myIndex = user ? entries.findIndex(e => e.user_id === user.id) : -1;
  const [selected, setSelected] = useState<LeaderboardEntry | null>(null);
  const [selectedBio, setSelectedBio] = useState<string | null | undefined>(undefined);
  const [selectedHistory, setSelectedHistory] = useState<LeaderboardProfileHistory | null>(null);
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
    if (!selected) { setSelectedBio(undefined); setSelectedHistory(null); return; }
    setSelectedBio(undefined);
    setSelectedHistory(null);
    supabase.from('profiles').select('bio').eq('id', selected.user_id).maybeSingle()
      .then(({ data }) => setSelectedBio(data?.bio ?? null));
    supabase.rpc('get_leaderboard_profile', { p_user_id: selected.user_id }).maybeSingle()
      .then(({ data }) => setSelectedHistory(data as LeaderboardProfileHistory ?? { study_days: [], review_days: [], word_goal_days: [] }));
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
        const reviewSet = new Set(selectedHistory?.review_days ?? []);
        const wordsSet = new Set(selectedHistory?.word_goal_days ?? []);
        const totalStudyDays = selectedHistory?.study_days.length ?? 0;
        const avgPerDay = totalStudyDays === 0 ? 0 : Math.round(selected.total_learned / totalStudyDays);
        const { year: cYear, month: cMonth } = calMonth;
        const daysInCMonth = new Date(cYear, cMonth + 1, 0).getDate();
        const activeDays = Array.from({ length: daysInCMonth }, (_, i) => {
          const d = i + 1;
          const ds = `${cYear}-${String(cMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          return reviewSet.has(ds) || wordsSet.has(ds);
        }).filter(Boolean).length;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setSelected(null)}>
            <div className="w-full max-w-md bg-[var(--surface)] rounded-t-3xl flex flex-col max-h-[90dvh]" onClick={e => e.stopPropagation()}>
              <div className="pt-4 px-5 pb-1 shrink-0">
                <div className="w-9 h-1 rounded-full bg-[var(--border)] mx-auto" />
              </div>
              <div className="overflow-y-auto flex-1 px-5 pb-2 flex flex-col gap-4">
              <div className="flex flex-col items-center gap-2">
                <Avatar name={selected.name} url={selected.avatar_url} size={56} userId={selected.user_id} />
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-[var(--text)]">{selected.name}</p>
                  {user && selected.user_id !== user.id && (
                    <button onClick={() => toggleSave(selected.user_id)} className="text-2xl leading-none" aria-label={savedIds.has(selected.user_id) ? 'Unstar user' : 'Star user'}>
                      {savedIds.has(selected.user_id) ? '⭐' : '☆'}
                    </button>
                  )}
                </div>
                {selectedBio !== undefined && (
                  <div className="w-full bg-[var(--surface-2)] rounded-xl px-4 py-3">
                    <p className="text-sm text-[var(--text-muted)] italic leading-relaxed text-center">
                      {selectedBio || 'No bio yet'}
                    </p>
                  </div>
                )}
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
                  { emoji: '📊', value: selectedHistory ? `~${avgPerDay}` : '…', label: 'Words / day',      color: '#9B59B6' },
                  { emoji: '📅', value: selectedHistory ? `${activeDays}/${daysInCMonth}` : '…', label: 'Days this month', color: '#E67E22' },
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
                    aria-label="Previous month"
                  >‹</button>
                  <p className="text-xs font-bold text-[var(--text-muted)]">
                    {new Date(cYear, cMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                  <button
                    onClick={() => setCalMonth(m => { const d = new Date(m.year, m.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-base text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
                    aria-label="Next month"
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
                        const review = reviewSet.has(dateStr);
                        const words  = wordsSet.has(dateStr);
                        const anyDone = review || words;
                        const isToday = dateStr === todayDate;
                        return (
                          <div key={d} className="flex items-center justify-center py-0.5">
                            <div className="w-6 h-6 rounded-full relative overflow-hidden flex items-center justify-center"
                              style={{
                                background: anyDone ? 'var(--surface-2)' : 'transparent',
                                outline: isToday ? '1.5px solid var(--primary)' : 'none',
                                outlineOffset: '1px',
                              }}>
                              {review && <div className="absolute bottom-0 left-0 right-0" style={{ height: '50%', background: '#4338ca' }} />}
                              {words  && <div className="absolute top-0 left-0 right-0" style={{ height: '50%', background: '#059669' }} />}
                              <span className="relative z-10 text-[10px] font-semibold"
                                style={{ color: anyDone ? '#fff' : isToday ? 'var(--primary)' : 'var(--text-muted)' }}>
                                {d}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full" style={{ background: '#4338ca' }} /><span className="text-[10px] text-[var(--text-muted)]">SRS review</span></div>
                  <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full" style={{ background: '#059669' }} /><span className="text-[10px] text-[var(--text-muted)]">Daily goal</span></div>
                </div>
              </div>
              </div>
              <div className="px-5 pb-5 pt-2 shrink-0">
                <button onClick={() => setSelected(null)} className="w-full btn-ghost py-3 text-sm">Close</button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Gradient header */}
      <div className="px-4 pt-5 pb-5" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' }}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} aria-label="Go back"
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-lg transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.2)' }}>←</button>
          <div className="flex-1">
            <h1 className="font-bold text-white text-lg leading-tight">🏆 Leaderboard</h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>Top learners by total XP</p>
          </div>
          <button onClick={load} aria-label="Refresh"
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-lg transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.2)' }}>↻</button>
        </div>
        {/* All / Starred toggle inside header */}
        <div className="flex gap-2">
          {(['all', 'starred'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-xl text-sm font-semibold transition-all"
              style={filter === f
                ? { background: 'rgba(255,255,255,0.95)', color: '#b45309' }
                : { background: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.9)' }}>
              {f === 'all' ? 'All' : '⭐ Starred'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3 max-w-xl mx-auto w-full">
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
          // Standard competition ranking (1, 2, 2, 4, ...) — rank was
          // previously just the list position, so two users tied on XP got
          // sequential ranks (e.g. 4 and 5) with nothing showing they were
          // actually tied.
          const ranks: number[] = [];
          const tied: boolean[] = [];
          visible.forEach((e, i) => {
            ranks.push(i > 0 && e.xp === visible[i - 1].xp ? ranks[i - 1] : i + 1);
          });
          visible.forEach((e, i) => {
            tied.push((i > 0 && e.xp === visible[i - 1].xp) || (i < visible.length - 1 && e.xp === visible[i + 1].xp));
          });
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
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
                {([
                  { entry: visible[1], rank: 2, medal: '🥈', avatarSize: 40, minH: 160,
                    light: '#E2E8F0', color: '#94A3B8', dark: '#334155' },
                  { entry: visible[0], rank: 1, medal: '🥇', avatarSize: 52, minH: 200,
                    light: '#FDE047', color: '#F59E0B', dark: '#B45309' },
                  { entry: visible[2], rank: 3, medal: '🥉', avatarSize: 36, minH: 140,
                    light: '#FED7AA', color: '#F97316', dark: '#9A3412' },
                ] as const).map(({ entry: e, rank: podiumPos, medal, avatarSize, minH, light, color, dark }) => {
                  const isMe = !!(user && e.user_id === user.id);
                  const idx = podiumPos - 1;
                  const rank = ranks[idx];
                  const isTied = tied[idx];
                  const numStr = String(rank).padStart(2, '0');
                  return (
                    <div key={e.user_id} onClick={() => setSelected(e)} style={{ flex: 1, cursor: 'pointer' }}>
                      <div
                        style={{
                          borderRadius: 20, minHeight: minH,
                          background: `linear-gradient(135deg, ${light}, ${color}, ${dark})`,
                          boxShadow: isMe
                            ? `0 4px 0 ${dark}, 0 8px 20px ${color}88, 0 0 0 3px #fff`
                            : `0 4px 0 ${dark}, 0 8px 20px ${color}55`,
                          position: 'relative', overflow: 'hidden',
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          padding: '14px 8px', gap: 5,
                          textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                          transition: 'transform 0.15s ease',
                        }}
                        onMouseEnter={ev => (ev.currentTarget.style.transform = 'translateY(-3px)')}
                        onMouseLeave={ev => (ev.currentTarget.style.transform = 'translateY(0)')}
                      >
                        {/* Watermark rank */}
                        <div style={{
                          position: 'absolute', right: 4, bottom: -6, fontSize: 56,
                          fontWeight: 900, color: 'rgba(255,255,255,0.1)',
                          lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
                        }}>{isTied ? '=' : ''}{numStr}</div>

                        <span style={{ fontSize: rank === 1 ? 30 : 22 }}>{medal}</span>
                        <div style={{ borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.55)', overflow: 'hidden', flexShrink: 0 }}>
                          <Avatar name={e.name} url={e.avatar_url} size={avatarSize} userId={e.user_id} />
                        </div>
                        <p style={{ fontSize: 11, fontWeight: 900, color: '#fff', textAlign: 'center', lineHeight: 1.2, width: '100%', paddingInline: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {savedIds.has(e.user_id) ? '⭐ ' : ''}{e.name}
                        </p>
                        <p style={{ fontSize: rank === 1 ? 13 : 11, fontWeight: 900, color: 'rgba(255,255,255,0.95)' }}>
                          {displayXP(e.xp)} XP
                        </p>
                        {isTied && (
                          <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 20, padding: '2px 8px' }}>TIED</span>
                        )}
                        {e.streak > 0 && (
                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>🔥 {e.streak}</p>
                        )}
                        {e.last_study_date === today && (
                          <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 20, padding: '2px 8px' }}>TODAY</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Ranked list (4 onwards, or all if < 3) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visible.slice(visible.length >= 3 ? 3 : 0).map((e, i) => {
                const idx = (visible.length >= 3 ? 3 : 0) + i;
                const rank = ranks[idx];
                const isTied = tied[idx];
                const isMe = !!(user && e.user_id === user.id);
                const rankColor = rank <= 10 ? '#6366F1' : 'var(--text-muted)';
                return (
                  <div key={e.user_id} onClick={() => setSelected(e)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      borderRadius: 18, padding: '10px 14px',
                      background: isMe ? 'linear-gradient(135deg, #6366F118, #8B5CF618)' : 'var(--surface)',
                      border: isMe ? '1.5px solid #6366F1' : '1.5px solid var(--border)',
                      boxShadow: isMe ? '0 0 0 1px #6366F144' : undefined,
                      cursor: 'pointer', transition: 'transform 0.1s ease',
                    }}
                    onMouseEnter={ev => (ev.currentTarget.style.transform = 'translateY(-1px)')}
                    onMouseLeave={ev => (ev.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 900,
                      background: isMe ? '#6366F1' : rank <= 10 ? '#6366F118' : 'var(--surface-2)',
                      color: isMe ? '#fff' : rankColor,
                    }}>{isTied ? '=' : ''}{rank}</div>
                    <Avatar name={e.name} url={e.avatar_url} size={38} userId={e.user_id} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {savedIds.has(e.user_id) && <span style={{ fontSize: 13, lineHeight: 1 }}>⭐</span>}
                        <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</p>
                        {isMe && <span style={{ fontSize: 10, fontWeight: 800, background: '#6366F1', color: '#fff', borderRadius: 20, padding: '2px 7px', flexShrink: 0 }}>YOU</span>}
                        {isTied && <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--surface-2)', color: 'var(--text-muted)', borderRadius: 20, padding: '1px 7px', flexShrink: 0 }}>TIED</span>}
                      </div>
                      {e.last_study_date === today && (
                        <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: 'var(--success)', borderRadius: 20, padding: '1px 7px' }}>TODAY</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 900, color: isMe ? '#6366F1' : 'var(--primary)' }}>{displayXP(e.xp)} XP</p>
                      {e.streak > 0 && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>🔥 {e.streak}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Your rank if outside top list */}
            {user && myIndex === -1 && (
              <div className="mt-4 rounded-2xl p-4 border border-dashed border-[var(--border)] text-center space-y-2">
                <p className="text-sm font-semibold text-[var(--text)]">You're not on the leaderboard yet</p>
                <p className="text-xs text-[var(--text-muted)]">Your data may not be synced. Tap below to sync now.</p>
                {syncError && <p className="text-xs text-red-400 break-all">Error: {syncError}</p>}
                <button onClick={manualSync} disabled={syncing}
                  className="mt-1 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                  style={{ background: 'var(--primary)' }}>
                  {syncing ? 'Syncing…' : '⟳ Sync to leaderboard'}
                </button>
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

