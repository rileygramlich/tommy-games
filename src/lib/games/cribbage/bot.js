// Cribbage bot. Lays away by averaging the hand over every card that could be
// cut, and pegs with the usual table sense: lead low, do not leave five.
import { buildDeck } from '../cards.js';
import { scoreShow, scorePegging, valueOf } from './scoring.js';

const FULL_DECK = buildDeck();

function combinations(list, k) {
  const out = [];
  const walk = (start, picked) => {
    if (picked.length === k) { out.push(picked.slice()); return; }
    for (let i = start; i < list.length; i++) {
      picked.push(list[i]);
      walk(i + 1, picked);
      picked.pop();
    }
  };
  walk(0, []);
  return out;
}

// Rough worth of two cards thrown into a crib, before anything else lands there.
function cribValue(pair) {
  const [a, b] = pair;
  let value = 3.5;
  if (a.rank === b.rank) value += 2.5;
  if (valueOf(a) + valueOf(b) === 15) value += 2.5;
  if (a.rank === 5 || b.rank === 5) value += 2;
  if (Math.abs(a.rank - b.rank) === 1) value += 1.5;
  if (Math.abs(a.rank - b.rank) === 2) value += 0.8;
  if (a.rank === 11 || b.rank === 11) value += 0.4;
  return value;
}

export function chooseMove(v, rng = Math.random) {
  if (v.phase === 'discard') {
    const hand = v.hand;
    const held = new Set(hand.map((c) => c.id));
    const starters = FULL_DECK.filter((c) => !held.has(c.id));
    const myCrib = v.dealer === v.seat;
    let best = null;
    for (const keep of combinations(hand, 4)) {
      const kept = new Set(keep.map((c) => c.id));
      const toss = hand.filter((c) => !kept.has(c.id));
      let total = 0;
      for (const starter of starters) total += scoreShow(keep, starter, false).total;
      const average = total / starters.length;
      const crib = cribValue(toss) * (myCrib ? 1 : -1);
      const score = average + crib * 0.9 + (rng() - 0.5) * 0.2;
      if (!best || score > best.score) best = { score, toss };
    }
    return { type: 'discard', cardIds: best.toss.map((c) => c.id) };
  }

  if (v.phase === 'pegging') {
    if (v.mustGo) return { type: 'go' };
    const playable = v.hand.filter((c) => v.playable.includes(c.id));
    let best = null;
    for (const card of playable) {
      const count = v.count + valueOf(card);
      const pegs = scorePegging([...v.pile, card], count).total;
      let score = pegs * 10;
      // Leaving five or twenty-one hands over a fifteen or a thirty-one.
      if (count === 5 || count === 21) score -= 6;
      if (count === 31) score += 3;
      if (!v.pile.length && card.rank === 5) score -= 5;   // never lead a five
      if (!v.pile.length && valueOf(card) <= 4) score += 2; // lead low
      if (count <= 15) score += 1;
      score -= valueOf(card) * 0.05;                        // keep small cards back
      if (!best || score > best.score) best = { score, card };
    }
    return { type: 'play', cardId: best.card.id };
  }

  return { type: 'continue' };
}
