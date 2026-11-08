// The class header colours a person can pick (lib/class-colors.ts). Keys are
// stored in class_colors.color and mirrored in Flutter's class_colors.dart.
// These sit behind white text, so keep every stop dark enough to read it on.
export const CLASS_COLORS = {
  orange: { gradient: 'from-amber-700 to-orange-700', glow: '#f59e0b' },
  indigo: { gradient: 'from-indigo-600 to-purple-600', glow: '#818cf8' },
  pink: { gradient: 'from-pink-600 to-rose-600', glow: '#ec4899' },
  green: { gradient: 'from-emerald-700 to-teal-700', glow: '#22c55e' },
  blue: { gradient: 'from-blue-600 to-cyan-700', glow: '#3b82f6' },
  violet: { gradient: 'from-violet-600 to-purple-600', glow: '#8b5cf6' },
  red: { gradient: 'from-red-600 to-pink-600', glow: '#ef4444' },
  cyan: { gradient: 'from-cyan-700 to-blue-600', glow: '#06b6d4' },
};
export type ClassColorKey = keyof typeof CLASS_COLORS;
export const DEFAULT_CLASS_COLOR: ClassColorKey = 'orange';

// Same id->color hashing pattern, but for a single flat hex color used on
// avatar circles — was independently copy-pasted (identical palette) into
// leaderboard/page.tsx and classes/[id]/home/page.tsx.
const AVATAR_PALETTE = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6'];

export function avatarColor(userId: string): string {
  const hash = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

// A third, differently-sized flat-hex palette — was independently
// copy-pasted (identical palette, different variable/function names —
// "classAccentColor" vs "avatarColor") into classes/[id]/streak/page.tsx
// and classes/[id]/leaderboard/page.tsx.
const CLASS_ACCENT_COLORS = [
  '#6366f1', '#ec4899', '#22c55e', '#3b82f6',
  '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4',
];

export function classAccentColor(id: string): string {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return CLASS_ACCENT_COLORS[n % CLASS_ACCENT_COLORS.length];
}
