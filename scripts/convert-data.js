#!/usr/bin/env node
// Robust Dart → JSON converter using parenthesis-depth counting

const fs = require('fs');
const path = require('path');

/**
 * Extract balanced-paren block starting at `src[start]` which must be '('
 * Returns the content between the outer parens (not including them).
 */
function extractBlock(src, start) {
  if (src[start] !== '(') return null;
  let depth = 0;
  let inSingle = false;
  let i = start;
  const end = src.length;
  while (i < end) {
    const ch = src[i];
    if (inSingle) {
      if (ch === '\\') { i += 2; continue; }   // skip escape
      if (ch === "'") inSingle = false;
    } else {
      // Skip // line comments
      if (ch === '/' && src[i + 1] === '/') {
        while (i < end && src[i] !== '\n') i++;
        continue;
      }
      if (ch === "'") inSingle = true;
      else if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) return src.slice(start + 1, i);
      }
    }
    i++;
  }
  return null;
}

/**
 * Extract all top-level blocks for a given keyword: `keyword(`...`)`
 */
function findBlocks(src, keyword) {
  const results = [];
  const pattern = new RegExp(`${keyword}\\s*\\(`, 'g');
  let m;
  while ((m = pattern.exec(src)) !== null) {
    const parenStart = m.index + m[0].length - 1;
    const block = extractBlock(src, parenStart);
    if (block !== null) results.push({ block, index: m.index });
  }
  return results;
}

/**
 * Extract a named field value from a Dart constructor block.
 * Handles single-quoted, double-quoted, and multi-line concatenated strings.
 */
function extractField(block, fieldName) {
  // Match: fieldName: 'value' or fieldName: "value"
  // Also handles: fieldName:\n    'value'
  const re = new RegExp(
    fieldName + ':\\s*' +
    '(?:\'((?:[^\'\\\\]|\\\\[\\s\\S])*)\'|"((?:[^"\\\\]|\\\\[\\s\\S])*)")',
    's'
  );
  const m = re.exec(block);
  if (!m) return '';
  const val = m[1] !== undefined ? m[1] : m[2];
  return val
    .replace(/\\n/g, ' ')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract a named list-of-strings field, e.g. `extraExamples: ['a', 'b'],`
 */
function extractArrayField(block, fieldName) {
  const re = new RegExp(fieldName + '\\s*:\\s*\\[([\\s\\S]*?)\\]');
  const m = re.exec(block);
  if (!m) return [];
  const itemRe = /'((?:[^'\\]|\\[\s\S])*)'|"((?:[^"\\]|\\[\s\S])*)"/g;
  const items = [];
  let im;
  while ((im = itemRe.exec(m[1])) !== null) {
    const val = im[1] !== undefined ? im[1] : im[2];
    items.push(
      val
        .replace(/\\n/g, ' ')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }
  return items;
}

function parseWordItem(block) {
  return {
    word:                     extractField(block, 'word'),
    partOfSpeech:             extractField(block, 'partOfSpeech'),
    pronunciation:            extractField(block, 'pronunciation'),
    translation:              extractField(block, 'translation'),
    definition:               extractField(block, 'definition'),
    definitionUz:             extractField(block, 'definitionUz'),
    example1:                 extractField(block, 'example1'),
    example1Situation:        extractField(block, 'example1Situation'),
    example1Translation:      extractField(block, 'example1Translation'),
    example2:                 extractField(block, 'example2'),
    example2Situation:        extractField(block, 'example2Situation'),
    example2Translation:      extractField(block, 'example2Translation'),
    example3:                 extractField(block, 'example3'),
    example3Situation:        extractField(block, 'example3Situation'),
    example3Translation:      extractField(block, 'example3Translation'),
    extraExamples:            extractArrayField(block, 'extraExamples'),
    extraExampleTranslations: extractArrayField(block, 'extraExampleTranslations'),
  };
}

function parseWordDay(block) {
  const dayNumberM = /dayNumber:\s*(\d+)/.exec(block);
  const topicM = /topic:\s*'([^']*)'/.exec(block);          // [^']* allows empty
  const dayNumber = dayNumberM ? parseInt(dayNumberM[1]) : 0;
  const topic = topicM ? topicM[1].trim() : '';

  const wordBlocks = findBlocks(block, 'WordItem');
  const words = wordBlocks.map(b => parseWordItem(b.block)).filter(w => w.word);
  return { dayNumber, topic, words };
}

