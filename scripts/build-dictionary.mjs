// Builds public/data/quiddler-words.txt from a system word list.
// Words are lowercase a-z, 2..10 letters (a Quiddler hand never exceeds 10 cards,
// and the shortest legal word is 2 letters). Output is sorted, newline-separated,
// which lets the client do prefix lookups by binary search instead of a trie.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SOURCES = ['/usr/share/dict/american-english', '/usr/share/dict/words'];

// The standard tournament two-letter set. System dictionaries are stingy here and
// two-letter words are the difference between going out and eating a leftover card.
const TWOS = `aa ab ad ae ag ah ai al am an ar as at aw ax ay ba be bi bo by da de do ed ef
eh el em en er es et ex fa fe gi go ha he hi hm ho id if in is it jo ka ki la li lo ma me mi
mm mo mu my na ne no nu od oe of oh oi ok om on op or os ow ox oy pa pe pi po qi re sh si so
ta te ti to uh um un up us ut we wo xi xu ya ye yo za`.split(/\s+/);

// Genuine vowel-free words, which the abbreviation filter below would eat.
const VOWELLESS = new Set(['brr', 'brrr', 'crwth', 'crwths', 'cwm', 'cwms', 'grr', 'hmm',
  'hmmm', 'nth', 'pfft', 'phpht', 'pht', 'psst', 'shh', 'shhh', 'tsk', 'tsks', 'tsktsk']);

const words = new Set(TWOS);
for (const src of SOURCES) {
  let raw;
  try { raw = readFileSync(src, 'utf8'); } catch { continue; }
  for (const line of raw.split('\n')) {
    // Only already-lowercase entries: uppercase means a proper noun, which is not
    // a legal Quiddler word. Apostrophes and accents fail the same test.
    const w = line.trim();
    if (!/^[a-z]{3,10}$/.test(w)) continue; // two-letter words come from TWOS only
    // System word lists are full of lowercase abbreviations (mph, tsp, ftp).
    // Almost all of them are vowel-free, and the handful of real vowel-free
    // English words are listed explicitly.
    if (!/[aeiouy]/.test(w) && !VOWELLESS.has(w)) continue;
    words.add(w);
  }
  break;
}
if (words.size < 1000) {
  console.error('No usable system word list found; leaving dictionary untouched.');
  process.exit(1);
}
const sorted = [...words].sort();
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/quiddler-words.txt', sorted.join('\n') + '\n');
console.log(`wrote ${sorted.length} words`);
