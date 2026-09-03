/**
 * Shared "AI-assisted word import" logic: builds the prompt a user copies
 * into an AI chatbot to generate flashcard data for a list of words, and
 * parses the AI's structured text response back into word entries.
 *
 * This used to be implemented three times independently on the web:
 *   - app/import/page.tsx                        (My Words)
 *   - app/classes/[id]/words/page.tsx            (Class Words)
 *   - app/library/[folderId]/[unitId]/page.tsx   (Library)
 *
 * Kept in lockstep with the Flutter version at
 * lexivo/lib/services/ai_import.dart — the prompt text below is identical so
 * both platforms produce the same AI output shape. Each call site keeps only
 * a tiny adapter mapping AiParsedWord -> its own domain type.
 */

/** One AI-generated flashcard entry, parsed from the AI's response text.
 *  Optional fields are `undefined` (not '') when the AI didn't provide them,
 *  so callers can distinguish "not given" from "given but blank". */
export interface AiParsedWord {
  word: string;
  translation: string;
  definition: string;
  partOfSpeech?: string;
  pronunciation?: string;
  definitionUz?: string;
  examples: { sentence: string; translation: string }[];
}

export interface AiParseResult {
  words: AiParsedWord[];
  totalBlocks: number;
  errors: { index: number; preview: string; reason: string }[];
}

// Shared illustrative "enormous" example block shown to the AI, up to 10
// examples — a fully worked concrete example gets far more reliable AI
// compliance than abstract bracket placeholders like "[example sentence]".
const EXAMPLE_FORMAT_BLOCK = `example1: The enormous building towered above the city.
example1Translation: Ulkan bino shahar ustida baland turardi.
example2: She faced an enormous challenge at work.
example2Translation: U ishda ulkan muammoga duch keldi.
example3: The storm caused enormous damage to the coastline.
example3Translation: Bo'ron qirg'oqqa ulkan zarar yetkazdi.
example4: He made an enormous effort to finish the project on time.
example4Translation: U loyihani o'z vaqtida tugatish uchun ulkan harakat qildi.
example5: The discovery had an enormous impact on modern science.
example5Translation: Bu kashfiyot zamonaviy fanga ulkan ta'sir ko'rsatdi.
example6: The company invested an enormous amount of money in research.
example6Translation: Kompaniya tadqiqotlarga ulkan miqdorda mablag' sarfladi.
example7: Cleaning up after the enormous storm took several weeks.
example7Translation: Ulkan bo'rondan keyin tozalash bir necha hafta davom etdi.
example8: The enormous crowd gathered to watch the festival.
example8Translation: Festivalni tomosha qilish uchun ulkan olomon to'plandi.
example9: Losing his job was an enormous setback for him.
example9Translation: Ishini yo'qotish u uchun ulkan qiyinchilik bo'ldi.
example10: The enormous mountain range stretched across the horizon.
example10Translation: Ulkan tog' tizmasi ufq bo'ylab cho'zilgan edi.`;

/** Builds the prompt a user copies into an AI chatbot to generate flashcard
 *  data for `words` (a bare word list, or word-translation pairs when
 *  `hasTranslations` is true — in which case the AI is told to keep the given
 *  translation verbatim instead of producing its own). */
