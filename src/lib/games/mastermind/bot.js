// Mastermind bot. As codebreaker it keeps every code still consistent with the
// marks so far and plays the one whose worst case leaves the fewest survivors —
// Knuth's idea, restricted to consistent guesses so it stays quick in a browser.
import { palette, consistentCodes } from './engine.js';

const MAX_TRIED = 160;

// Tight scorer for the inner loop: pegs are small integers here, not objects.
function marks(secret, guess, colourCount) {
  let exact = 0;
  const left = new Array(colourCount).fill(0);
  const right = new Array(colourCount).fill(0);
  for (let i = 0; i < secret.length; i++) {
    if (secret[i] === guess[i]) exact += 1;
    else { left[secret[i]] += 1; right[guess[i]] += 1; }
  }
  let colour = 0;
  for (let c = 0; c < colourCount; c++) colour += Math.min(left[c], right[c]);
  return exact * 8 + colour; // packed so it can key a bucket array
}

function opener(pegs, colours, repeats) {
  // Two of one colour and two of another is the classic start; without repeats,
  // just take the first few colours.
  const keys = palette(colours).map((c) => c.key);
  if (!repeats) return keys.slice(0, pegs);
  const out = [];
  for (let i = 0; i < pegs; i++) out.push(keys[Math.floor(i / 2) % keys.length]);
  return out;
}

export function chooseMove(v, rng = Math.random) {
  if (v.phase === 'roundEnd') return { type: 'continue' };

  const keys = v.colours.map((c) => c.key);

  if (v.phase === 'setCode') {
    const code = [];
    while (code.length < v.pegs) {
      const key = keys[Math.floor(rng() * keys.length)];
      if (!v.repeats && code.includes(key)) continue;
      code.push(key);
    }
    return { type: 'setCode', code };
  }

  if (v.phase !== 'guessing') return { type: 'continue' };
  if (!v.guesses.length) return { type: 'guess', code: opener(v.pegs, keys.length, v.repeats) };

  const options = { pegs: v.pegs, colours: keys.length, repeats: v.repeats };
  const candidates = consistentCodes(options, v.guesses);
  if (!candidates.length) {
    // Should never happen against an honest board, but never stall the table.
    return { type: 'guess', code: Array.from({ length: v.pegs }, () => keys[Math.floor(rng() * keys.length)]) };
  }
  if (candidates.length <= 2) return { type: 'guess', code: candidates[0] };

  const index = new Map(keys.map((k, i) => [k, i]));
  const numeric = candidates.map((code) => code.map((k) => index.get(k)));
  const tryCount = Math.min(numeric.length, MAX_TRIED);
  let best = null;
  for (let g = 0; g < tryCount; g++) {
    const guess = numeric[g];
    const buckets = new Map();
    let worst = 0;
    for (const secret of numeric) {
      const key = marks(secret, guess, keys.length);
      const n = (buckets.get(key) ?? 0) + 1;
      buckets.set(key, n);
      if (n > worst) worst = n;
    }
    if (!best || worst < best.worst) best = { worst, code: candidates[g] };
  }
  return { type: 'guess', code: best.code };
}
