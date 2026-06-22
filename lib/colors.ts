// Single source of truth for colors that can't use CSS vars
// (canvas/confetti, feature accents, semantic level colors).
// Brand colors live in globals.css as --primary, --success, --danger, --warning.

// Feature accent colors — intentionally fixed, one per activity type
export const ACCENT = {
  learn:       '#6C63FF',
  flashcards:  '#FF6B35',
  quiz:        '#F59E0B',
  match:       '#EC4899',
  pronounce:   '#8B5CF6',
  srs:         '#3B82F6',
  pomodoro:    '#EF4444',
  lists:       '#8B5CF6',
  grammar:     '#10B981',
  streak:      '#FF6B35',
} as const;

// CEFR level colors — one per level, used in sidebar, profile, overlays
export const LEVEL_COLORS: Record<string, string> = {
  Beginner:             '#2ECC71',
  Elementary:           '#27AE60',
  Intermediate:         '#3498DB',
  'Upper-Intermediate': '#2980B9',
  Advanced:             '#9B59B6',
  Master:               '#F39C12',
};

export const LEVEL_COLORS_FALLBACK = '#6C63FF';

// Confetti/canvas colors — CSS vars don't work in canvas 2d context
export const CONFETTI_COLORS = ['#6C63FF', '#FF6B35', '#10B981', '#F59E0B', '#EC4899', '#3B82F6'];
