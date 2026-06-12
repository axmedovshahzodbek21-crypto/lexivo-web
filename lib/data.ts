import type { WordCollection, WordItem } from './types';

const cache: Record<string, WordCollection | WordCollection[]> = {};

export async function loadCollections(): Promise<WordCollection[]> {
  if (cache['main']) return cache['main'] as WordCollection[];
  const res = await fetch('/data/word_data.json');
  const data: WordCollection[] = await res.json();
  cache['main'] = data;
  return data;
}

export async function loadCEFRCollection(level: 'a1' | 'a2' | 'b1' | 'advanced'): Promise<WordCollection> {
  if (cache[level]) return cache[level] as WordCollection;
  const res = await fetch(`/data/${level}_collection.json`);
  const data: WordCollection = await res.json();
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
