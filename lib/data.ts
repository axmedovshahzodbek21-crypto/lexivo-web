import type { WordCollection, WordItem } from './types';

const cache: Record<string, WordCollection | WordCollection[]> = {};

function stripHtml(s: unknown): string {
  if (typeof s !== 'string') return '';
  return s.replace(/<[^>]*>/g, '');
}

function sanitizeWord(w: WordItem): WordItem {
  return {
    ...w,
    word:                 stripHtml(w.word),
    partOfSpeech:         stripHtml(w.partOfSpeech),
    pronunciation:        stripHtml(w.pronunciation),
    translation:          stripHtml(w.translation),
    definition:           stripHtml(w.definition),
    definitionUz:         w.definitionUz         !== undefined ? stripHtml(w.definitionUz)         : undefined,
    example1:             stripHtml(w.example1),
    example1Situation:    stripHtml(w.example1Situation),
    example1Translation:  w.example1Translation  !== undefined ? stripHtml(w.example1Translation)  : undefined,
    example2:             stripHtml(w.example2),
    example2Situation:    stripHtml(w.example2Situation),
    example2Translation:  w.example2Translation  !== undefined ? stripHtml(w.example2Translation)  : undefined,
    example3:             stripHtml(w.example3),
    example3Translation:  stripHtml(w.example3Translation),
    example3Situation:    stripHtml(w.example3Situation),
    extraExamples:        w.extraExamples?.map(stripHtml),
    extraExampleTranslations: w.extraExampleTranslations?.map(stripHtml),
  };
}

function sanitizeCollection(col: WordCollection): WordCollection {
  return {
    ...col,
    days: col.days.map(d => ({ ...d, words: d.words.map(sanitizeWord) })),
  };
}

export async function loadCollections(): Promise<WordCollection[]> {
  if (cache['main']) return cache['main'] as WordCollection[];
  const res = await fetch('/data/word_data.json');
  const raw: WordCollection[] = await res.json();
  const data = raw.map(sanitizeCollection);
  cache['main'] = data;
  return data;
}

export async function loadCEFRCollection(level: 'a1' | 'a2' | 'b1' | 'advanced'): Promise<WordCollection> {
  if (cache[level]) return cache[level] as WordCollection;
  const res = await fetch(`/data/${level}_collection.json`);
  const raw: WordCollection = await res.json();
  const data = sanitizeCollection(raw);
  cache[level] = data;
  return data;
}

export async function loadAllCollections(): Promise<WordCollection[]> {
  const [main, a1, a2, b1, advanced] = await Promise.all([
    loadCollections(),
    loadCEFRCollection('a1'),
    loadCEFRCollection('a2'),
    loadCEFRCollection('b1'),
    loadCEFRCollection('advanced'),
  ]);
  return [...main, a1, a2, b1, advanced];
}

export function getAllWords(collections: WordCollection[]): WordItem[] {
  return collections.flatMap(c => c.days.flatMap(d => d.words));
}

export function getWordOfDay(collections: WordCollection[]): WordItem | null {
  const allWords = getAllWords(collections);
  if (allWords.length === 0) return null;
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return allWords[dayOfYear % allWords.length];
}

export function searchWords(collections: WordCollection[], query: string): Array<WordItem & { collectionName: string; topic: string }> {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: Array<WordItem & { collectionName: string; topic: string }> = [];

  for (const col of collections) {
    for (const day of col.days) {
      for (const word of day.words) {
        if (
          word.word.toLowerCase().includes(q) ||
          word.translation.toLowerCase().includes(q) ||
          word.definition.toLowerCase().includes(q)
        ) {
          results.push({ ...word, collectionName: col.name, topic: day.topic });
        }
      }
    }
  }

  return results.slice(0, 50);
}
