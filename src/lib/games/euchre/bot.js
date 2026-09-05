// Euchre bot: counts likely tricks before it opens its mouth, then plays to the
// partner. Good enough to punish a thin call.
import { effectiveSuit, trumpRank, partnerOf, teamOf, playableCards } from './engine.js';
import { SUITS } from '../cards.js';

const TRUMP_WORTH = { 8: 1.0, 7: 0.85, 6: 0.72, 5: 0.55, 4: 0.4, 3: 0.3, 2: 0.24 };
// What a partner is worth when you are not going alone.
const PARTNER_TRICK = 0.6;

/** Roughly how many tricks this hand takes with the given trump. */
export function strength(cards, trump) {
  let tricks = 0;
  const offSuits = new Set();
  for (const card of cards) {
    const tr = trumpRank(card, trump);
    if (tr > 0) { tricks += TRUMP_WORTH[tr] ?? 0.2; continue; }
    offSuits.add(card.suit);
    if (card.rank === 14) tricks += 0.5;
    else if (card.rank === 13) tricks += 0.2;
  }
  // Short suits let you trump in.
  const voids = SUITS.filter((s) => s !== trump && !offSuits.has(s)).length;
  return tricks + voids * 0.15;
}

function power(card, trump, ledSuit) {
  const tr = trumpRank(card, trump);
  if (tr > 0) return 100 + tr;
  if (ledSuit && effectiveSuit(card, trump) === ledSuit) return card.rank;
  return card.rank - 40; // cannot win: safe to throw
}

function currentBest(v) {
  if (!v.trick.length) return null;
  const led = v.ledSuit;
  let best = null;
  for (const play of v.trick) {
    const score = power(play.card, v.trump, led);
    if (score < 0) continue;
    if (!best || score > best.score) best = { seat: play.seat, score };
  }
  return best;
}

export function chooseMove(v, rng = Math.random) {
  const hand = v.cards;

  if (v.phase === 'bid1') {
    const suit = v.upcard.suit;
    const iAmDealer = v.seat === v.dealer;
    let solo = strength(iAmDealer ? [...hand, v.upcard] : hand, suit);
    if (iAmDealer) solo -= 0.25;                                   // must pitch something
    else if (v.dealer === partnerOf(v.seat)) solo += 0.2;          // the upcard lands well
    else solo -= 0.4;                                              // it arms an opponent
    solo += (rng() - 0.5) * 0.25;
    if (v.allowAlone && solo >= 3.7) return { type: 'orderUp', alone: true };
    // Ordering it up is a bet on three tricks, and the partner is good for one.
    if (solo + PARTNER_TRICK >= 2.7) return { type: 'orderUp', alone: false };
    return { type: 'pass' };
  }

  if (v.phase === 'bid2') {
    let best = null;
    for (const suit of SUITS) {
      if (suit === v.turnedDown) continue;
      const value = strength(hand, suit) + (rng() - 0.5) * 0.2;
      if (!best || value > best.value) best = { suit, value };
    }
    const forced = v.stickTheDealer && v.seat === v.dealer;
    if (v.allowAlone && best.value >= 3.7) return { type: 'call', suit: best.suit, alone: true };
    if (forced || best.value + PARTNER_TRICK >= 2.8) return { type: 'call', suit: best.suit, alone: false };
    return { type: 'pass' };
  }

  if (v.phase === 'dealerDiscard') {
    // Throw the lowest card, preferring to void a side suit.
    const bySuit = {};
    for (const c of hand) (bySuit[c.suit] ??= []).push(c);
    let worst = null;
    for (const card of hand) {
      if (trumpRank(card, v.trump) > 0) continue;
      const alone = bySuit[card.suit].length === 1;
      const score = card.rank - (alone ? 6 : 0) - (card.rank === 14 ? 40 : 0);
      if (!worst || score < worst.score) worst = { card, score };
    }
    return { type: 'discard', cardId: (worst?.card ?? hand[hand.length - 1]).id };
  }

  if (v.phase === 'playing') {
    const legal = hand.filter((c) => v.playable.includes(c.id));
    if (legal.length === 1) return { type: 'play', cardId: legal[0].id };
    const sorted = [...legal].sort((a, b) => power(a, v.trump, v.ledSuit) - power(b, v.trump, v.ledSuit));

    if (!v.trick.length) {
      const trumps = sorted.filter((c) => trumpRank(c, v.trump) > 0);
      const weMadeIt = teamOf(v.seat) === teamOf(v.maker);
      if (weMadeIt && trumps.some((c) => trumpRank(c, v.trump) === 8)) {
        return { type: 'play', cardId: trumps.find((c) => trumpRank(c, v.trump) === 8).id };
      }
      const offAce = sorted.find((c) => c.rank === 14 && trumpRank(c, v.trump) < 0);
      if (offAce) return { type: 'play', cardId: offAce.id };
      if (weMadeIt && trumps.length >= 2) return { type: 'play', cardId: trumps[trumps.length - 1].id };
      return { type: 'play', cardId: sorted[0].id };
    }

    const best = currentBest(v);
    const partnerWinning = best && best.seat === partnerOf(v.seat);
    const last = v.trick.length === (v.alone ? 2 : 3);
    if (partnerWinning && (last || best.score >= 106)) {
      return { type: 'play', cardId: sorted[0].id }; // let it ride
    }
    const winners = sorted.filter((c) => power(c, v.trump, v.ledSuit) > (best?.score ?? -1));
    if (winners.length) return { type: 'play', cardId: winners[0].id };
    return { type: 'play', cardId: sorted[0].id };
  }

  return { type: 'continue' };
}
