// Generates lexivo/lib/data/word_forms_data.dart from lib/word-forms-data.ts.
// Run after editing the word forms: node scripts/word-forms-to-dart.js
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const src = fs.readFileSync(path.join(__dirname, '../lib/word-forms-data.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const m = { exports: {} };
new Function('exports', 'module', js)(m.exports, m);
const { WORD_FORMS } = m.exports;

const q = (s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$') + '"';

// Sanity checks — fail loudly instead of shipping a broken question.
const ids = new Set();
for (const w of WORD_FORMS) {
  if (ids.has(w.id)) throw new Error('duplicate id ' + w.id);
  ids.add(w.id);
  const gap = w.sentence.match(/\{([^}]+)\}/g);
  if (!gap || gap.length !== 1) throw new Error('need exactly one {answer} in ' + w.id);
  const answer = gap[0].slice(1, -1);
  if (w.wrong.length < 2) throw new Error('need at least 2 wrong options in ' + w.id);
  if (w.wrong.some(x => x.toLowerCase() === answer.toLowerCase())) throw new Error('answer listed as wrong in ' + w.id);
}

let out = '// GENERATED from lexivo-web/lib/word-forms-data.ts by scripts/word-forms-to-dart.js — do not edit by hand.\n\n';
out += 'class WordFormItem {\n';
out += '  final String id, section, base, target, uz, baseSentence, sentence;\n';
out += '  final List<String> wrong;\n';
out += '  const WordFormItem(this.id, this.section, this.base, this.target, this.uz, this.baseSentence, this.sentence, this.wrong);\n';
out += '}\n\n';
out += "const kWordFormSections = ['verb-noun', 'adj-noun', 'adj-adv'];\n\n";
out += 'const kWordForms = <WordFormItem>[\n';
for (const w of WORD_FORMS) {
  out += `  WordFormItem(${[w.id, w.section, w.base, w.target, w.uz, w.baseSentence, w.sentence].map(q).join(', ')}, [${w.wrong.map(q).join(', ')}]),\n`;
}
out += '];\n\n';
out += 'List<WordFormItem> wordFormsIn(String section) =>\n    kWordForms.where((w) => w.section == section).toList();\n';

fs.writeFileSync(path.join(__dirname, '../../lexivo/lib/data/word_forms_data.dart'), out);
console.log('wrote', WORD_FORMS.length, 'word forms');
