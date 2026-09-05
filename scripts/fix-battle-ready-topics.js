// Checks and (where possible) auto-repairs lib/battle-ready-content/topics/<slug>.json
// files after you paste AI-generated content into them.
//
// Each topic file is plain JSON — either the literal value `null` (untouched
// placeholder) or an object matching BRTopicContent. Because JSON has no
// statements, keywords, or comments, the old TS bug (a pasted object parsed
// as a block statement, with `for:` triggering the for-loop keyword) is no
// longer possible. The one remaining mistake this script guards against is
// leaving the old `null` in the file alongside the newly pasted object
// (e.g. `null\n{ ... }`), which isn't valid JSON on its own — this script
// detects that and drops the stray `null`, keeping the object.
//
// Usage: node scripts/fix-battle-ready-topics.js

const fs = require('fs');
const path = require('path');

const TOPICS_DIR = path.join(__dirname, '..', 'lib', 'battle-ready-content', 'topics');

// Returns { status: 'empty' | 'filled' | 'fixed' | 'unresolved', fixedText?, error? }
function classify(raw) {
  const trimmed = raw.trim();

  try {
    const parsed = JSON.parse(trimmed);
    return { status: parsed === null ? 'empty' : 'filled' };
  } catch (e) {
    // Fall through to try the common recoverable mistake below.
  }

  // Common mistake: leftover `null` followed by the real pasted object,
  // e.g. `null\n{ "for": {...}, "against": {...} }`.
  const match = /^null\s*([\s\S]*)$/.exec(trimmed);
  if (match && match[1].trim().length > 0) {
    const rest = match[1].trim();
    try {
      const parsed = JSON.parse(rest);
      if (parsed !== null && typeof parsed === 'object') {
        return { status: 'fixed', fixedText: JSON.stringify(parsed, null, 2) + '\n' };
      }
    } catch (e) {
      return { status: 'unresolved', error: e.message };
    }
  }

  try {
    JSON.parse(trimmed);
  } catch (e) {
    return { status: 'unresolved', error: e.message };
  }
  return { status: 'unresolved', error: 'unrecognised content' };
}

function main() {
  const files = fs.readdirSync(TOPICS_DIR).filter(f => f.endsWith('.json'));
  let fixed = 0, empty = 0, filled = 0, unresolved = 0;
  const fixedNames = [];
  const unresolvedDetails = [];

  for (const file of files) {
    const fullPath = path.join(TOPICS_DIR, file);
    const raw = fs.readFileSync(fullPath, 'utf8');

    const result = classify(raw);
    if (result.status === 'fixed') {
      fs.writeFileSync(fullPath, result.fixedText, 'utf8');
      fixed++;
      fixedNames.push(file);
    } else if (result.status === 'unresolved') {
      unresolved++;
      unresolvedDetails.push(`${file}: ${result.error}`);
    } else if (result.status === 'empty') {
      empty++;
    } else {
      filled++;
    }
  }

  console.log(`Checked ${files.length} topic files.`);
  console.log(`  Fixed:      ${fixed}`);
  console.log(`  Filled OK:  ${filled}`);
  console.log(`  Empty:      ${empty}`);
  console.log(`  Unresolved: ${unresolved}`);
  if (fixedNames.length) console.log(`\nFixed:\n${fixedNames.map(n => `  - ${n}`).join('\n')}`);
  if (unresolvedDetails.length) console.log(`\nNeeds manual fix:\n${unresolvedDetails.map(n => `  - ${n}`).join('\n')}`);
}

main();
