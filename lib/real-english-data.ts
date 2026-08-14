export interface RealEnglishSet {
  id: string;
  title: string;
  collectionName: string; // must match the word collection name exactly
  duration?: string;      // e.g. '11:38'
  description?: string;
}

export const realEnglishSets: RealEnglishSet[] = [
  {
    id: 'preview-set',
    title: 'How to Sound More Natural in English',
    collectionName: 'Real English: Natural English',
    duration: '11:38',
    description: 'Key phrases and vocabulary from a real interview coaching session.',
  },
];
