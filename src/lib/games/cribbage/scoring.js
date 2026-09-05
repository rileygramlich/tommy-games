// Cribbage scoring, kept separate because it is the entire game.
import { RANK_LABELS, SUIT_SYMBOLS } from '../cards.js';

/** Counting value: aces are one, court cards are ten. */
export const valueOf = (card) => Math.min(card.rank === 14 ? 1 : card.rank, 10);
export const label = (card) => `${RANK_LABELS[card.rank]}${SUIT_SYMBOLS[card.suit]}`;

function fifteens(cards) {
  let found = 0;
  const n = cards.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) sum += valueOf(cards[i]);
    if (sum === 15) found += 1;
  }
  return found;
}

function pairs(cards) {
  let count = 0;
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) if (cards[i].rank === cards[j].rank) count += 1;
  }
  return count;
}

// Runs count once per distinct combination, so 5-6-6-7 is two runs of three.
function runs(cards) {
  const byRank = new Map();
  for (const card of cards) byRank.set(card.rank, (byRank.get(card.rank) ?? 0) + 1);
  const ranks = [...byRank.keys()].sort((a, b) => a - b);
  let best = { length: 0, ways: 0 };
  let i = 0;
  while (i < ranks.length) {
    let j = i;
    let ways = byRank.get(ranks[i]);
    while (j + 1 < ranks.length && ranks[j + 1] === ranks[j] + 1) {
      j += 1;
      ways *= byRank.get(ranks[j]);
    }
    const length = j - i + 1;
    if (length >= 3 && length > best.length) best = { length, ways };
    i = j + 1;
  }
  return best.length >= 3 ? { points: best.length * best.ways, length: best.length, ways: best.ways } : null;
}

/**
 * Score a hand (or the crib) against the starter card.
 * A crib only takes a flush if all five cards match.
 */
export function scoreShow(hand, starter, isCrib = false) {
  const all = starter ? [...hand, starter] : [...hand];
  const parts = [];
  let total = 0;

  const f = fifteens(all);
  if (f) { parts.push({ label: `Fifteen ×${f}`, points: f * 2 }); total += f * 2; }

  const p = pairs(all);
  if (p) { parts.push({ label: p === 1 ? 'Pair' : `${p} pairs`, points: p * 2 }); total += p * 2; }

  const r = runs(all);
  if (r) {
    parts.push({ label: r.ways > 1 ? `${r.ways} runs of ${r.length}` : `Run of ${r.length}`, points: r.points });
    total += r.points;
  }

  const suit = hand[0]?.suit;
  const handFlush = hand.length >= 4 && hand.every((c) => c.suit === suit);
  if (handFlush) {
    const withStarter = starter && starter.suit === suit;
    if (isCrib) {
      if (withStarter) { parts.push({ label: 'Flush (five)', points: 5 }); total += 5; }
    } else {
      const points = withStarter ? 5 : 4;
      parts.push({ label: withStarter ? 'Flush (five)' : 'Flush', points });
      total += points;
    }
  }

  if (starter && hand.some((c) => c.rank === 11 && c.suit === starter.suit)) {
    parts.push({ label: 'His nobs', points: 1 });
    total += 1;
  }

  return { total, parts };
}

/**
 * Points for the card just played onto the pegging pile.
 * `pile` is the current run of cards since the count last reset.
 */
export function scorePegging(pile, count) {
  const parts = [];
  let total = 0;

  if (count === 15) { parts.push({ label: 'Fifteen', points: 2 }); total += 2; }
  if (count === 31) { parts.push({ label: 'Thirty-one', points: 2 }); total += 2; }

  let same = 1;
  for (let i = pile.length - 2; i >= 0; i--) {
    if (pile[i].rank === pile[pile.length - 1].rank) same += 1; else break;
  }
  const pairPoints = { 2: 2, 3: 6, 4: 12 }[same];
  if (pairPoints) {
    parts.push({ label: { 2: 'Pair', 3: 'Three of a kind', 4: 'Four of a kind' }[same], points: pairPoints });
    total += pairPoints;
  }

  for (let len = pile.length; len >= 3; len--) {
    const tail = pile.slice(pile.length - len);
    const ranks = [...new Set(tail.map((c) => c.rank))];
    if (ranks.length !== len) continue;
    ranks.sort((a, b) => a - b);
    if (ranks[len - 1] - ranks[0] === len - 1) {
      parts.push({ label: `Run of ${len}`, points: len });
      total += len;
      break;
    }
  }

  return { total, parts };
}
