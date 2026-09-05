// Yahtzee bot. Holds are chosen by rolling the remaining dice a few hundred
// times in its head and keeping whichever set pays best on average.
import { CATEGORIES, UPPER, scoreFor, isJoker as jokerCheck } from './engine.js';

// What it costs to write a zero into a box you can never fill again.
const WASTE = {
  yahtzee: 34, largeStraight: 22, fourKind: 14, fullHouse: 13, smallStraight: 11,
  chance: 26, sixes: 9, fives: 8, fours: 7, threes: 5, twos: 4, ones: 2, threeKind: 12
};

function openCategories(card) {
  return CATEGORIES.filter((c) => card[c] === null);
}

// Value of a finished set of dice, if we had to write it down right now.
function bestFinish(dice, card, joker) {
  let best = -Infinity;
  for (const c of openCategories(card)) {
    const value = scoreFor(c, dice, joker && !UPPER.includes(c));
    let worth = value;
    if (UPPER.includes(c)) {
      const face = UPPER.indexOf(c) + 1;
      if (value >= face * 3) worth += 6;      // keeps the 63-point bonus alive
      else if (value === 0) worth -= WASTE[c];
    } else if (value === 0) {
      worth -= WASTE[c];
    }
    if (worth > best) best = worth;
  }
  return best === -Infinity ? 0 : best;
}

function rollInto(dice, mask, rolls, rng) {
  const out = dice.slice();
  for (let r = 0; r < rolls; r++) {
    for (let i = 0; i < 5; i++) if (!(mask & (1 << i))) out[i] = 1 + Math.floor(rng() * 6);
  }
  return out;
}

function bestMask(dice, card, rollsLeft, rng, samples = 90) {
  let best = { mask: 31, score: -Infinity };
  for (let mask = 0; mask < 32; mask++) {
    let total = 0;
    for (let s = 0; s < samples; s++) {
      total += bestFinish(rollInto(dice, mask, rollsLeft, rng), card, false);
    }
    const score = total / samples;
    if (score > best.score) best = { mask, score };
  }
  return best.mask;
}

export function chooseMove(v, rng = Math.random) {
  const card = v.players[v.seat].card;

  if (v.rollsLeft === 3) return { type: 'roll' };

  if (v.rollsLeft === 0) return { type: 'score', category: pickCategory(v, card) };

  const mask = bestMask(v.dice, card, v.rollsLeft, rng);
  // Holding everything means another roll cannot help — write it down instead.
  if (mask === 31) return { type: 'score', category: pickCategory(v, card) };
  for (let i = 0; i < 5; i++) {
    const want = !!(mask & (1 << i));
    if (v.held[i] !== want) return { type: 'hold', index: i };
  }
  return { type: 'roll' };
}

function pickCategory(v, card) {
  const joker = v.joker;
  let best = null;
  for (const c of CATEGORIES) {
    if (card[c] !== null) continue;
    const value = scoreFor(c, v.dice, joker && !UPPER.includes(c));
    let worth = value;
    if (UPPER.includes(c)) {
      const face = UPPER.indexOf(c) + 1;
      if (value >= face * 3) worth += 6;
      else if (value === 0) worth -= WASTE[c];
      else worth -= (face * 3 - value) * 0.7; // a thin upper box hurts the bonus
    } else if (value === 0) {
      worth -= WASTE[c];
    }
    if (!best || worth > best.worth) best = { c, worth };
  }
  return best.c;
}
