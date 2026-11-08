'use client';
// Library bulk import: paste a big list into a folder, the database splits it
// into units (RPC bulk_import_unit_words). Mirrors lexivo
// lib/screens/bulk_import_sheet.dart.
import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getUILanguage } from '@/lib/storage';
import { buildAiImportPrompt, parseAiImportOutput } from '@/lib/ai-import';

const S = {
  button:      { en: 'Bulk import', uz: "Ko'p so'z qo'shish", ru: 'Массовый импорт' },
  sub:         { en: 'Paste a big list and it is split into units automatically.', uz: "Katta ro'yxatni joylang, u avtomatik unitlarga bo'linadi.", ru: 'Вставьте большой список, он сам разделится на юниты.' },
  plain:       { en: 'Word list', uz: "So'z ro'yxati", ru: 'Список слов' },
  ai:          { en: 'AI cards', uz: 'AI kartalar', ru: 'AI-карточки' },
  plainHint:   { en: 'One pair per line: word - translation. Any length. Cards have no definition or examples.', uz: "Har qatorda bitta juftlik: so'z - tarjima. Uzunligi cheklanmagan. Kartalarda ta'rif va misollar bo'lmaydi.", ru: 'По одной паре в строке: слово - перевод. Любая длина. В карточках не будет определений и примеров.' },
  aiHint:      { en: 'Full cards. Send the AI a few dozen words at a time, then paste each answer here. Each round continues where the last one stopped.', uz: "To'liq kartalar. AIga bir safar bir necha o'nta so'z yuboring, har bir javobni shu yerga joylang. Har safar oldingi joydan davom etadi.", ru: 'Полные карточки. Отправляйте AI по несколько десятков слов и вставляйте каждый ответ сюда. Каждый раунд продолжает предыдущий.' },
  aiWords:     { en: 'Words for the AI', uz: "AI uchun so'zlar", ru: 'Слова для AI' },
  copyPrompt:  { en: 'Copy prompt', uz: 'Promptni nusxalash', ru: 'Скопировать промпт' },
  copied:      { en: 'Copied ✓', uz: 'Nusxalandi ✓', ru: 'Скопировано ✓' },
  aiAnswer:    { en: "Paste the AI's answer", uz: 'AI javobini joylang', ru: 'Вставьте ответ AI' },
  unitSize:    { en: 'Words per unit (5-100)', uz: "Har unitda so'z (5-100)", ru: 'Слов в юните (5-100)' },
  preview:     { en: '{w} words → about {u} units. Words already in this folder are skipped.', uz: "{w} ta so'z → taxminan {u} ta unit. Papkada bor so'zlar o'tkazib yuboriladi.", ru: '{w} слов → примерно {u} юнитов. Слова, уже есть в папке, пропускаются.' },
  badLines:    { en: '{n} lines could not be read and will be skipped.', uz: "{n} ta qatorni o'qib bo'lmadi, ular o'tkazib yuboriladi.", ru: 'Строк не удалось прочитать: {n}, они будут пропущены.' },
  importBtn:   { en: 'Import', uz: "Qo'shish", ru: 'Импортировать' },
  importing:   { en: 'Importing…', uz: "Qo'shilmoqda…", ru: 'Импорт…' },
  cancel:      { en: 'Cancel', uz: 'Bekor qilish', ru: 'Отмена' },
  done:        { en: 'Added {a} words in {u} new units. Skipped: {s}.', uz: "{a} ta so'z qo'shildi, {u} ta yangi unit. O'tkazib yuborildi: {s}.", ru: 'Добавлено слов: {a}, новых юнитов: {u}. Пропущено: {s}.' },
  failed:      { en: 'Could not import', uz: "Qo'shib bo'lmadi", ru: 'Не удалось импортировать' },
} as const;

export function bulkT(key: keyof typeof S): string {
  return S[key][getUILanguage()] ?? S[key].en;
}

/** "word - translation" per line; also tab-separated (Excel) and "1. word - translation". */
function parsePlainList(text: string) {
  const words: { word: string; translation: string }[] = [];
  let bad = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^\d+[.)]\s*/, '');
    if (!line) continue;
    const m = line.match(/^(.+?)\t+(.+)$/) ?? line.match(/^(.+?)\s+[-–—]\s+(.+)$/) ?? line.match(/^([^-]+)-([^-]+)$/);
    if (m && m[1].trim() && m[2].trim()) words.push({ word: m[1].trim(), translation: m[2].trim() });
    else bad++;
  }
  return { words, bad };
}

