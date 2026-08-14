'use client';
import { useRouter } from 'next/navigation';
import { realEnglishSets, type RealEnglishSet } from '@/lib/real-english-data';

const CARD_COLORS = [
  '#5B8AF0','#FF6B6B','#06D6A0','#FFD166',
  '#A78BFA','#FF9F43','#F72585','#4ECDC4',
  '#3D8BFF','#FF5E57','#00C9A7','#FFC75F',
];
const darken = (hex: string, amt = 0.45) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r*(1-amt))},${Math.round(g*(1-amt))},${Math.round(b*(1-amt))})`;
};
const lighten = (hex: string, amt = 0.3) => {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.round(r+(255-r)*amt)},${Math.round(g+(255-g)*amt)},${Math.round(b+(255-b)*amt)})`;
};

function SetCard({ set, index, onClick }: { set: RealEnglishSet; index: number; onClick: () => void }) {
  const color = CARD_COLORS[index % CARD_COLORS.length];

  return (
    <div
      onClick={onClick}
      className="rounded-2xl cursor-pointer hover:-translate-y-1 transition-all duration-200 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${lighten(color)}, ${color})`,
        boxShadow: `0 12px 0 ${darken(color)}, 0 16px 32px ${color}99`,
        minHeight: '140px',
      }}
    >
      <div className="p-4 text-2xl">🎬</div>
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3"
        style={{ background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(8px)' }}>
        <p className="text-white font-bold text-sm leading-tight line-clamp-2"
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{set.title}</p>
        <p className="text-white/60 text-[10px] mt-0.5">{set.videos.length} videos</p>
      </div>
    </div>
  );
}

export default function RealEnglishPage() {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <div className="mb-6">
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Listening Skills</p>
        <h1 className="text-2xl font-black text-[var(--text)]">🗣️ Real English</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Learn the words from a real video — then unlock it and actually understand it.
        </p>
      </div>

      {realEnglishSets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 flex flex-col items-center justify-center text-center gap-3">
          <span className="text-4xl">🎬</span>
          <p className="text-sm font-bold text-[var(--text)]">No sets yet</p>
          <p className="text-xs text-[var(--text-muted)]">Video sets are coming soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {realEnglishSets.map((set, i) => (
            <SetCard key={set.id} set={set} index={i}
              onClick={() => router.push(`/real-english/${set.id}`)} />
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">How it works</p>
        <div className="flex flex-col gap-2.5">
          {[
            ['📖', 'Learn the words from a real video'],
            ['🔄', 'Review them with SRS over ~11 days'],
            ['🔓', 'Complete the +7 day review → link unlocks'],
            ['🎬', 'Watch the video and understand every word'],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-3">
              <span className="text-lg">{icon}</span>
              <span className="text-xs text-[var(--text-muted)]">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
