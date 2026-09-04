// A sorted word list with binary-search lookups. Cheaper in memory than a trie
// and fast enough for the solver, which leans on hasPrefix to prune hard.
export function createDictionary(text) {
  const words = text.split('\n').map((w) => w.trim()).filter(Boolean);
  words.sort();

  function lowerBound(target) {
    let lo = 0, hi = words.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (words[mid] < target) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  return {
    size: words.length,
    has(word) {
      const i = lowerBound(word);
      return i < words.length && words[i] === word;
    },
    hasPrefix(prefix) {
      const i = lowerBound(prefix);
      return i < words.length && words[i].startsWith(prefix);
    },
    words
  };
}

let cached = null;
export async function loadDictionary(url) {
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load the word list (${res.status})`);
  cached = createDictionary(await res.text());
  return cached;
}
