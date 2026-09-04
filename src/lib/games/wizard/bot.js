// Heuristic Wizard bot. Reads only a seat view, so the same code drives bots in
// the browser and on the server.
const HIGH = { 14: 0.72, 13: 0.5, 12: 0.32, 11: 0.19 };

function trickChance(card, trumpSuit, players) {
  if (card.kind === 'wizard') return 0.93;
  if (card.kind === 'jester') return 0.02;
  const crowd = 1 - (players - 3) * 0.08; // more opponents, fewer easy tricks
  if (trumpSuit && card.suit === trumpSuit) {
    return Math.min(0.95, (0.34 + 0.046 * (card.rank - 2)) * crowd + 0.1);
  }
  return (HIGH[card.rank] ?? 0.06) * crowd;
}

export function suggestBid(v, rng = Math.random) {
  const players = v.players.length;
  let expected = v.hand.reduce((sum, c) => sum + trickChance(c, v.trumpSuit, players), 0);
  expected += (rng() - 0.5) * 0.35;
  let bid = Math.max(0, Math.min(v.round, Math.round(expected)));
  const legal = v.legalBids?.length ? v.legalBids : [bid];
  if (!legal.includes(bid)) {
    // Hook rule bit us — slide to the nearest legal bid.
    bid = legal.reduce((best, b) => (Math.abs(b - bid) < Math.abs(best - bid) ? b : best), legal[0]);
  }
  return bid;
}

function strength(card, trumpSuit, ledSuit) {
  if (card.kind === 'wizard') return 1000;
  if (card.kind === 'jester') return -1;
  if (trumpSuit && card.suit === trumpSuit) return 100 + card.rank;
  if (ledSuit && card.suit === ledSuit) return card.rank;
  return card.rank - 30; // off-suit: cannot win, safe to shed
}

// Would this card be winning the trick as it stands right now?
function beatsCurrent(card, v) {
  if (!v.trick.length) return true;
  const trump = v.trumpSuit;
  const led = v.ledSuit;
  if (v.trick.some((p) => p.card.kind === 'wizard')) return false;
  if (card.kind === 'wizard') return true;
  if (card.kind === 'jester') return false;
  const best = Math.max(...v.trick.map((p) => strength(p.card, trump, led)));
  return strength(card, trump, led) > best;
}

export function chooseCard(v, rng = Math.random) {
  const hand = v.hand.filter((c) => v.playable.includes(c.id));
  if (hand.length <= 1) return hand[0];
  const need = (v.players[v.seat].bid ?? 0) - v.players[v.seat].tricks;
  const cardsLeft = hand.length;
  const wantTrick = need > 0;
  const desperate = need >= cardsLeft; // must win everything left
  const sorted = [...hand].sort((a, b) => strength(a, v.trumpSuit, v.ledSuit) - strength(b, v.trumpSuit, v.ledSuit));
  const isLast = v.trick.length === v.players.length - 1;

  if (!v.trick.length) {
    // Leading.
    if (desperate) return sorted[sorted.length - 1];
    if (wantTrick) {
      const wizard = sorted.find((c) => c.kind === 'wizard');
      if (wizard && (need >= 2 || rng() < 0.5)) return wizard;
      return sorted[sorted.length - 1];
    }
    const jester = sorted.find((c) => c.kind === 'jester');
    return jester ?? sorted[0];
  }

  const winners = sorted.filter((c) => beatsCurrent(c, v));
  if (wantTrick) {
    if (!winners.length) return sorted[0]; // cannot take it — shed the cheapest
    // Cheapest card that takes it, unless we're last to act and want certainty.
    const nonWizard = winners.filter((c) => c.kind !== 'wizard');
    if (isLast && nonWizard.length) return nonWizard[0];
    if (!isLast && need >= 2 && winners.some((c) => c.kind === 'wizard')) {
      return winners.find((c) => c.kind === 'wizard');
    }
    return winners[0];
  }

  // Ducking: play the biggest card that cannot win, so the danger leaves the hand.
  const jester = sorted.find((c) => c.kind === 'jester');
  if (jester) return jester;
  const losers = sorted.filter((c) => !beatsCurrent(c, v));
  if (losers.length) return losers[losers.length - 1];
  return sorted[0]; // forced to win — do it as cheaply as possible
}

export function chooseMove(v, rng = Math.random) {
  if (v.phase === 'chooseTrump') {
    // Call the suit we are longest and strongest in.
    const score = {};
    for (const c of v.hand) {
      if (c.kind !== 'suit') continue;
      score[c.suit] = (score[c.suit] ?? 0) + 2 + c.rank / 7;
    }
    const suits = ['C', 'D', 'H', 'S'];
    const best = suits.reduce((a, b) => ((score[b] ?? 0) > (score[a] ?? 0) ? b : a), suits[0]);
    return { type: 'chooseTrump', suit: best };
  }
  if (v.phase === 'bidding') return { type: 'bid', bid: suggestBid(v, rng) };
  if (v.phase === 'playing') {
    const card = chooseCard(v, rng);
    return { type: 'play', cardId: card.id };
  }
  return { type: 'continue' };
}