function parseCollection(src) {
  const nameM = /name:\s*'([^']*)'/.exec(src);
  const descM = /description:\s*'([^']*)'/.exec(src);
  const name = nameM ? nameM[1] : 'Unknown';
  const description = descM ? descM[1] : '';

  const dayBlocks = findBlocks(src, 'WordDay');
  const days = dayBlocks.map(b => parseWordDay(b.block)).filter(d => d.words.length > 0);
  return { name, description, days };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const dataDir = 'C:/Users/User/lexivo/lib/data';
const outDir  = 'C:/Users/User/lexivo-web/public/data';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// ── --phrases-only: upsert phrases_collection.dart into word_data.json ───────
// The full conversion below is stale — the deployed a1/a2/b1 JSON has more
// units than the Dart files, so a full run would delete content. This mode
// touches only the Phrases entry of word_data.json and leaves the rest as-is.
// Usage: node scripts/convert-data.js --phrases-only
if (process.argv.includes('--phrases-only')) {
  // One WordCollection per CEFR level ("Phrases A1" … "Phrases C2"); every
  // existing Phrases* entry is replaced so removed/renamed levels don't linger.
  const src = fs.readFileSync(path.join(dataDir, 'phrases_collection.dart'), 'utf8');
  const phrases = findBlocks(src, 'WordCollection').map(b => parseCollection(b.block));
  const file = path.join(outDir, 'word_data.json');
  const cols = JSON.parse(fs.readFileSync(file, 'utf8')).filter(c => !c.name.startsWith('Phrases'));
  cols.push(...phrases);
  fs.writeFileSync(file, JSON.stringify(cols, null, 0));
  for (const p of phrases) {
    const total = p.days.reduce((a, d) => a + d.words.length, 0);
    console.log(`"${p.name}": ${p.days.length} days, ${total} words -> word_data.json`);
  }
  process.exit(0);
}

// ── word_data.dart: 3 collections ────────────────────────────────────────────
console.log('Converting word_data.dart...');
const mainSrc = fs.readFileSync(path.join(dataDir, 'word_data.dart'), 'utf8');

// Split at each `final xxxCollection = WordCollection(`
const boundaries = [];
const defRe = /\bfinal\s+\w+\s*=\s*WordCollection\s*\(/g;
let dm;
while ((dm = defRe.exec(mainSrc)) !== null) {
  const parenStart = dm.index + dm[0].length - 1;
  boundaries.push({ start: dm.index, parenStart });
}

const collections = [];
for (const { start, parenStart } of boundaries) {
  const block = extractBlock(mainSrc, parenStart);
  if (!block) { console.warn('  Could not extract block at', start); continue; }
  const col = parseCollection(block);
  const total = col.days.reduce((a, d) => a + d.words.length, 0);
  console.log(`  "${col.name}": ${col.days.length} days, ${total} words`);
  collections.push(col);
}

fs.writeFileSync(path.join(outDir, 'word_data.json'), JSON.stringify(collections, null, 0));

// ── CEFR files ────────────────────────────────────────────────────────────────
for (const fname of ['a1_collection', 'a2_collection', 'b1_collection', 'advanced_collection']) {
  console.log(`Converting ${fname}.dart...`);
  const src = fs.readFileSync(path.join(dataDir, `${fname}.dart`), 'utf8');

  // Find the single WordCollection block
  const re = /WordCollection\s*\(/g;
  let m = re.exec(src);
  if (!m) { console.warn(`  No WordCollection found in ${fname}`); continue; }

  const block = extractBlock(src, m.index + m[0].length - 1);
  if (!block) { console.warn(`  Could not extract block`); continue; }

  const col = parseCollection(block);
  const total = col.days.reduce((a, d) => a + d.words.length, 0);
  console.log(`  "${col.name}": ${col.days.length} days, ${total} words`);
  fs.writeFileSync(path.join(outDir, `${fname}.json`), JSON.stringify(col, null, 0));
}

console.log('Done!');
