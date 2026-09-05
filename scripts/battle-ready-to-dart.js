// Converts lib/battle-ready-content/topics/*.json (+ the topic list in
// lib/debateMock.ts) → ../../lexivo/lib/data/battle_ready_data.dart
//
// Mirrors the existing scripts/ts-to-dart.js convention: web content is the
// source of truth, the Dart file is generated, never hand-edited.
//
// Usage: node scripts/battle-ready-to-dart.js

const fs = require('fs');
const path = require('path');

const TOPICS_DIR = path.join(__dirname, '..', 'lib', 'battle-ready-content', 'topics');
const DEBATE_MOCK_PATH = path.join(__dirname, '..', 'lib', 'debateMock.ts');
const DART_PATH = path.join(__dirname, '../../lexivo/lib/data/battle_ready_data.dart');

function slugify(title, dedupeSuffix) {
  const base = title
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return dedupeSuffix ? `${base}-${dedupeSuffix}` : base;
}

function loadTopics() {
  const src = fs.readFileSync(DEBATE_MOCK_PATH, 'utf8');
  const match = /TOPIC_TITLES[\s\S]*?=\s*\[([\s\S]*?)\n\];/.exec(src);
  if (!match) throw new Error('Could not find TOPIC_TITLES in debateMock.ts');
  const pairRe = /\[\s*['"]((?:[^'"\\]|\\.)*)['"]\s*,\s*['"]([^'"]*)['"]\s*\]/g;
  const raw = [];
  let m;
  while ((m = pairRe.exec(match[1]))) {
    raw.push([m[1].replace(/\\'/g, "'"), m[2]]);
  }

  const seen = new Set();
  return raw.map(([title, emoji]) => {
    let slug = slugify(title);
    if (seen.has(slug)) slug = slugify(title, '2');
    seen.add(slug);
    return { slug, title, emoji };
  });
}

// Dart string literal, single-quoted, escaping backslash/quote/$.
function dstr(s) {
  if (s === undefined || s === null) return 'null';
  const escaped = String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\$/g, '\\$')
    .replace(/\n/g, '\\n');
  return `'${escaped}'`;
}

function dlist(items, mapper) {
  if (!items || items.length === 0) return '[]';
  return `[\n${items.map(i => `        ${mapper(i)},`).join('\n')}\n      ]`;
}

function vocabDart(v) {
  return `BRVocabItem(term: ${dstr(v.term)}, definition: ${dstr(v.definition)}, example: ${dstr(v.example)})`;
}
function phraseDart(p) {
  const examples = dlist(p.examples, dstr);
  return `BRPhraseItem(phrase: ${dstr(p.phrase)}, examples: ${examples})`;
}
function idiomDart(i) {
  const examples = dlist(i.examples, dstr);
  return `BRIdiomItem(idiom: ${dstr(i.idiom)}, definition: ${dstr(i.definition)}, examples: ${examples})`;
}
function argumentDart(a) {
  return `BRArgumentItem(claim: ${dstr(a.claim)}, explanation: ${dstr(a.explanation)})`;
}

function sideContentDart(side) {
  return `BRSideContent(
      vocab: ${dlist(side.vocab, vocabDart)},
      phrases: ${dlist(side.phrases, phraseDart)},
      idioms: ${dlist(side.idioms, idiomDart)},
      arguments: ${dlist(side.arguments, argumentDart)},
    )`;
}

function main() {
  const topics = loadTopics();
  const contentEntries = [];
  let filled = 0, empty = 0;

  for (const { slug } of topics) {
    const jsonPath = path.join(TOPICS_DIR, `${slug}.json`);
    if (!fs.existsSync(jsonPath)) continue;
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (data === null) { empty++; continue; }
    filled++;
    contentEntries.push(`  ${dstr(slug)}: BRTopicContent(
    motion: ${dstr(data.motion)},
    forSide: ${sideContentDart(data.for)},
    against: ${sideContentDart(data.against)},
  ),`);
  }

  const topicsListDart = topics
    .map(t => `  BRTopic(slug: ${dstr(t.slug)}, title: ${dstr(t.title)}, emoji: ${dstr(t.emoji)}),`)
    .join('\n');

  const out = `// AUTO-GENERATED — mechanically ported from lexivo-web/lib/battle-ready-content/.
// Do not hand-edit content here; regenerate from the web source instead so
// the two apps' Battle-Ready content never drifts apart.
// Regenerate: node scripts/battle-ready-to-dart.js   (in the lexivo-web repo)

class BRVocabItem {
  final String term, definition, example;
  const BRVocabItem({required this.term, required this.definition, required this.example});
}

class BRPhraseItem {
  final String phrase;
  final List<String> examples;
  const BRPhraseItem({required this.phrase, required this.examples});
}

class BRIdiomItem {
  final String idiom, definition;
  final List<String> examples;
  const BRIdiomItem({required this.idiom, required this.definition, required this.examples});
}

class BRArgumentItem {
  final String claim, explanation;
  const BRArgumentItem({required this.claim, required this.explanation});
}

class BRSideContent {
  final List<BRVocabItem> vocab;
  final List<BRPhraseItem> phrases;
  final List<BRIdiomItem> idioms;
  final List<BRArgumentItem> arguments;
  const BRSideContent({
    required this.vocab,
    required this.phrases,
    required this.idioms,
    required this.arguments,
  });
}

class BRTopicContent {
  final String? motion;
  final BRSideContent forSide;
  final BRSideContent against;
  const BRTopicContent({this.motion, required this.forSide, required this.against});
}

class BRTopic {
  final String slug, title, emoji;
  const BRTopic({required this.slug, required this.title, required this.emoji});
}

const List<BRTopic> kBattleReadyTopics = [
${topicsListDart}
];

/// Keyed by topic slug. A topic with no content yet is simply absent here —
/// check with \`kBattleReadyContent.containsKey(slug)\` or \`?[slug]\`.
const Map<String, BRTopicContent> kBattleReadyContent = {
${contentEntries.join('\n')}
};
`;

  fs.mkdirSync(path.dirname(DART_PATH), { recursive: true });
  fs.writeFileSync(DART_PATH, out, 'utf8');
  console.log(`Wrote ${DART_PATH}`);
  console.log(`${topics.length} topics total — ${filled} filled, ${empty} empty (omitted from the map).`);
}

main();
