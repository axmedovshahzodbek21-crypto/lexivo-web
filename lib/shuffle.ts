'use client';

// Shared "slot machine" shuffle helpers — random picking + Web Audio sound
// effects (no audio files) for any "pick a random X" reveal animation
// (e.g. Speaking's random question, Reading's Surprise Me).

export function pickRandom<T>(arr: T[], excludeIndex?: number): { item: T; index: number } {
  let index = Math.floor(Math.random() * arr.length);
  if (arr.length > 1 && index === excludeIndex) {
    index = (index + 1) % arr.length;
  }
  return { item: arr[index], index };
}

// ── Sound (Web Audio, no files) ───────────────────────────────────────────────

import { getAudioCtx, playTone } from './web-audio';

// Soft slot-machine "tick" — pass a rising pitch multiplier as the spin decelerates.
export function playShuffleTick(pitch = 1) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    playTone(ctx, { type: 'square', freq: 420 * pitch, start: ctx.currentTime, duration: 0.06, peakGain: 0.09, attack: 0.004 });
  } catch {}
}

// Bright ascending chime for when the spin lands on its final pick.
export function playShuffleReveal() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
    freqs.forEach((freq, i) => {
      playTone(ctx, { type: 'sine', freq, start: ctx.currentTime + i * 0.09, duration: 0.4, peakGain: 0.2, attack: 0.02 });
    });
  } catch {}
}
