const fs = require('fs');
const src = fs.readFileSync('C:/Users/User/lexivo/lib/data/word_data.dart', 'utf8');

// Track depth at each WordDay( and check if it's always 1
let depth = 0, inSingle = false;
let prevDepth = 0;

for (let i = 1287; i < 862033; i++) {
  const ch = src[i];
  if (inSingle) {
    if (ch === '\\') { i++; continue; }
    if (ch === "'") inSingle = false;
  } else {
    if (ch === "'") inSingle = true;
    else if (ch === '(') {
      // Check if this is a WordDay(
      const before = src.slice(Math.max(0, i-8), i);
      if (before.includes('WordDay')) {
        if (depth !== 1) {
          console.log('WARNING: WordDay( at depth', depth, 'char', i);
          console.log('context:', JSON.stringify(src.slice(i-60, i+40)));
        }
      }
      depth++;
    }
    else if (ch === ')') {
      depth--;
      // After WordDay close, depth should be 1
      const after = src.slice(i, Math.min(src.length, i+50));
      if (depth === 2 && after.match(/^\),\r?\n\s+WordDay/)) {
        // This is a closing ) that should bring us to depth 1
        // but it brought us to 2 - problem!
        console.log('WordDay close at depth 2→2 (should be 2→1!) at char', i);
        console.log('context:', JSON.stringify(src.slice(i-30, i+50)));
      }
    }
  }
}
console.log('Final depth:', depth);
