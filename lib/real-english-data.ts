export interface RealEnglishSet {
  id: string;
  title: string;
  source: string;
  level: string;        // e.g. 'B2', 'C1'
  youtubeUrl: string;
  collectionName: string; // must match the word collection name exactly
  wordCount: number;
  description?: string;
}

export const realEnglishSets: RealEnglishSet[] = [
  {
    id: 'preview-set',
    title: 'How to Sound More Natural in English',
    source: 'English with Lucy',
    level: 'B2',
    youtubeUrl: 'https://youtu.be/placeholder',
    collectionName: 'Real English: Natural English',
    wordCount: 42,
    description: 'Key phrases and vocabulary from a real interview coaching session.',
  },
];
