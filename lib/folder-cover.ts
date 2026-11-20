// Folder / unit covers for Library and My Words. One short string, same
// format as Flutter lib/widgets/folder_cover.dart and the DB check in
// supabase/migrations/20261120000001_folder_covers.sql:
//   g:3        built-in gradient #3
//   e:🦊|3     emoji on gradient #3
//   img:<url>  uploaded picture in the public folder-covers bucket
//   null / ''  default look
// Keep the gradient and emoji lists in the same order as Flutter — the index
// is what's stored.
import type { CSSProperties } from 'react';
import { supabase } from './supabase';
import { getUILanguage } from './storage';

export const COVER_GRADIENTS: [string, string][] = [
  ['#6C63FF', '#9B8FFF'],
  ['#7C3AED', '#C084FC'],
  ['#4338CA', '#6366F1'],
  ['#DB2777', '#F472B6'],
  ['#EA580C', '#FB923C'],
  ['#059669', '#34D399'],
  ['#0284C7', '#38BDF8'],
  ['#334155', '#64748B'],
];

export const COVER_EMOJIS = [
  '📚', '✈️', '🍎', '💼', '🏠', '🎓', '🌍', '🎨',
  '⚽', '🎵', '🍳', '🏥', '💻', '🔬', '🐾', '🌿',
  '🚗', '🛒', '💬', '❤️', '⭐', '🔥', '🧠', '🎯',
  // Learning
  '✏️', '📖', '📝', '🗣️', '🔤', '💡', '🏆', '🧩',
  // Travel & places
  '🏖️', '🏔️', '🗺️', '🧳', '🚆', '🚌', '🚲', '🏙️', '🕌', '🏛️',
  // Food
  '🍕', '🍔', '🍰', '☕', '🍉', '🥗', '🍞', '🧃',
  // Nature & weather
  '🌸', '🌳', '🌊', '☀️', '🌧️', '❄️', '🌙', '🌈',
  // Animals
  '🐶', '🐱', '🦁', '🐘', '🦊', '🐦', '🐟', '🦋',
  // Sports & hobbies
  '🏀', '🎾', '🏊', '🚴', '🎮', '🎬', '📷', '🎸',
  // Work, money & tech
  '💰', '📈', '🏦', '🛠️', '⚖️', '👔', '📱', '🤖',
  // People, body & feelings
  '👨‍👩‍👧', '👶', '😊', '😢', '🤝', '💪', '👕', '💊',
  // Other
  '🎉', '🎁', '⏰', '📅', '🔑', '🚀', '💎', '🌟',
];

const BUCKET = 'folder-covers';
const PUBLIC_PREFIX = `https://jzozrqbzhagezlwncktf.supabase.co/storage/v1/object/public/${BUCKET}/`;

export interface CoverSpec { gradient: number; emoji?: string; imageUrl?: string }

// Null for "no cover" or anything malformed — callers then keep their
// default look. Image URLs outside our bucket are ignored on purpose.
export function parseCover(s: string | null | undefined): CoverSpec | null {
  if (!s) return null;
  const okG = (g: number) => Number.isInteger(g) && g >= 0 && g < COVER_GRADIENTS.length;
  if (s.startsWith('img:')) {
    const url = s.slice(4);
    return url.startsWith(PUBLIC_PREFIX) ? { gradient: 0, imageUrl: url } : null;
  }
  if (s.startsWith('g:')) {
    const g = Number(s.slice(2));
    return okG(g) ? { gradient: g } : null;
  }
  if (s.startsWith('e:')) {
    const bar = s.lastIndexOf('|');
    if (bar < 3) return null;
    const g = Number(s.slice(bar + 1));
    return okG(g) ? { gradient: g, emoji: s.slice(2, bar) } : null;
  }
  return null;
}

export function encodeCover(c: CoverSpec): string {
  return c.imageUrl ? `img:${c.imageUrl}` : c.emoji ? `e:${c.emoji}|${c.gradient}` : `g:${c.gradient}`;
}

export const coverGradientCss = (c: CoverSpec) =>
  `linear-gradient(135deg, ${COVER_GRADIENTS[c.gradient][0]}, ${COVER_GRADIENTS[c.gradient][1]})`;

// The cover's main colour, for shadows drawn around it.
export const coverColor = (c: CoverSpec) => COVER_GRADIENTS[c.gradient][0];

// CSS background for a box painted with the cover: the picture under a dark
// wash (so white text stays readable) over the gradient as a fallback, or
// just the gradient. Emoji is drawn separately (<CoverEmoji>).
export function coverBackground(c: CoverSpec): CSSProperties {
  if (c.imageUrl) {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.55)), url("${c.imageUrl}"), ${coverGradientCss(c)}`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return { background: coverGradientCss(c) };
}

/// Shrinks a picked image to ≤800px JPEG and uploads it; returns the cover string.
export async function uploadCoverImage(file: File, userId: string): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(b => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', 0.75));
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  return `img:${supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}`;
}

/// Best-effort: delete an uploaded picture that's no longer used. Only our
/// own files (folder = user id) — RLS would refuse anything else anyway.
export async function deleteCoverImage(cover: string | null | undefined, userId: string | undefined) {
  const url = parseCover(cover)?.imageUrl;
  if (!url || !userId) return;
  const path = url.slice(PUBLIC_PREFIX.length);
  if (!path.startsWith(`${userId}/`)) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.error('[deleteCoverImage]', error);
}

const S = {
  cover:        { en: 'Cover', uz: 'Muqova', ru: 'Обложка' },
  upload:       { en: 'Upload a picture', uz: 'Rasm yuklash', ru: 'Загрузить фото' },
  colour:       { en: 'Colour', uz: 'Rang', ru: 'Цвет' },
  icon:         { en: 'Icon', uz: 'Belgi', ru: 'Значок' },
  save:         { en: 'Save', uz: 'Saqlash', ru: 'Сохранить' },
  cancel:       { en: 'Cancel', uz: 'Bekor qilish', ru: 'Отмена' },
  resetFolder:  { en: 'Default look', uz: "Standart ko'rinish", ru: 'Обычный вид' },
  resetUnit:    { en: "Use the folder's cover", uz: 'Papka muqovasini ishlatish', ru: 'Как у папки' },
  uploading:    { en: 'Uploading…', uz: 'Yuklanmoqda…', ru: 'Загрузка…' },
  uploadFailed: { en: "Couldn't upload the picture", uz: "Rasmni yuklab bo'lmadi", ru: 'Не удалось загрузить фото' },
  saveFailed:   { en: "Couldn't save the cover", uz: "Muqovani saqlab bo'lmadi", ru: 'Не удалось сохранить обложку' },
} as const;

export function coverT(key: keyof typeof S): string {
  return S[key][getUILanguage() as 'en' | 'uz' | 'ru'] ?? S[key].en;
}
