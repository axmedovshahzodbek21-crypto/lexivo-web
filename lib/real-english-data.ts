import type { Lang } from './i18n';

export interface RealEnglishVideo {
  id: string;
  title: string;
  titleUz?: string;
  titleRu?: string;
  duration: string; // ← WRITE VIDEO DURATION HERE, e.g. '11:38'
  collectionName: string;
}

export interface RealEnglishSet {
  id: string;
  title: string;
  titleUz?: string;
  titleRu?: string;
  videos: RealEnglishVideo[];
}

// Falls back to the English title for any set/video that hasn't had a
// titleUz/titleRu added yet, so new content doesn't need translating before
// it can ship.
export function localizedTitle(item: { title: string; titleUz?: string; titleRu?: string }, lang: Lang): string {
  if (lang === 'uz') return item.titleUz ?? item.title;
  if (lang === 'ru') return item.titleRu ?? item.title;
  return item.title;
}

export const realEnglishSets: RealEnglishSet[] = [
  {
    id: 'preview-set',
    title: 'How to Sound More Natural in English',
    titleUz: "Ingliz tilida tabiiyroq gapirish yo'llari",
    titleRu: 'Как звучать более естественно на английском',
    videos: [
      { id: 'preview-set-v1',  title: 'Video 1',  titleUz: '1-video',  titleRu: 'Видео 1',  duration: '03:42', collectionName: 'Natural English V1'  },
      { id: 'preview-set-v2',  title: 'Video 2',  titleUz: '2-video',  titleRu: 'Видео 2',  duration: '', collectionName: 'Natural English V2'  },
      { id: 'preview-set-v3',  title: 'Video 3',  titleUz: '3-video',  titleRu: 'Видео 3',  duration: '', collectionName: 'Natural English V3'  },
      { id: 'preview-set-v4',  title: 'Video 4',  titleUz: '4-video',  titleRu: 'Видео 4',  duration: '', collectionName: 'Natural English V4'  },
      { id: 'preview-set-v5',  title: 'Video 5',  titleUz: '5-video',  titleRu: 'Видео 5',  duration: '', collectionName: 'Natural English V5'  },
      { id: 'preview-set-v6',  title: 'Video 6',  titleUz: '6-video',  titleRu: 'Видео 6',  duration: '', collectionName: 'Natural English V6'  },
      { id: 'preview-set-v7',  title: 'Video 7',  titleUz: '7-video',  titleRu: 'Видео 7',  duration: '', collectionName: 'Natural English V7'  },
      { id: 'preview-set-v8',  title: 'Video 8',  titleUz: '8-video',  titleRu: 'Видео 8',  duration: '', collectionName: 'Natural English V8'  },
      { id: 'preview-set-v9',  title: 'Video 9',  titleUz: '9-video',  titleRu: 'Видео 9',  duration: '', collectionName: 'Natural English V9'  },
      { id: 'preview-set-v10', title: 'Video 10', titleUz: '10-video', titleRu: 'Видео 10', duration: '', collectionName: 'Natural English V10' },
      { id: 'preview-set-v11', title: 'Video 11', titleUz: '11-video', titleRu: 'Видео 11', duration: '', collectionName: 'Natural English V11' },
      { id: 'preview-set-v12', title: 'Video 12', titleUz: '12-video', titleRu: 'Видео 12', duration: '', collectionName: 'Natural English V12' },
      { id: 'preview-set-v13', title: 'Video 13', titleUz: '13-video', titleRu: 'Видео 13', duration: '', collectionName: 'Natural English V13' },
      { id: 'preview-set-v14', title: 'Video 14', titleUz: '14-video', titleRu: 'Видео 14', duration: '', collectionName: 'Natural English V14' },
    ],
  },
];
