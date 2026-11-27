import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { readFile } from 'fs/promises';
import path from 'path';
import WordDetailClient from './WordDetailClient';
import { wordKey, wordPath } from '@/lib/share';
import type { WordCollection } from '@/lib/types';

// Server-side lookup so a shared /word/<word> link gets a Telegram/WhatsApp
// preview card (title + translation). The page itself stays client-side.
const DATA_FILES = ['word_data.json', 'a1_collection.json', 'a2_collection.json', 'b1_collection.json', 'advanced_b2.json', 'advanced_c1.json', 'advanced_c2.json'];

type PreviewWord = { word: string; translation: string; definition: string; partOfSpeech: string };
let index: Map<string, PreviewWord> | null = null;

async function getIndex(): Promise<Map<string, PreviewWord>> {
  if (index) return index;
  const map = new Map<string, PreviewWord>();
  for (const file of DATA_FILES) {
    try {
      const raw = JSON.parse(await readFile(path.join(process.cwd(), 'public', 'data', file), 'utf8'));
      const cols: WordCollection[] = Array.isArray(raw) ? raw : [raw];
      for (const col of cols) for (const day of col.days) for (const w of day.words) {
        const key = wordKey(w.word);
        if (!map.has(key)) map.set(key, { word: w.word, translation: w.translation, definition: w.definition, partOfSpeech: w.partOfSpeech });
      }
    } catch { /* missing file → just no preview for those words */ }
  }
  index = map;
  return map;
}

const strip = (s: string | undefined) => (s ?? '').replace(/<[^>]*>/g, '');

export async function generateMetadata({ params }: { params: Promise<{ word: string }> }): Promise<Metadata> {
  const wordText = decodeURIComponent((await params).word);
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host}`;

  const w = (await getIndex()).get(wordKey(wordText));
  if (!w) return { title: `${wordText} · Lexivo` };

  const title = `${strip(w.word)} — ${strip(w.translation)}`;
  const description = strip(w.definition) || 'Ingliz so\'zlarini o\'zbekcha tarjimasi bilan bepul o\'rganing.';
  const url = `${origin}${wordPath(w.word)}`;
  return {
    title: `${title} · Lexivo`,
    description,
    openGraph: { title, description, url, siteName: 'Lexivo', type: 'website', images: [`${origin}/icon-512.png`] },
    twitter: { card: 'summary', title, description },
  };
}

export default async function WordPage({ params }: { params: Promise<{ word: string }> }) {
  const wordText = decodeURIComponent((await params).word);
  return <WordDetailClient wordText={wordText} />;
}
