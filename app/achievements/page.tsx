'use client';
import { useEffect, useState } from 'react';
import { ALL_ACHIEVEMENTS, CATEGORY_META, CATEGORY_ORDER, getAchievementProgress } from '@/lib/gamification';
import { getUnlockedAchievements, getLearnedWords, getStreak, getXP, getGraduatedCount, getTotalStudyDays, getFlashcardTotalDays, getFlashcardStreak, getQuizTotalDays, getQuizStreak, getAchievementDate } from '@/lib/storage';
import type { Achievement } from '@/lib/types';

interface Stats {
  learnedCount: number; streak: number; xp: number; masteredCount: number;
  totalDays: number; flashDays: number; flashStreak: number; quizDays: number; quizStreak: number;
}

interface AchDetail extends Omit<Achievement, 'unlockedAt'> {
  unlocked: boolean;
  unlockedAt: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function RingProgress({ pct }: { pct: number }) {
  const r = 44, circ = 2 * Math.PI * r, dash = circ * pct;
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--primary)" strokeWidth="8"
        strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
        transform="rotate(-90 55 55)" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      <text x="55" y="50" textAnchor="middle" fontSize="18" fontWeight="bold" fill="var(--primary)" dominantBaseline="middle">
        {Math.round(pct * 100)}%
      </text>
      <text x="55" y="68" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.6)" dominantBaseline="middle">
        complete
      </text>
    </svg>
  );
}

