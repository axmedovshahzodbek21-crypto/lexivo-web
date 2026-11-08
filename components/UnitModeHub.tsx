'use client';
import { MODE_ICON, MODE_COLOR, modeLabel } from '@/app/classes/[id]/homework/_shared';
import { useTranslation } from '@/lib/useTranslation';

// The mode buttons and "recommended next step" shared by class homework and
// personal Lexivo units, so the two look the same.

type ModeProps = {
  busyMode?: string | null;
  disabled?: boolean;
  isLocked: (mode: string) => boolean;
  onStart: (mode: string) => void;
};

export function UnitModeButtons({
  modes, completed, busyMode, disabled, isLocked, onStart,
}: ModeProps & { modes: string[]; completed: Set<string> }) {
  const nonMatch = modes.filter(m => m !== 'match');
  const tile = (mode: string, wide?: boolean) => (
    <ModeTile
      key={mode}
      mode={mode}
      done={completed.has(mode)}
      busy={busyMode === mode}
      disabled={!!disabled}
      locked={isLocked(mode)}
      onClick={() => onStart(mode)}
      wide={wide}
    />
  );
  return (
    <>
      {nonMatch.length > 0 && (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${nonMatch.length}, minmax(0, 1fr))` }}>
          {nonMatch.map(mode => tile(mode))}
        </div>
      )}
      {modes.includes('match') && tile('match', true)}
    </>
  );
}

export function UnitNextStep({
  nextMode, skipMode, wordCount, busyMode, disabled, isLocked, onStart, hint,
}: ModeProps & { nextMode: string; skipMode: string | null; wordCount: number; hint?: string }) {
  const t = useTranslation();
  const nextColor = MODE_COLOR[nextMode] ?? 'var(--primary)';
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-[var(--text-muted)] tracking-widest uppercase">{t.classesPage.recommendedNext}</p>
      <button
        onClick={() => onStart(nextMode)}
        disabled={!!disabled || isLocked(nextMode)}
        className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[0.98] disabled:opacity-60"
        style={{ background: 'var(--surface)', border: `2px solid ${nextColor}`, boxShadow: `0 0 0 3px ${nextColor}22` }}
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base" style={{ background: nextColor }}>
          {busyMode === nextMode
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <span>{MODE_ICON[nextMode] ?? '📖'}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[var(--text)] text-xs">{modeLabel(t, nextMode)}</p>
          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{hint ?? t.classesPage.wordsTapToStart(wordCount)}</p>
        </div>
        <span className="text-[var(--text-muted)] text-sm">→</span>
      </button>
      {skipMode && (
        <button
          onClick={() => onStart(skipMode)}
          disabled={!!disabled || isLocked(skipMode)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ background: 'var(--surface)', border: '1.5px dashed var(--border)' }}
        >
          <span className="text-sm">{MODE_ICON[skipMode] ?? '📖'}</span>
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-[var(--text-muted)]">{t.classesPage.skipToMode(modeLabel(t, skipMode))}</p>
            <p className="text-[9px] text-[var(--text-muted)] opacity-70">{t.classesPage.youllSkipMode(modeLabel(t, nextMode))}</p>
          </div>
          <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wide">{t.classesPage.skip}</span>
        </button>
      )}
    </div>
  );
}

function ModeTile({
  mode, done, busy, disabled, onClick, wide, locked,
}: {
  mode: string; done: boolean; busy: boolean; disabled: boolean; onClick: () => void; wide?: boolean; locked?: boolean;
}) {
  const t = useTranslation();
  const color = MODE_COLOR[mode] ?? 'var(--primary)';
  const icon = MODE_ICON[mode] ?? '📖';
  const label = modeLabel(t, mode);
  const base = `flex items-center justify-center ${wide ? 'flex-row gap-1.5 py-2 px-3' : 'flex-col gap-1 py-2'} rounded-lg text-[11px] font-bold transition-all disabled:opacity-60`;

  if (locked) {
    return (
      <div
        title={t.classesPage.completeLearnFirst}
        className={`${base} cursor-not-allowed select-none`}
        style={{ background: 'var(--surface-2)', border: '1.5px dashed var(--border)', opacity: 0.4 }}
      >
        <span className={wide ? 'text-sm' : 'text-base'}>🔒</span>
        <span className="text-[var(--text-muted)]">{label}</span>
      </div>
    );
  }
  if (done) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`${base} active:scale-95`}
        style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.35)', color: '#16a34a' }}
      >
        {busy ? (
          <div className="w-3.5 h-3.5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className={wide ? 'text-sm' : 'text-base'}>✓</span>
        )}
        <span>{label}</span>
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} text-white active:scale-95 hover:opacity-90`}
      style={{ background: color, boxShadow: `0 3px 12px ${color}66` }}
    >
      {busy ? (
        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <span className={wide ? 'text-sm' : 'text-base'}>{icon}</span>
      )}
      <span>{label}</span>
    </button>
  );
}
