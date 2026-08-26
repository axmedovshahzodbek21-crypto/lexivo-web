// Deterministic id -> gradient/glow color pair, used to give each class a
// consistent accent color across pages without storing one server-side.
// Was independently copy-pasted (identical hash + identical color arrays)
// into 5 different page files — the same "diverges silently when one copy
// gets tweaked and the others don't" risk that caused the streak page's
// day-boundary drift bug. Centralized here so there's exactly one copy to
// fix or extend.
const CLASS_GRADIENTS = [
  'from-indigo-500 to-purple-500', 'from-pink-500 to-rose-400',
  'from-emerald-500 to-teal-400', 'from-blue-500 to-cyan-400',
  'from-amber-500 to-orange-400', 'from-violet-500 to-purple-400',
  'from-red-500 to-pink-400', 'from-cyan-500 to-blue-400',
];
const CLASS_GLOWS = ['#818cf8', '#ec4899', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

export function classGradientColors(id: string): { gradient: string; glow: string } {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return { gradient: CLASS_GRADIENTS[n % 8], glow: CLASS_GLOWS[n % 8] };
}