export function buildAiImportPrompt(opts: {
  wordLang: string;
  translationLang: string;
  words: string;
  hasTranslations?: boolean;
}): string {
  const { wordLang, translationLang, words, hasTranslations = false } = opts;

  const intro = hasTranslations
    ? `I have ${wordLang}-${translationLang} word pairs. For each pair, keep my translation exactly as written. Add a short definition in ${wordLang}, a short explanation in ${translationLang} (definitionUz), and up to 10 example sentences in ${wordLang} with their ${translationLang} translations.`
    : `I have a list of ${wordLang} words I want to learn. For each word, provide the translation in ${translationLang}, a short definition in ${wordLang}, and up to 10 example sentences in ${wordLang} with their ${translationLang} translations.`;
  const wordsLabel = hasTranslations
    ? 'Here are my pairs (word - translation):'
    : 'Here are my words:';

  return `${intro}

Format EXACTLY like this for every word. Use plain text only — no markdown, no bold, no asterisks, no extra formatting:

word: enormous
partOfSpeech: adjective
pronunciation: /ɪˈnɔːrməs/
translation: ulkan
definition: extremely large in size or extent
definitionUz: Ulkan — juda katta yoki keng hajmga ega bo'lgan narsa yoki hodisa.
${EXAMPLE_FORMAT_BLOCK}
---

Important: the example above uses English/Uzbek only to show the format. In your actual response, write the definition, part of speech, and examples in ${wordLang}, the translations and definitionUz in ${translationLang}.

${wordsLabel}
${words}`;
}

function splitIntoBlocks(text: string): string[] {
  // Primary: split by --- separator.
  if (/---+/.test(text)) {
    return text.split(/---+/).map(b => b.trim()).filter(Boolean);
  }
  // Fallback: start a new block each time a `word:` line appears after one
  // already seen — recovers when the AI omitted the --- separators.
  const blocks: string[] = [];
  const lines = text.split('\n');
  let current: string[] = [];
  for (const line of lines) {
    if (/^word\s*:/i.test(line.trim()) && current.some(l => /^word\s*:/i.test(l.trim()))) {
      blocks.push(current.join('\n').trim());
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current.join('\n').trim());
  return blocks.filter(Boolean);
}

/** Parses an AI chatbot's structured text response (in the format produced by
 *  `buildAiImportPrompt`) back into word entries. Tolerant of the
 *  capitalized-with-spaces key style ("Word:", "Part of speech:", "Example 1
 *  Translation:") that older prompt wording used — keys are normalized by
 *  lowercasing and stripping whitespace / markdown characters before matching. */
export function parseAiImportOutput(text: string): AiParseResult {
  if (!text.trim()) return { words: [], totalBlocks: 0, errors: [] };

  const blocks = splitIntoBlocks(text);
  const words: AiParsedWord[] = [];
  const errors: AiParseResult['errors'] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const fields: Record<string, string> = {};
    for (const line of lines) {
      const colon = line.indexOf(':');
      if (colon === -1) continue;
      // Strip whitespace too so "Example 1:" / "Part of speech:" and
      // "example1:" / "partOfSpeech:" key styles both parse.
      let key = line.slice(0, colon).trim().toLowerCase().replace(/[*_`#\s]/g, '');
      if (key === 'uzbekdefinition') key = 'definitionuz';
      const val = line.slice(colon + 1).trim().replace(/[*_`]/g, '');
      fields[key] = val;
    }

    const preview = block.slice(0, 40).replace(/\n/g, ' ');
    if (!fields.word && !fields.translation) {
      errors.push({ index: i + 1, preview, reason: 'Missing both "word:" and "translation:" fields' });
      continue;
    }
    if (!fields.word) {
      errors.push({ index: i + 1, preview, reason: 'Missing "word:" field' });
      continue;
    }
    if (!fields.translation) {
      errors.push({ index: i + 1, preview, reason: 'Missing "translation:" field' });
      continue;
    }

    // Capped at 10 — the storage layers also cap at 10, so collecting more
    // here would let the preview show examples that then silently got
    // truncated on save.
    const examples: AiParsedWord['examples'] = [];
    for (let n = 1; n <= 10; n++) {
      const sentence = fields[`example${n}`];
      if (!sentence) continue;
      examples.push({ sentence, translation: fields[`example${n}translation`] ?? '' });
    }

    words.push({
      word: fields.word,
      translation: fields.translation,
      definition: fields.definition ?? '',
      partOfSpeech: fields.partofspeech || undefined,
      pronunciation: fields.pronunciation || undefined,
      definitionUz: fields.definitionuz || undefined,
      examples,
    });
  }

  return { words, totalBlocks: blocks.length, errors };
}
