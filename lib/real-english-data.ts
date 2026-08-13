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
  // ── Add sets below ──────────────────────────────────────────────────────────
  // {
  //   id: 'example-set',
  //   title: 'Example Interview Title',
  //   source: 'Channel Name',
  //   level: 'B2',
  //   youtubeUrl: 'https://youtu.be/xxx',
  //   collectionName: 'Real English: Example Set',
  //   wordCount: 30,
  //   description: 'Optional short description of the video.',
  // },
];