export default function AchievementsPage() {
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats>({ learnedCount: 0, streak: 0, xp: 0, masteredCount: 0, totalDays: 0, flashDays: 0, flashStreak: 0, quizDays: 0, quizStreak: 0 });
  const [selected, setSelected] = useState<AchDetail | null>(null);

  useEffect(() => {
    const load = () => {
      setUnlockedIds(getUnlockedAchievements());
      setStats({
        learnedCount: getLearnedWords().length,
        streak: getStreak(), xp: getXP(), masteredCount: getGraduatedCount(),
        totalDays: getTotalStudyDays(), flashDays: getFlashcardTotalDays(),
        flashStreak: getFlashcardStreak(), quizDays: getQuizTotalDays(), quizStreak: getQuizStreak(),
      });
    };
    load();
    // Without this, an achievement/XP/streak earned elsewhere (another tab,
    // or the globally-mounted PomodoroWidget) while this page stays open
    // left it showing stale progress until the next full navigation here.
    window.addEventListener('lexivo-stats-change', load);
    return () => window.removeEventListener('lexivo-stats-change', load);
  }, []);

  const total    = ALL_ACHIEVEMENTS.length;
  const unlocked = unlockedIds.length;
  const totalXpAvailable = ALL_ACHIEVEMENTS.reduce((s, a) => s + a.xp, 0);
  const xpEarned = ALL_ACHIEVEMENTS.filter(a => unlockedIds.includes(a.id)).reduce((s, a) => s + a.xp, 0);

  const byCategory: Record<string, Achievement[]> = {};
  for (const a of ALL_ACHIEVEMENTS) (byCategory[a.category] ??= []).push(a);

  function openDetail(a: Achievement) {
    setSelected({ ...a, unlocked: unlockedIds.includes(a.id), unlockedAt: getAchievementDate(a.id) });
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 48 }}>

      {/* ── Hero banner ─────────────────────────────────────────── */}
      <div style={{
        margin: '16px 16px 24px', padding: '24px 20px', borderRadius: 24,
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 60%, #c084fc 100%)',
        boxShadow: '0 8px 32px color-mix(in srgb, var(--primary) 35%, transparent)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position:'absolute', top:-30, right:-30, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }} />
        <div style={{ position:'absolute', bottom:-20, left:-20, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }} />
        <div style={{ display:'flex', alignItems:'center', gap:20, position:'relative' }}>
          <RingProgress pct={total > 0 ? unlocked / total : 0} />
          <div>
            <p style={{ color:'rgba(255,255,255,0.7)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', margin:0 }}>Achievements</p>
            <p style={{ color:'white', fontSize:28, fontWeight:800, lineHeight:1.1, margin:'4px 0 2px' }}>
              {unlocked}<span style={{ fontSize:16, fontWeight:500, opacity:0.7 }}> / {total}</span>
            </p>
            <p style={{ color:'rgba(255,255,255,0.65)', fontSize:12, margin:0 }}>badges unlocked</p>
            <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:12, color:'rgba(255,255,255,0.8)', fontWeight:600 }}>✨ {xpEarned} XP earned</span>
              <span style={{ fontSize:11, color:'rgba(255,255,255,0.45)' }}>/ {totalXpAvailable} total</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Category sections ────────────────────────────────────── */}
      <div style={{ padding: '0 16px', display:'flex', flexDirection:'column', gap:28 }}>
        {CATEGORY_ORDER.map(cat => {
          const achs = byCategory[cat] ?? [];
          if (achs.length === 0) return null;
          const meta = CATEGORY_META[cat];
          const catUnlocked = achs.filter(a => unlockedIds.includes(a.id)).length;
          return (
            <div key={cat}>
              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <div style={{ width:30, height:30, borderRadius:9, background:'color-mix(in srgb, var(--primary) 12%, var(--surface))', border:'1px solid color-mix(in srgb, var(--primary) 20%, transparent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                  {meta.icon}
                </div>
                <span style={{ fontWeight:700, fontSize:13, color:'var(--text)', flex:1 }}>{meta.label}</span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ width:36, height:3, borderRadius:2, background:'var(--border)', overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:2, width:`${achs.length > 0 ? (catUnlocked/achs.length)*100 : 0}%`, background:'var(--primary)', transition:'width 0.6s ease' }} />
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, minWidth:34, textAlign:'center', padding:'2px 7px', borderRadius:10, background: catUnlocked > 0 ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--surface-2)', color: catUnlocked > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                    {catUnlocked}/{achs.length}
                  </span>
                </div>
              </div>

              {/* 2-column card grid */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {achs.map(a => {
                  const isUnlocked = unlockedIds.includes(a.id);
                  const prog = !isUnlocked ? getAchievementProgress(a.id, stats) : null;
                  const pct = prog && prog.target > 0 ? prog.current / prog.target : 0;
                  return (
                    <button
                      key={a.id}
                      onClick={() => openDetail(a)}
                      style={{
                        display:'flex', flexDirection:'column', alignItems:'flex-start',
                        padding:'12px 12px 10px', borderRadius:16, textAlign:'left',
                        background: isUnlocked ? 'var(--surface)' : 'var(--surface-2)',
                        border: isUnlocked ? '1px solid color-mix(in srgb, var(--primary) 28%, transparent)' : '1px solid var(--border)',
                        boxShadow: isUnlocked ? '0 2px 12px color-mix(in srgb, var(--primary) 12%, transparent)' : 'none',
                        cursor:'pointer', width:'100%', opacity: isUnlocked ? 1 : 0.6,
                        transition:'transform 0.15s, opacity 0.15s',
                        position:'relative', overflow:'hidden',
                      }}
                    >
                      {/* XP badge top-right */}
                      <div style={{
                        position:'absolute', top:8, right:8,
                        fontSize:9, fontWeight:800, padding:'2px 5px', borderRadius:6,
                        background: isUnlocked ? 'linear-gradient(135deg, var(--primary), var(--primary-light))' : 'var(--border)',
                        color: isUnlocked ? 'white' : 'var(--text-muted)',
                      }}>
                        +{a.xp} XP
                      </div>

                      {/* Icon */}
                      <div style={{
                        width:40, height:40, borderRadius:12, marginBottom:8,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:22,
                        background: isUnlocked ? 'color-mix(in srgb, var(--primary) 10%, var(--surface))' : 'var(--border)',
                        filter: isUnlocked ? 'none' : 'grayscale(1)',
                      }}>
                        {a.icon}
                      </div>

                      {/* Title */}
                      <p style={{ fontSize:11, fontWeight:700, margin:0, color: isUnlocked ? 'var(--text)' : 'var(--text-muted)', lineHeight:1.3, paddingRight:28 }}>
                        {a.title}
                      </p>

                      {/* Progress bar or check */}
                      <div style={{ marginTop:8, width:'100%' }}>
                        {isUnlocked ? (
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <div style={{ width:16, height:16, borderRadius:'50%', background:'linear-gradient(135deg, var(--primary), var(--primary-light))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'white', fontWeight:700 }}>✓</div>
                            <span style={{ fontSize:9, color:'var(--primary)', fontWeight:600 }}>Achieved</span>
                          </div>
                        ) : prog ? (
                          <>
                            <div style={{ height:3, borderRadius:2, background:'var(--border)', overflow:'hidden', marginBottom:3 }}>
                              <div style={{ height:'100%', borderRadius:2, width:`${pct*100}%`, background:'var(--primary)' }} />
                            </div>
                            <span style={{ fontSize:9, color:'var(--text-muted)' }}>{prog.current}/{prog.target} {prog.label}</span>
                          </>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Detail modal ─────────────────────────────────────────── */}
      {selected && (
        <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={() => setSelected(null)}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)' }} />
          <div className="animate-slide-up" style={{ position:'relative', width:'100%', maxWidth:420, borderRadius:'28px 28px 0 0', background:'var(--surface)', padding:'8px 28px 44px', boxShadow:'0 -8px 40px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
              <div style={{ width:44, height:4, borderRadius:2, background:'var(--border)' }} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
              {/* Icon ring */}
              <div style={{
                width:88, height:88, borderRadius:'50%',
                background: selected.unlocked ? 'color-mix(in srgb, var(--primary) 12%, var(--surface))' : 'var(--surface-2)',
                border: selected.unlocked ? '2px solid color-mix(in srgb, var(--primary) 30%, transparent)' : '2px solid var(--border)',
                boxShadow: selected.unlocked ? '0 0 0 6px color-mix(in srgb, var(--primary) 8%, transparent), 0 8px 24px color-mix(in srgb, var(--primary) 18%, transparent)' : 'none',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:40,
                filter: selected.unlocked ? 'none' : 'grayscale(1)',
              }}>
                {selected.icon}
              </div>

              <div style={{ textAlign:'center' }}>
                <p style={{ fontWeight:800, fontSize:20, margin:0, color:'var(--text)' }}>{selected.title}</p>
                <p style={{ fontSize:13, marginTop:6, color:'var(--text-muted)', lineHeight:1.5 }}>{selected.description}</p>
              </div>

              {/* XP reward */}
              <div style={{
                display:'flex', alignItems:'center', gap:6, padding:'8px 20px', borderRadius:12,
                background: selected.unlocked ? 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, transparent), color-mix(in srgb, var(--primary-light) 8%, transparent))' : 'var(--surface-2)',
                border: `1px solid ${selected.unlocked ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'var(--border)'}`,
              }}>
                <span style={{ fontSize:16 }}>✨</span>
                <span style={{ fontSize:14, fontWeight:700, color: selected.unlocked ? 'var(--primary)' : 'var(--text-muted)' }}>+{selected.xp} XP reward</span>
              </div>

              {/* Status */}
              {selected.unlocked ? (
                <div style={{ padding:'10px 24px', borderRadius:12, textAlign:'center', background:'color-mix(in srgb, var(--success) 10%, transparent)', border:'1px solid color-mix(in srgb, var(--success) 25%, transparent)' }}>
                  <p style={{ fontSize:13, fontWeight:700, color:'var(--success)', margin:0 }}>✓ Achieved</p>
                  {selected.unlockedAt && <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>{fmtDate(selected.unlockedAt)}</p>}
                </div>
              ) : (() => {
                const prog = getAchievementProgress(selected.id, stats);
                if (!prog) return null;
                const pct = prog.target > 0 ? prog.current / prog.target : 0;
                return (
                  <div style={{ width:'100%' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)' }}>Progress</span>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--primary)' }}>{prog.current} / {prog.target} {prog.label}</span>
                    </div>
                    <div style={{ height:10, borderRadius:5, background:'var(--border)', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:5, width:`${pct*100}%`, background:'linear-gradient(90deg, var(--primary), var(--primary-light))', transition:'width 0.6s ease' }} />
                    </div>
                    <p style={{ textAlign:'center', marginTop:7, fontSize:11, color:'var(--text-muted)' }}>{Math.round(pct*100)}% complete</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