export default function BulkImportModal({ folderId, onClose, onDone }: {
  folderId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<'plain' | 'ai'>('plain');
  const [plainText, setPlainText] = useState('');
  const [aiWords, setAiWords] = useState('');
  const [aiText, setAiText] = useState('');
  const [size, setSize] = useState('15');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const plain = useMemo(() => parsePlainList(plainText), [plainText]);
  const ai = useMemo(() => (aiText.trim() ? parseAiImportOutput(aiText) : null), [aiText]);

  const count = mode === 'plain' ? plain.words.length : (ai?.words.length ?? 0);
  const bad = mode === 'plain' ? plain.bad : (ai?.errors.length ?? 0);
  const sizeNum = Number(size);
  const sizeOk = Number.isInteger(sizeNum) && sizeNum >= 5 && sizeNum <= 100;

  function copyPrompt() {
    const words = aiWords.trim() || 'apple, book, water';
    navigator.clipboard.writeText(buildAiImportPrompt({
      wordLang: 'English', translationLang: 'Uzbek', words,
      hasTranslations: /\s[-–—]\s|\t/.test(words),
    }));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function run() {
    if (!count || !sizeOk) return;
    setBusy(true);
    const payload = mode === 'plain' ? plain.words : ai!.words.map(w => ({
      word: w.word,
      translation: w.translation,
      definition: w.definition,
      part_of_speech: w.partOfSpeech,
      pronunciation: w.pronunciation,
      definition_uz: w.definitionUz,
      examples: w.examples.slice(0, 10),
    }));
    const { data, error } = await supabase.rpc('bulk_import_unit_words', {
      p_folder_id: folderId, p_words: payload, p_unit_size: sizeNum,
    });
    if (error) { console.error('[BulkImportModal]', error); alert(`${bulkT('failed')}: ${error.message}`); setBusy(false); return; }
    alert(bulkT('done').replace('{a}', String(data.added)).replace('{u}', String(data.units)).replace('{s}', String(data.skipped)));
    onDone();
  }

  const area = 'w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none focus:border-[var(--primary)] resize-none';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg bg-[var(--surface)] rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <p className="font-bold text-lg text-[var(--text)]">📥 {bulkT('button')}</p>
          <p className="text-xs text-[var(--text-muted)]">{bulkT('sub')}</p>
        </div>

        <div className="flex gap-1 p-1 bg-[var(--surface-2)] rounded-xl">
          {(['plain', 'ai'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === m ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm' : 'text-[var(--text-muted)]'}`}>
              {bulkT(m)}
            </button>
          ))}
        </div>

        {mode === 'plain' ? (
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-2">{bulkT('plainHint')}</p>
            <textarea rows={9} value={plainText} onChange={e => setPlainText(e.target.value)} placeholder={'apple - olma\nbook - kitob'} className={area} />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-muted)]">{bulkT('aiHint')}</p>
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">{bulkT('aiWords')}</p>
              <textarea rows={3} value={aiWords} onChange={e => setAiWords(e.target.value)} placeholder="apple, book, water" className={area} />
              <button onClick={copyPrompt} className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-bg)] transition-colors">
                {copied ? bulkT('copied') : bulkT('copyPrompt')}
              </button>
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">{bulkT('aiAnswer')}</p>
              <textarea rows={6} value={aiText} onChange={e => setAiText(e.target.value)} className={area} />
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-[var(--text-muted)] mb-1">{bulkT('unitSize')}</p>
          <input type="number" min={5} max={100} value={size} onChange={e => setSize(e.target.value)}
            className="w-24 px-3 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text)] text-sm border border-[var(--border)] outline-none focus:border-[var(--primary)]" />
        </div>

        {count > 0 && sizeOk && (
          <p className="text-xs font-semibold text-[var(--primary)]">
            {bulkT('preview').replace('{w}', String(count)).replace('{u}', String(Math.ceil(count / sizeNum)))}
          </p>
        )}
        {bad > 0 && <p className="text-xs text-[var(--danger)]">{bulkT('badLines').replace('{n}', String(bad))}</p>}

        <button disabled={busy || !count || !sizeOk} onClick={run} className="w-full btn-primary py-3 disabled:opacity-50">
          {busy ? bulkT('importing') : bulkT('importBtn')}
        </button>
        <button onClick={onClose} disabled={busy} className="w-full btn-ghost py-2.5">{bulkT('cancel')}</button>
      </div>
    </div>
  );
}
