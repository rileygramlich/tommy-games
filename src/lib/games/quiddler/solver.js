// Finds the highest-scoring way to split a hand into words.
//
// Two passes:
//   1. DFS over the dictionary prefix-tree to collect every word the hand can
//      spell, keyed by the bitmask of cards it consumes.
//   2. Exact-cover DP over those masks (n <= 12, so 3^n submask work is cheap).
//
// A Quiddler score is (value of cards used in words) - (value of cards left
// over), which equals 2 * usedValue - handTotal, so maximising used value
// maximises the score.

const MIN_WORD_LETTERS = 2;

export function findWords(cards, dict) {
  const n = cards.length;
  const best = new Map(); // mask -> { word, value, cardIds }
  const stack = [];

  function walk(mask, prefix, value) {
    if (prefix.length >= MIN_WORD_LETTERS && dict.has(prefix)) {
      const prev = best.get(mask);
      if (!prev || value > prev.value) {
        best.set(mask, { word: prefix, value, cardIds: stack.slice() });
      }
    }
    if (prefix.length >= 10) return; // no dictionary word is longer
    for (let i = 0; i < n; i++) {
      const bit = 1 << i;
      if (mask & bit) continue;
      const next = prefix + cards[i].letters;
      if (next.length > 10 || !dict.hasPrefix(next)) continue;
      stack.push(cards[i].id);
      walk(mask | bit, next, value + cards[i].value);
      stack.pop();
    }
  }
  walk(0, '', 0);
  return best;
}

// Returns the best arrangement: which words to lay down and what is left over.
export function bestLayout(cards, dict) {
  const n = cards.length;
  const total = cards.reduce((sum, c) => sum + c.value, 0);
  const wordsByMask = findWords(cards, dict);

  // dp[mask] = best way to cover exactly `mask` with whole words.
  const dp = new Array(1 << n).fill(null);
  dp[0] = { value: 0, count: 0, longest: 0, parts: [] };
  for (let mask = 1; mask < (1 << n); mask++) {
    const low = mask & -mask; // pin the lowest card so each split is visited once
    let bestEntry = null;
    for (let sub = mask; sub; sub = (sub - 1) & mask) {
      if (!(sub & low)) continue;
      const w = wordsByMask.get(sub);
      if (!w) continue;
      const rest = dp[mask ^ sub];
      if (!rest) continue;
      const cand = {
        value: rest.value + w.value,
        count: rest.count + 1,
        longest: Math.max(rest.longest, w.word.length),
        parts: [...rest.parts, w]
      };
      if (!bestEntry || better(cand, bestEntry)) bestEntry = cand;
    }
    dp[mask] = bestEntry;
  }

  const full = (1 << n) - 1;
  let bestMask = 0, bestScore = -Infinity, bestEntry = dp[0];
  for (let mask = 0; mask <= full; mask++) {
    const entry = dp[mask];
    if (!entry) continue;
    const leftover = total - entry.value;
    const score = entry.value - leftover;
    if (score > bestScore || (score === bestScore && better(entry, bestEntry))) {
      bestScore = score; bestMask = mask; bestEntry = entry;
    }
  }

  const usedIds = new Set(bestEntry.parts.flatMap((p) => p.cardIds));
  return {
    words: bestEntry.parts.map((p) => ({ word: p.word, value: p.value, cardIds: p.cardIds })),
    leftover: cards.filter((c) => !usedIds.has(c.id)).map((c) => c.id),
    score: bestScore,
    usedValue: bestEntry.value,
    canGoOut: dp[full] != null,
    // Best arrangement that uses every card, when one exists.
    goOutWords: dp[full]
      ? dp[full].parts.map((p) => ({ word: p.word, value: p.value, cardIds: p.cardIds }))
      : null
  };
}

// Tie-breaks favour longer words then more words — those carry the round bonuses.
function better(a, b) {
  if (a.value !== b.value) return a.value > b.value;
  if (a.longest !== b.longest) return a.longest > b.longest;
  return a.count > b.count;
}
