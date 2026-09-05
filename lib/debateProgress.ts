// Prototype-only progress tracking for Debate Arena — localStorage, per topic+side.
import type { DebateSide } from './debateContent';

const stepKey = (topic: string, side: DebateSide) => `debate-progress:${topic}:${side}`;
const caseKey = (topic: string, side: DebateSide) => `debate-case:${topic}:${side}`;

export function getStepIndex(topic: string, side: DebateSide): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(stepKey(topic, side));
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0;
}

export function setStepIndex(topic: string, side: DebateSide, index: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(stepKey(topic, side), String(Math.max(0, Math.min(5, index))));
}

export function resetProgress(topic: string, side: DebateSide) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(stepKey(topic, side));
  window.localStorage.removeItem(caseKey(topic, side));
}

// The user's personally chosen case: which arguments (by index into the
// content bank) they picked, plus which opening/closing phrase (by index
// into the phrase bank).
export type CaseSelection = { argIndices: number[]; openingIdx: number | null; closingIdx: number | null };

const emptyCase: CaseSelection = { argIndices: [], openingIdx: null, closingIdx: null };

export function getCaseSelection(topic: string, side: DebateSide): CaseSelection {
  if (typeof window === 'undefined') return emptyCase;
  const raw = window.localStorage.getItem(caseKey(topic, side));
  if (!raw) return emptyCase;
  try {
    return { ...emptyCase, ...JSON.parse(raw) };
  } catch {
    return emptyCase;
  }
}

export function setCaseSelection(topic: string, side: DebateSide, sel: CaseSelection) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(caseKey(topic, side), JSON.stringify(sel));
}
