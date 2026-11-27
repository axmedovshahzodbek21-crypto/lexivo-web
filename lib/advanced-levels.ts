// Advanced (IELTS Reading bank) is three separate collections, named like the
// Flutter app: "Advanced B2+", "Advanced C1", "Advanced C2". A level with no
// units yet shows as "coming soon" on /leveled-words/advanced.
export const ADVANCED_LEVELS = ['B2+', 'C1', 'C2'] as const;
export type AdvancedLevel = typeof ADVANCED_LEVELS[number];

export const advancedCollectionName = (level: AdvancedLevel) => `Advanced ${level}`;
export const isAdvancedCollection = (name: string) => name.startsWith('Advanced ');
