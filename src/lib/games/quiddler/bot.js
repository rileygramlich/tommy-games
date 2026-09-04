// Quiddler bot: brute-forces its own hand with the solver each turn.
// Strong at spotting words, deliberately human about when it goes out.
import { bestLayout } from './solver.js';

function evaluate(cards, dict) {
  // Best value this hand could lay down, and whether it covers every card.
  const r = bestLayout(cards, dict);
  return { usedValue: r.usedValue, canGoOut: r.canGoOut, result: r };
}

export function chooseMove(v, rng = Math.random, dict = null) {
  if (!dict) throw new Error('The Quiddler bot needs a dictionary');

  if (v.phase === 'draw') {
    if (!v.discardTop) return { type: 'draw', from: 'deck' };
    // Take the visible card only if it clearly improves the hand. We compare
    // like for like: both branches end with one card discarded.
    const withCard = [...v.hand, v.discardTop];
    const base = bestDiscardValue(v.hand, dict, v.hand.length - 1);
    const taken = bestDiscardValue(withCard, dict, v.hand.length);
    if (taken.canGoOut && !base.canGoOut) return { type: 'draw', from: 'discard' };
    if (taken.usedValue >= base.usedValue + 3) return { type: 'draw', from: 'discard' };
    return { type: 'draw', from: 'deck' };
  }

  if (v.phase === 'discard') {
    const best = bestDiscardValue(v.hand, dict, v.hand.length - 1);
    const move = { type: 'discard', cardId: best.discardId };
    if (v.mustLayDown) {
      // Someone went out: lay down whatever scores best, leftovers and all.
      move.layout = { words: best.result.words.map((w) => w.cardIds) };
    } else if (best.canGoOut) {
      // Hold off on a scrappy early go-out; late rounds it is always worth it.
      const worthIt = v.round >= 4 || best.usedValue >= 14 || rng() < 0.6;
      if (worthIt) move.layout = { words: best.result.goOutWords.map((w) => w.cardIds) };
    }
    return move;
  }

  return { type: 'continue' };
}

/** The same plan the bot would make: which card to pitch and how to lay out the rest. */
export function planTurn(cards, dict) {
  return bestDiscardValue(cards, dict, cards.length - 1);
}

// Try every discard and keep the one leaving the best hand behind.
function bestDiscardValue(cards, dict, keepCount) {
  let best = null;
  for (const card of cards) {
    const rest = cards.filter((c) => c.id !== card.id);
    if (rest.length !== keepCount) continue;
    const { usedValue, canGoOut, result } = evaluate(rest, dict);
    const rank = (canGoOut ? 1000 : 0) + usedValue - card.value * 0.15;
    if (!best || rank > best.rank) best = { rank, usedValue, canGoOut, result, discardId: card.id };
  }
  return best ?? { rank: 0, usedValue: 0, canGoOut: false, result: bestLayout(cards, dict), discardId: cards[0]?.id };
}
