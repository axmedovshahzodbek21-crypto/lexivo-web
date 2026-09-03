// Converts lib/reading-data.ts → ../../lexivo/lib/data/reading_data.dart
//
// reading-data.ts is the single source of truth for the "Ideas" reading
// passages. The Flutter app ships a generated Dart copy — NEVER hand-edit
// reading_data.dart; edit the .ts and re-run this script.
//
//   node scripts/ts-to-dart.js           regenerate the Dart file
//   node scripts/ts-to-dart.js --check   exit 1 if the Dart file is stale
//                                        (used by `npm run check:reading-data`)
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const CHECK = process.argv.includes('--check');

const tsPath = path.join(__dirname, '../lib/reading-data.ts');
const dartPath = path.join(__dirname, '../../lexivo/lib/data/reading_data.dart');

// Read TypeScript file
const tsContent = fs.readFileSync(tsPath, 'utf-8');

// Strip TypeScript-specific syntax so we can eval as plain JS
let jsContent = tsContent
  .replace(/export interface \w+\s*\{[^}]*\}/gs, '')   // remove interface blocks
  .replace(/:\s*ReadingPassage\[\]/g, '')               // remove type annotation on const
  .replace(/^export /gm, '')                            // remove export keyword
  .replace(/\bconst\b/g, 'var');                        // const doesn't bind to vm context, var does

// Evaluate to extract the array
const ctx = {};
vm.createContext(ctx);
vm.runInContext(jsContent, ctx);
const passages = ctx.readingPassages;

if (!passages || passages.length === 0) {
  console.error('❌ No passages found. Check the TS file structure.');
  process.exit(1);
}

// Escape a string for Dart single-quoted string
function esc(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\$/g, '\\$');
}

// Escape content for Dart triple-quoted string (avoid ''' and $ interpolation)
function escTriple(s) {
  return String(s)
    .replace(/\$/g, '\\$')
    .replace(/'''/g, "''\\x27''");
}

// Build Dart file
let out = `// GENERATED FILE — DO NOT EDIT.
// Source of truth: lexivo-web/lib/reading-data.ts
// Regenerate:      node scripts/ts-to-dart.js   (in the lexivo-web repo)

class ReadingQuestion {
  final String question;
  final String explanation;

  const ReadingQuestion({
    required this.question,
    required this.explanation,
  });
}

class ReadingPassage {
  final int id;
  final String title;
  final String topic;
  final String content;
  final List<ReadingQuestion> questions;

  const ReadingPassage({
    required this.id,
    required this.title,
    required this.topic,
    required this.content,
    required this.questions,
  });
}

final List<ReadingPassage> readingPassages = [
`;

for (const p of passages) {
  out += `
  ReadingPassage(
    id: ${p.id},
    title: '${esc(p.title)}',
    topic: '${esc(p.topic)}',
    content: '''${escTriple(p.content)}''',
    questions: [
`;
  for (const q of p.questions) {
    out += `      ReadingQuestion(
        question: '${esc(q.question)}',
        explanation: '${esc(q.explanation)}',
      ),
`;
  }
  out += `    ],
  ),
`;
}

out += `];\n`;

if (CHECK) {
  const current = fs.existsSync(dartPath) ? fs.readFileSync(dartPath, 'utf-8') : '';
  if (current !== out) {
    console.error('❌ reading_data.dart is stale — run: node scripts/ts-to-dart.js');
    process.exit(1);
  }
  console.log(`✅ reading_data.dart is up to date (${passages.length} passages)`);
} else {
  fs.writeFileSync(dartPath, out, 'utf-8');
  console.log(`✅ Converted ${passages.length} passages → reading_data.dart`);
}
