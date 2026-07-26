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
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
      <circle
        cx="55" cy="55" r={r} fill="none"
        stroke="var(--primary)" strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform="rotate(-90 55 55)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x="55" y="50" textAnchor="middle" fontSize="18" fontWeight="bold" fill="var(--primary)" dominantBaseline="middle">
        {Math.round(pct * 100)}%
      </text>
      <text x="55" y="68" textAnchor="middle" fontSize="9" fill="var(--text-muted)" dominantBaseline="middle">
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
        streak: getStreak(),
        xp: getXP(),
        masteredCount: getGraduatedCount(),
        totalDays: getTotalStudyDays(),
        flashDays: getFlashcardTotalDays(),
        flashStreak: getFlashcardStreak(),
        quizDays: getQuizTotalDays(),
        quizStreak: getQuizStreak(),
      });
    };
    load();
    window.addEventListener('lexivo-sync', load);
    return () => window.removeEventListener('lexivo-sync', load);
  }, []);

  const total    = ALL_ACHIEVEMENTS.length;
  const unlocked = unlockedIds.length;

  const byCategory: Record<string, Achievement[]> = {};
  for (const a of ALL_ACHIEVEMENTS) {
    (byCategory[a.category] ??= []).push(a);
  }

  function openDetail(a: Achievement) {
    setSelected({
      ...a,
      unlocked: unlockedIds.includes(a.id),
      unlockedAt: getAchievementDate(a.id),
    });
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 40 }}>

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div style={{
        margin: '16px 16px 24px',
        padding: '24px 20px',
        borderRadius: 24,
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 60%, #c084fc 100%)',
        boxShadow: '0 8px 32px color-mix(in srgb, var(--primary) 35%, transparent)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* decorative blobs */}
        <div style={{ position:'absolute', top:-30, right:-30, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }} />
        <div style={{ position:'absolute', bottom:-20, left:-20, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.06)' }} />

        <div style={{ display:'flex', alignItems:'center', gap:20, position:'relative' }}>
          <RingProgress pct={total > 0 ? unlocked / total : 0} />
          <div>
            <p style={{ color:'rgba(255,255,255,0.75)', fontSize:12, fontWeight:600, marginBottom:2, textTransform:'uppercase', letterSpacing:'0.08em' }}>
              Achievements
            </p>
            <p style={{ color:'white', fontSize:28, fontWeight:800, lineHeight:1.1, margin:0 }}>
              {unlocked}<span style={{ fontSize:16, fontWeight:500, opacity:0.7 }}> / {total}</span>
            </p>
            <p style={{ color:'rgba(255,255,255,0.65)', fontSize:12, marginTop:4 }}>
              badges unlocked
            </p>

            {/* mini milestones */}
            <div style={{ display:'flex', gap:6, marginTop:12, flexWrap:'wrap' }}>
              {[25, 50, 75, 100].map(pct => {
                const done = (unlocked / total) * 100 >= pct;
                return (
                  <span key={pct} style={{
                    fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20,
                    background: done ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.10)',
                    color: done ? 'white' : 'rgba(255,255,255,0.4)',
                    border: done ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
                  }}>
                    {pct}%
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Category sections ────────────────────────────────────────────── */}
      <div style={{ padding: '0 16px', display:'flex', flexDirection:'column', gap:28 }}>
        {CATEGORY_ORDER.map(cat => {
          const achs = byCategory[cat] ?? [];
          if (achs.length === 0) return null;
          const meta = CATEGORY_META[cat];
          const catUnlocked = achs.filter(a => unlockedIds.includes(a.id)).length;
          const catPct = achs.length > 0 ? catUnlocked / achs.length : 0;

          return (
            <div key={cat}>
              {/* Category header */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <div style={{
                  width:32, height:32, borderRadius:10,
                  background: 'color-mix(in srgb, var(--primary) 12%, var(--surface))',
                  border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:15, flexShrink:0,
                }}>
                  {meta.icon}
                </div>
                <span style={{ fontWeight:700, fontSize:13, color:'var(--text)', flex:1 }}>{meta.label}</span>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {/* mini bar */}
                  <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)', overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:2, width:`${catPct*100}%`, background:'var(--primary)', transition:'width 0.6s ease' }} />
                  </div>
                  <span style={{
                    fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:12,
                    background: catUnlocked > 0 ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--surface-2)',
                    color: catUnlocked > 0 ? 'var(--primary)' : 'var(--text-muted)',
                    minWidth:38, textAlign:'center',
                  }}>
                    {catUnlocked}/{achs.length}
                  </span>
                </div>
              </div>

              {/* Achievement list */}
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {achs.map(a => {
                  const isUnlocked = unlockedIds.includes(a.id);
                  const prog = !isUnlocked ? getAchievementProgress(a.id, stats) : null;
                  const pct = prog ? prog.current / prog.target : 0;

                  return (
                    <button
                      key={a.id}
                      onClick={() => openDetail(a)}
                      style={{
                        display:'flex', alignItems:'center', gap:12,
                        padding:'10px 14px',
                        borderRadius:14,
                        background: isUnlocked
                          ? 'var(--surface)'
                          : 'var(--surface-2)',
                        border: isUnlocked
                          ? '1px solid color-mix(in srgb, var(--primary) 30%, transparent)'
                          : '1px solid var(--border)',
                        boxShadow: isUnlocked
                          ? '0 2px 12px color-mix(in srgb, var(--primary) 12%, transparent)'
                          : 'none',
                        cursor:'pointer', textAlign:'left', width:'100%',
                        transition:'transform 0.15s, box-shadow 0.15s',
                        opacity: isUnlocked ? 1 : 0.65,
                        position:'relative', overflow:'hidden',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow= isUnlocked ? '0 4px 20px color-mix(in srgb, var(--primary) 20%, transparent)' : 'none'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow= isUnlocked ? '0 2px 12px color-mix(in srgb, var(--primary) 12%, transparent)' : 'none'; }}
                    >
                      {/* Glow accent for unlocked */}
                      {isUnlocked && (
                        <div style={{
                          position:'absolute', left:0, top:0, bottom:0, width:3,
                          background:'linear-gradient(180deg, var(--primary), var(--primary-light))',
                          borderRadius:'14px 0 0 14px',
                        }} />
                      )}

                      {/* Icon */}
                      <div style={{
                        width:36, height:36, borderRadius:10, flexShrink:0,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:18,
                        background: isUnlocked
                          ? 'color-mix(in srgb, var(--primary) 10%, var(--surface))'
                          : 'var(--border)',
                        filter: isUnlocked ? 'none' : 'grayscale(1)',
                      }}>
                        {a.icon}
                      </div>

                      {/* Text + progress */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:12, fontWeight:700, margin:0, color: isUnlocked ? 'var(--text)' : 'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {a.title}
                        </p>
                        <p style={{ fontSize:10, margin:'1px 0 0', color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {a.description}
                        </p>
                        {!isUnlocked && prog && (
                          <div style={{ marginTop:5, height:3, borderRadius:2, background:'var(--border)', overflow:'hidden' }}>
                            <div style={{ height:'100%', borderRadius:2, width:`${pct*100}%`, background:'var(--primary)', transition:'width 0.6s ease' }} />
                          </div>
                        )}
                      </div>

                      {/* Right badge */}
                      {isUnlocked ? (
                        <div style={{
                          width:22, height:22, borderRadius:'50%', flexShrink:0,
                          background:'linear-gradient(135deg, var(--primary), var(--primary-light))',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          color:'white', fontSize:11, fontWeight:700,
                        }}>✓</div>
                      ) : prog ? (
                        <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', flexShrink:0 }}>
                          {Math.round(pct * 100)}%
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Detail modal ─────────────────────────────────────────────────── */}
      {selected && (
        <div
          style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => setSelected(null)}
        >
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)' }} />
          <div
            className="animate-slide-up"
            style={{
              position:'relative', width:'100%', maxWidth:420,
              borderRadius:'28px 28px 0 0',
              background:'var(--surface)',
              padding:'8px 28px 44px',
              boxShadow:'0 -8px 40px rgba(0,0,0,0.25)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* handle */}
            <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
              <div style={{ width:44, height:4, borderRadius:2, background:'var(--border)' }} />
            </div>

            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
              {/* Icon in glow ring */}
              <div style={{
                width:88, height:88, borderRadius:'50%',
                background: selected.unlocked
                  ? 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, var(--surface)), color-mix(in srgb, var(--primary-light) 12%, var(--surface)))'
                  : 'var(--surface-2)',
                border: selected.unlocked
                  ? '2px solid color-mix(in srgb, var(--primary) 30%, transparent)'
                  : '2px solid var(--border)',
                boxShadow: selected.unlocked
                  ? '0 0 0 6px color-mix(in srgb, var(--primary) 8%, transparent), 0 8px 24px color-mix(in srgb, var(--primary) 20%, transparent)'
                  : 'none',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:40,
                filter: selected.unlocked ? 'none' : 'grayscale(1)',
              }}>
                {selected.icon}
              </div>

              <div style={{ textAlign:'center' }}>
                <p style={{ fontWeight:800, fontSize:20, margin:0, color:'var(--text)' }}>{selected.title}</p>
                <p style={{ fontSize:13, marginTop:6, color:'var(--text-muted)', lineHeight:1.5 }}>{selected.description}</p>
              </div>

              {selected.unlocked ? (
                <div style={{
                  marginTop:4, padding:'12px 28px', borderRadius:16, textAlign:'center',
                  background:'linear-gradient(135deg, color-mix(in srgb, var(--primary) 10%, transparent), color-mix(in srgb, var(--primary-light) 8%, transparent))',
                  border:'1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
                }}>
                  <p style={{ fontSize:14, fontWeight:700, color:'var(--primary)', margin:0 }}>✓ Achieved</p>
                  {selected.unlockedAt && (
                    <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>{fmtDate(selected.unlockedAt)}</p>
                  )}
                </div>
              ) : (() => {
                const prog = getAchievementProgress(selected.id, stats);
                if (!prog) return null;
                const pct = prog.current / prog.target;
                return (
                  <div style={{ width:'100%', marginTop:4 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)' }}>Progress</span>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--primary)' }}>
                        {prog.current} / {prog.target} {prog.label}
                      </span>
                    </div>
                    <div style={{ height:10, borderRadius:5, background:'var(--border)', overflow:'hidden' }}>
                      <div style={{
                        height:'100%', borderRadius:5,
                        width:`${pct*100}%`,
                        background:'linear-gradient(90deg, var(--primary), var(--primary-light))',
                        transition:'width 0.6s ease',
                      }} />
                    </div>
                    <p style={{ textAlign:'center', marginTop:8, fontSize:11, color:'var(--text-muted)' }}>
                      {Math.round(pct * 100)}% complete
                    </p>
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
