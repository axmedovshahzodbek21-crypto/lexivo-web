// "Advanced" is ONE collection (the IELTS Reading bank); its units are split
// into three level folders by unit number. Must match the Flutter
// advancedLevels (leveled_words_screen.dart) and scripts/advanced-to-dart.js.
export const ADVANCED_LEVELS = [
  { level: 'B2+', first: 1, last: 16 },
  { level: 'C1', first: 17, last: 35 },
  { level: 'C2', first: 36, last: 55 },
] as const;

export type AdvancedLevel = typeof ADVANCED_LEVELS[number]['level'];

/** Range for a `?level=` value, or undefined if it isn't an Advanced level. */
export const advancedLevelRange = (level: string | null) =>
  ADVANCED_LEVELS.find(l => l.level === level);
