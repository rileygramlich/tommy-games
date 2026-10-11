// Builds public/data/quiddler-words.txt: Scrabble-legal words, no proper nouns.
//
// The base is ENABLE (public domain), the list Words With Friends and most Scrabble
// apps grew from; it tracks the North American tournament list closely. On top go
// the current two-letter words and well-known later additions ENABLE predates.
// Lengths run 2..20: ten cards, and the cl/er/in/qu/th cards carry two letters.
// Output is sorted, newline-separated, so the client does prefix lookups by
// binary search instead of building a trie.
//
// Usage: node scripts/build-dictionary.mjs [path/to/enable1.txt]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const ENABLE_URL = 'https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt';

// The tournament two-letter set (NWL2023).
const TWOS = `aa ab ad ae ag ah ai al am an ar as at aw ax ay ba be bi bo by da de do ed ef
eh el em en er es et ew ex fa fe gi go ha he hi hm ho id if in is it jo ka ki la li lo ma me mi
mm mo mu my na ne no nu od oe of oh oi ok om on op or os ow ox oy pa pe pi po qi re sh si so
ta te ti to uh um un up us ut we wo xi xu ya ye yo za`.split(/\s+/);

// Common words added to the tournament lists after ENABLE was frozen.
const LATER = `bromance bromances chillax ew emoji emojis facetime frenemy frenemies hashtag
hashtags onesie onesies qapik qat qats qis selfie selfies texted texting vlog vlogs vlogger
yowza zen zens zas`.split(/\s+/);

const src = process.argv[2]
  ? readFileSync(process.argv[2], 'utf8')
  : await (await fetch(ENABLE_URL)).text();

const words = new Set([...TWOS, ...LATER]);
for (const line of src.split('\n')) {
  const w = line.trim();
  // ENABLE has no capitalised entries; the check also drops anything malformed.
  if (/^[a-z]{3,20}$/.test(w)) words.add(w);
}
if (words.size < 100000) {
  console.error(`Only ${words.size} words; the source looks wrong. Leaving the dictionary untouched.`);
  process.exit(1);
}
const sorted = [...words].sort();
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/quiddler-words.txt', sorted.join('\n') + '\n');
console.log(`wrote ${sorted.length} words`);
