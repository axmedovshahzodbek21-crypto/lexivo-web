export interface RealEnglishVideo {
  id: string;
  title: string;
  duration: string; // ← WRITE VIDEO DURATION HERE, e.g. '11:38'
  collectionName: string;
}

export interface RealEnglishSet {
  id: string;
  title: string;
  videos: RealEnglishVideo[];
}

export const realEnglishSets: RealEnglishSet[] = [
  {
    id: 'preview-set',
    title: 'How to Sound More Natural in English',
    videos: [
      { id: 'preview-set-v1',  title: 'Video 1',  duration: '03:42', collectionName: 'Natural English V1'  },
      { id: 'preview-set-v2',  title: 'Video 2',  duration: '', collectionName: 'Natural English V2'  },
      { id: 'preview-set-v3',  title: 'Video 3',  duration: '', collectionName: 'Natural English V3'  },
      { id: 'preview-set-v4',  title: 'Video 4',  duration: '', collectionName: 'Natural English V4'  },
      { id: 'preview-set-v5',  title: 'Video 5',  duration: '', collectionName: 'Natural English V5'  },
      { id: 'preview-set-v6',  title: 'Video 6',  duration: '', collectionName: 'Natural English V6'  },
      { id: 'preview-set-v7',  title: 'Video 7',  duration: '', collectionName: 'Natural English V7'  },
      { id: 'preview-set-v8',  title: 'Video 8',  duration: '', collectionName: 'Natural English V8'  },
      { id: 'preview-set-v9',  title: 'Video 9',  duration: '', collectionName: 'Natural English V9'  },
      { id: 'preview-set-v10', title: 'Video 10', duration: '', collectionName: 'Natural English V10' },
      { id: 'preview-set-v11', title: 'Video 11', duration: '', collectionName: 'Natural English V11' },
      { id: 'preview-set-v12', title: 'Video 12', duration: '', collectionName: 'Natural English V12' },
      { id: 'preview-set- v13', title: 'Video 13', duration: '', collectionName: 'Natural English V13' },
    ],
  },
];
