// Folder / unit covers for Library and My Words. One short string, same
// format as Flutter lib/widgets/folder_cover.dart and the DB check in
// supabase/migrations/20261120000001_folder_covers.sql:
//   g:3        built-in gradient #3
//   e:🦊|3     emoji on gradient #3
//   img:<url>  uploaded picture in the public folder-covers bucket
//   null / ''  default look
// Keep the gradient list in the same order as Flutter — its index is what's
// stored. The emoji itself is stored, so icon groups can be reordered freely,
// but keep them (and their search words) identical to Flutter.
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

export interface CoverIconGroup {
  label: { en: string; uz: string; ru: string };
  // [emoji, search words (Uzbek + English)]
  icons: [string, string][];
}

export const COVER_ICON_GROUPS: CoverIconGroup[] = [
  { label: { en: 'Learning', uz: "O'qish", ru: 'Учёба' }, icons: [
    ['📚', "kitob kitoblar kutubxona book books library"],
    ['📖', "kitob o'qish read reading book"],
    ['✏️', "qalam yozish pencil write"],
    ['📝', "yozish eslatma note notes writing"],
    ['🗣️', "gapirish nutq speaking speak talk"],
    ['💬', "suhbat xabar chat conversation message"],
    ['🔤', "alifbo harf alphabet letters abc"],
    ['💡', "g'oya fikr idea"],
    ['🧠', "miya aql fikrlash brain mind think"],
    ['🎓', "universitet bitiruv talaba university graduation student"],
    ['🏆', "g'alaba mukofot trophy win prize"],
    ['🎯', "maqsad nishon goal target"],
    ['🧩', "jumboq boshqotirma puzzle"],
  ] },
  { label: { en: 'Travel', uz: 'Sayohat', ru: 'Путешествия' }, icons: [
    ['✈️', "samolyot aeroport uchish plane flight airport"],
    ['🌍', "dunyo yer world earth globe"],
    ['🏖️', "plyaj dengiz dam olish beach sea holiday"],
    ['🏔️', "tog' mountain"],
    ['🗺️', "xarita map"],
    ['🧳', "chamadon yuk suitcase luggage"],
    ['🏙️', "shahar city"],
    ['🕌', "masjid mosque"],
  ] },
  { label: { en: 'Transport', uz: 'Transport', ru: 'Транспорт' }, icons: [
    ['🚗', "mashina avtomobil car"],
    ['🚆', "poyezd train"],
    ['🚌', "avtobus bus"],
    ['🚲', "velosiped bicycle bike"],
    ['🚢', "kema ship boat"],
    ['🛵', "skuter moped scooter"],
    ['🚁', "vertolyot helicopter"],
    ['🚇', "metro subway underground"],
    ['⛽', "yoqilg'i benzin fuel petrol gas"],
  ] },
  { label: { en: 'Food', uz: 'Ovqat', ru: 'Еда' }, icons: [
    ['🍎', "olma meva apple fruit"],
    ['🍳', "ovqat pishirish oshxona tuxum cooking kitchen egg"],
    ['🍕', "pitsa pizza"],
    ['🍔', "burger fast food"],
    ['🍰', "tort shirinlik cake dessert"],
    ['☕', "kofe choy ichimlik coffee tea drink"],
    ['🍉', "tarvuz meva watermelon fruit"],
    ['🥗', "salat sabzavot salad vegetables"],
    ['🍞', "non bread bakery"],
    ['🧃', "sharbat ichimlik juice drink"],
  ] },
  { label: { en: 'Nature', uz: 'Tabiat', ru: 'Природа' }, icons: [
    ['🌿', "tabiat o'simlik barg nature plant leaf"],
    ['🌸', "gul bahor flower spring"],
    ['🌳', "daraxt o'rmon tree forest"],
    ['🌊', "dengiz to'lqin okean sea wave ocean"],
    ['☀️', "quyosh yoz ob-havo sun summer weather"],
    ['🌧️', "yomg'ir ob-havo rain weather"],
    ['❄️', "qor qish snow winter"],
    ['🌙', "oy tun moon night"],
    ['🌈', "kamalak rainbow"],
    ['♻️', "qayta ishlash ekologiya atrof-muhit recycle ecology environment"],
    ['🌱', "nihol o'sish atrof-muhit sprout grow environment"],
    ['🌋', "vulqon volcano"],
    ['🌪️', "bo'ron tornado storm"],
    ['🌡️', "harorat iqlim temperature climate"],
  ] },
  { label: { en: 'Animals', uz: 'Hayvonlar', ru: 'Животные' }, icons: [
    ['🐾', "hayvon iz uy hayvoni animal paw pet"],
    ['🐶', "it kuchuk dog puppy"],
    ['🐱', "mushuk cat"],
    ['🦁', "sher lion"],
    ['🐘', "fil elephant"],
    ['🦊', "tulki fox"],
    ['🐦', "qush bird"],
    ['🐟', "baliq fish"],
    ['🦋', "kapalak butterfly"],
  ] },
  { label: { en: 'Hobbies', uz: 'Sport va hobbi', ru: 'Спорт и хобби' }, icons: [
    ['⚽', "futbol to'p sport football soccer ball"],
    ['🏀', "basketbol sport basketball"],
    ['🎾', "tennis sport"],
    ['🏊', "suzish sport swimming swim"],
    ['🚴', "velosport sport cycling"],
    ['🏃', "yugurish sport running run"],
    ['🧘', "yoga meditatsiya meditation"],
    ['🎮', "o'yin video game gaming"],
    ['🎬', "kino film movie cinema"],
    ['📷', "surat foto camera photo"],
    ['🎨', "rasm san'at art painting"],
    ['🎵', "musiqa qo'shiq music song"],
    ['🎸', "gitara musiqa guitar music"],
    ['🎻', "skripka musiqa violin music"],
    ['🥁', "baraban musiqa drum music"],
    ['🎤', "mikrofon qo'shiq singing microphone"],
    ['🎭', "teatr theatre drama"],
    ['🖼️', "rasm muzey picture gallery museum"],
  ] },
  { label: { en: 'Work', uz: 'Ish va pul', ru: 'Работа и деньги' }, icons: [
    ['💼', "ish biznes work business job"],
    ['💰', "pul money"],
    ['💳', "karta to'lov card payment"],
    ['📈', "o'sish grafik iqtisod growth chart economy"],
    ['🏦', "bank"],
    ['🛠️', "asbob ta'mir tools repair"],
    ['👔', "ofis kiyim office formal"],
    ['👨‍💼', "ofis xodim menejer office worker manager"],
    ['👨‍⚕️', "shifokor doktor kasb doctor job"],
    ['👩‍🏫', "o'qituvchi ustoz kasb teacher job"],
    ['👮', "politsiya kasb police job"],
    ['👨‍🍳', "oshpaz kasb chef cook job"],
    ['👷', "quruvchi qurilish kasb builder construction job"],
    ['👨‍🌾', "dehqon fermer kasb farmer farm job"],
  ] },
  { label: { en: 'Tech & science', uz: 'Texnika va fan', ru: 'Техника и наука' }, icons: [
    ['💻', "kompyuter computer laptop"],
    ['📱', "telefon mobile phone smartphone"],
    ['🤖', "robot sun'iy intellekt ai"],
    ['🌐', "internet veb web"],
    ['🔒', "xavfsizlik qulf security lock"],
    ['🎧', "quloqchin tinglash headphones listening"],
    ['💾', "ma'lumot saqlash data save"],
    ['✉️', "xat pochta letter mail email"],
    ['📞', "qo'ng'iroq telefon call phone"],
    ['🔬', "fan mikroskop science microscope"],
    ['🔭', "teleskop astronomiya telescope astronomy"],
    ['🪐', "koinot sayyora space planet"],
    ['🚀', "raketa koinot rocket space"],
    ['🧪', "kimyo tajriba chemistry experiment"],
    ['🧬', "biologiya dnk biology dna"],
    ['⚛️', "fizika atom physics"],
    ['🧮', "matematika hisob math maths"],
    ['🔢', "raqam son numbers"],
  ] },
  { label: { en: 'Home & shopping', uz: 'Uy va xarid', ru: 'Дом и покупки' }, icons: [
    ['🏠', "uy home house"],
    ['🛋️', "mebel divan mehmonxona furniture sofa living room"],
    ['🛏️', "yotoqxona karavot bedroom bed"],
    ['🚿', "hammom dush bathroom shower"],
    ['🧹', "tozalash supurgi cleaning"],
    ['🪴', "gul tuvak o'simlik houseplant"],
    ['🛒', "xarid do'kon bozor shopping store market"],
    ['🛍️', "xarid sumka shopping bags"],
    ['👕', "kiyim futbolka clothes shirt"],
    ['👗', "ko'ylak kiyim dress clothes"],
    ['👟', "poyabzal krossovka shoes"],
    ['👜', "sumka bag"],
    ['🕶️', "ko'zoynak glasses sunglasses"],
  ] },
  { label: { en: 'People & health', uz: 'Odamlar va salomatlik', ru: 'Люди и здоровье' }, icons: [
    ['👨‍👩‍👧', "oila family"],
    ['👶', "bola chaqaloq baby child"],
    ['😊', "baxt quvonch his-tuyg'u happy emotions feelings"],
    ['😢', "qayg'u yig'i his-tuyg'u sad cry emotions"],
    ['🤝', "do'stlik kelishuv friendship agreement"],
    ['❤️', "sevgi yurak love heart"],
    ['💪', "kuch sport strong fitness"],
    ['🏥', "kasalxona shifoxona salomatlik hospital health"],
    ['💊', "dori salomatlik medicine pill health"],
    ['🩺', "tibbiyot shifokor medical doctor health"],
    ['🦷', "tish stomatolog tooth dentist"],
    ['👁️', "ko'z eye"],
    ['🫀', "yurak tana heart body"],
    ['🦠', "virus mikrob kasallik germ disease"],
  ] },
  { label: { en: 'Society', uz: 'Jamiyat', ru: 'Общество' }, icons: [
    ['🏛️', "hukumat muzey tarix government museum history"],
    ['🗳️', "saylov ovoz berish election vote"],
    ['📰', "yangiliklar gazeta media news newspaper"],
    ['⚖️', "qonun adolat sud law justice court"],
    ['🚔', "jinoyat politsiya crime police"],
    ['🕊️', "tinchlik peace"],
  ] },
  { label: { en: 'Time & events', uz: 'Vaqt va bayram', ru: 'Время и праздники' }, icons: [
    ['⏰', "vaqt soat budilnik time clock alarm"],
    ['⌛', "vaqt qum soat time hourglass"],
    ['📅', "kalendar sana jadval calendar date schedule"],
    ['🌅', "tong ertalab morning sunrise"],
    ['🌃', "kecha tun night"],
    ['🎉', "bayram ziyofat party celebration"],
    ['🎁', "sovg'a gift present"],
    ['🎂', "tug'ilgan kun tort birthday cake"],
    ['💍', "to'y uzuk wedding ring"],
    ['🎄', "yangi yil archa new year christmas"],
    ['🎆', "mushak salyut fireworks"],
    ['🔥', "olov issiq fire hot"],
    ['⭐', "yulduz star"],
    ['🌟', "yulduz porlash star shine"],
    ['💎', "olmos qimmatbaho diamond"],
    ['🔑', "kalit key"],
  ] },
];

// Typed apostrophes vary (o' / oʻ / o’); fold them all to ' before matching.
const foldSearch = (s: string) => s.toLowerCase().replace(/[ʻʼ‘’`]/g, "'").trim();

/// Icons whose topic name or search words contain every word of the query.
export function searchCoverIcons(query: string): string[] {
  const words = foldSearch(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out: string[] = [];
  for (const g of COVER_ICON_GROUPS) {
    const topic = foldSearch(`${g.label.en} ${g.label.uz} ${g.label.ru}`);
    for (const [emoji, kw] of g.icons) {
      const hay = `${topic} ${foldSearch(kw)}`;
      if (words.every(w => hay.includes(w)) && !out.includes(emoji)) out.push(emoji);
    }
  }
  return out;
}

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
  search:       { en: 'Search icons (food, doctor…)', uz: 'Belgi qidirish (ovqat, shifokor…)', ru: 'Поиск значка (еда, врач…)' },
  noResults:    { en: 'Nothing found', uz: 'Hech narsa topilmadi', ru: 'Ничего не найдено' },
} as const;

export function coverT(key: keyof typeof S): string {
  return S[key][getUILanguage() as 'en' | 'uz' | 'ru'] ?? S[key].en;
}
