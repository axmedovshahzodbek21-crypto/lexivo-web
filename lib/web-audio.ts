'use client';

// Shared Web Audio helpers — no audio files, every sound effect in this app
// (shuffle tick/reveal, Pomodoro phase-change beep, XP-history panel chime)
// was hand-rolling its own AudioContext lookup and the same
// oscillator+gain-envelope boilerplate per note. One shared context (reused
// across calls instead of a fresh `new AudioContext()` per sound, which is
// wasteful and can hit browser per-page context limits) plus one helper for
// the common "short attack, exponential decay" note shape every one of
// these effects builds from.

let sharedCtx: AudioContext | null = null;

export function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      sharedCtx = new Ctx();
    }
    if (sharedCtx.state === 'suspended') sharedCtx.resume();
    return sharedCtx;
  } catch {
    return null;
  }
}

// Plays a single oscillator note: attack ramp up to peakGain, then
// exponential decay to silence. Covers every individual note across the
// app's existing sound effects except ClassXpHistoryModal's "whoosh" sweep,
// which has its own multi-stage envelope and pitch ramp — genuinely unique,
// left as bespoke code there rather than forced into this shape.
export function playTone(ctx: AudioContext, opts: {
  type: OscillatorType; freq: number; start: number; duration: number;
  peakGain?: number; attack?: number;
}) {
  const { type, freq, start, duration, peakGain = 0.15, attack = 0.02 } = opts;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}
