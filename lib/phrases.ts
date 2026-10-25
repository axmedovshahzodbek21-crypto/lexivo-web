// Phrases collection is split into one collection per CEFR level, named
// "Phrases A1" … "Phrases C2" (same names as the Flutter app). A level with
// no collection in word_data.json yet shows as "coming soon" on /phrases.
export const PHRASE_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type PhraseLevel = typeof PHRASE_LEVELS[number];

export const phraseCollectionName = (level: PhraseLevel) => `Phrases ${level}`;
export const isPhraseCollection = (name: string) => name.startsWith('Phrases ');
