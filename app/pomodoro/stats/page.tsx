'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getFocusDays, getTodayFocusSeconds, getWeekFocusSeconds, getTotalFocusSeconds, localDateStr } from '@/lib/storage';
import { pullAll } from '@/lib/sync';

function fmtDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return totalSeconds > 0 ? `${totalSeconds}s` : '0m';
}

export default function PomodoroStatsPage() {
  const router = useRouter();
  const [today, setToday] = useState(0);
  const [week, setWeek] = useState(0);
  const [total, setTotal] = useState(0);
  const [days, setDays] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = () => {
      setToday(getTodayFocusSeconds());
      setWeek(getWeekFocusSeconds());
      setTotal(getTotalFocusSeconds());
      setDays(getFocusDays());
    };
    load();
    pullAll().then(load).catch(load);
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  // Last 7 days, oldest to newest, for the mini bar chart
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    const dateStr = localDateStr(d);
    const label = i === 6 ? 'Today' : d.toLocaleDateString('default', { weekday: 'short' }).slice(0, 3);
    return { dateStr, label, seconds: days[dateStr] ?? 0 };
  });
  const maxSeconds = Math.max(...last7.map(d => d.seconds), 60);

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="btn-icon text-lg" aria-label="Go back">←</button>
        <h1 className="font-bold text-[var(--text)]">Focus Time</h1>
        <div className="w-9 h-9" />
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <StatTile icon="🎯" label="Today" value={fmtDuration(today)} light="#a78bfa" bg="#7c3aed" shadow="#4c1d95" />
          <StatTile icon="📅" label="This Week" value={fmtDuration(week)} light="#818cf8" bg="#4338ca" shadow="#312e81" />
          <StatTile icon="🏆" label="Total" value={fmtDuration(total)} light="#34d399" bg="#059669" shadow="#064e3b" />
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">Last 7 Days</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 100 }}>
            {last7.map(d => (
              <div key={d.dateStr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                <div
                  style={{
                    width: '100%',
                    height: `${Math.max((d.seconds / maxSeconds) * 100, d.seconds > 0 ? 6 : 2)}%`,
                    borderRadius: 6,
                    background: d.seconds > 0
                      ? 'linear-gradient(180deg, var(--primary-light, #a78bfa), var(--primary))'
                      : 'var(--surface-2)',
                    transition: 'height 0.4s ease',
                  }}
                  title={fmtDuration(d.seconds)}
                />
                <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {total === 0 && (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
            Start a focus session to begin tracking your time. ⏱️
          </p>
        )}
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, light, bg, shadow }: {
  icon: string; label: string; value: string; light: string; bg: string; shadow: string;
}) {
  return (
    <div className="rounded-2xl p-3 flex flex-col gap-1 relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${light}, ${bg}, ${shadow})`, boxShadow: `0 4px 0 ${shadow}, 0 8px 20px ${bg}55` }}>
      <div style={{ position: 'absolute', right: -6, bottom: -10, fontSize: 52, opacity: 0.12, lineHeight: 1, pointerEvents: 'none', userSelect: 'none' }}>{icon}</div>
      <span className="text-xl relative z-10">{icon}</span>
      <div className="text-lg font-black text-white leading-tight relative z-10">{value}</div>
      <div className="text-[10px] text-white/70 font-bold leading-tight relative z-10">{label}</div>
    </div>
  );
}
