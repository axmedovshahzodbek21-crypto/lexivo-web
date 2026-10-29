// Regenerates lexivo/lib/data/student_summary_sentences.dart from lib/student-summary-sentences.ts.
// Run after editing summary sentences: node scripts/student-summary-to-dart.js
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const src = fs.readFileSync(path.join(__dirname, '../lib/student-summary-sentences.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const m = { exports: {} };
new Function('exports', 'module', js)(m.exports, m);
const { SUMMARY_SENTENCES, SUMMARY_WORDS } = m.exports;

const q = (s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$') + '"';
let out = '// GENERATED from lexivo-web/lib/student-summary-sentences.ts by\n';
out += '// lexivo-web/scripts/student-summary-to-dart.js — do not edit by hand.\n\n';
out += 'const summaryWords = <String, Map<String, String>>{\n';
for (const [lang, words] of Object.entries(SUMMARY_WORDS)) {
  out += `  '${lang}': {\n`;
  for (const [k, v] of Object.entries(words)) out += `    '${k}': ${q(v)},\n`;
  out += '  },\n';
}
out += '};\n\n';
out += 'const summarySentences = <String, Map<String, List<String>>>{\n';
for (const [code, langs] of Object.entries(SUMMARY_SENTENCES)) {
  out += `  '${code}': {\n`;
  for (const [lang, versions] of Object.entries(langs)) {
    out += `    '${lang}': [\n`;
    for (const v of versions) out += `      ${q(v)},\n`;
    out += '    ],\n';
  }
  out += '  },\n';
}
out += '};\n';

const dartPath = path.join(__dirname, '../../lexivo/lib/data/student_summary_sentences.dart');
fs.writeFileSync(dartPath, out);
console.log('wrote', Object.keys(SUMMARY_SENTENCES).length, 'cases');
