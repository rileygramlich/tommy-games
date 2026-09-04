// Wizard — trick-taking with exact-bid scoring.
// Pure state machine: no DOM, no Svelte. Runs identically in the browser (local
// tables) and in the server (online tables, which is the authoritative copy).
import { makeRng, shuffle } from '../rng.js';
import { buildDeck, cardLabel, SUITS } from './deck.js';

export const meta = {
  id: 'wizard',
  name: 'Wizard',
  tagline: 'Bid exactly right. Not one trick more.',
  minPlayers: 3,
  maxPlayers: 6,
  defaultPlayers: 4
};

// With 60 cards the round count is however many full deals fit.
export function roundCount(numPlayers) {
  return Math.floor(60 / numPlayers);
}

export function createGame({ players, options = {}, seed = 1 }) {
  const n = players.length;
  if (n < meta.minPlayers || n > meta.maxPlayers) throw new Error('Wizard seats 3-6 players');
  const state = {
    game: 'wizard',
    seed,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, userId: p.userId ?? null })),
    options: {
      // "Screw the dealer": the dealer may not make the bids total the trick count.
      hookRule: !!options.hookRule,
      rounds: options.rounds ?? roundCount(n)
    },
    round: 0,
    // Randomised so seat 0 is not always the dealer — and so not always last to
    // bid in round one. startRound advances this before the first deal.
    dealer: (seed % n + n - 1) % n,
    phase: 'idle',
    hands: Array.from({ length: n }, () => []),
    deck: [],
    trumpCard: null,
    trumpSuit: null,
    bids: Array(n).fill(null),
    tricksWon: Array(n).fill(0),
    trick: [],
    ledSuit: null,
    wizardLed: false,
    leader: 0,
    turn: 0,
    lastTrick: null,
    scores: Array(n).fill(0),
    scoreboard: [],
    log: [],
    winners: null
  };
  startRound(state);
  return state;
}

function log(state, text) {
  state.log.push({ round: state.round, text });
  if (state.log.length > 400) state.log.shift();
}

function startRound(state) {
  const n = state.players.length;
  state.round += 1;
  state.dealer = (state.dealer + 1) % n;
  const rng = makeRng(state.seed + state.round * 7919);
  const deck = shuffle(buildDeck(), rng);
  state.hands = Array.from({ length: n }, () => deck.splice(0, state.round));
  for (const hand of state.hands) hand.sort(handSort);
  state.deck = deck;
  state.trumpCard = deck.length ? deck.shift() : null;
  state.bids = Array(n).fill(null);
  state.tricksWon = Array(n).fill(0);
  state.trick = [];
  state.ledSuit = null;
  state.wizardLed = false;
  state.lastTrick = null;
  state.leader = (state.dealer + 1) % n;
  state.turn = state.leader;

  if (!state.trumpCard) {
    state.trumpSuit = null;
    state.phase = 'bidding';
    log(state, `Round ${state.round}: no trump (deck exhausted).`);
  } else if (state.trumpCard.kind === 'wizard') {
    state.trumpSuit = null;
    state.phase = 'chooseTrump';
    state.turn = state.dealer;
    log(state, `Round ${state.round}: a Wizard turned up — ${state.players[state.dealer].name} picks trump.`);
  } else if (state.trumpCard.kind === 'jester') {
    state.trumpSuit = null;
    state.phase = 'bidding';
    log(state, `Round ${state.round}: a Jester turned up — no trump.`);
  } else {
    state.trumpSuit = state.trumpCard.suit;
    state.phase = 'bidding';
    log(state, `Round ${state.round}: trump is ${cardLabel(state.trumpCard)}.`);
  }
}

function handSort(a, b) {
  const order = { wizard: 0, jester: 5 };
  const ka = order[a.kind] ?? 1 + SUITS.indexOf(a.suit);
  const kb = order[b.kind] ?? 1 + SUITS.indexOf(b.suit);
  return ka - kb || b.rank - a.rank;
}

// ---------------------------------------------------------------- legal moves

export function legalMoves(state, seat) {
  if (state.phase === 'chooseTrump' && seat === state.turn) {
    return SUITS.map((suit) => ({ type: 'chooseTrump', suit }));
  }
  if (state.phase === 'bidding' && seat === state.turn) {
    const moves = [];
    for (let bid = 0; bid <= state.round; bid++) {
      if (!forbiddenBid(state, seat, bid)) moves.push({ type: 'bid', bid });
    }
    return moves;
  }
  if (state.phase === 'playing' && seat === state.turn) {
    return playableCards(state, seat).map((card) => ({ type: 'play', cardId: card.id }));
  }
  if (state.phase === 'trickEnd' || state.phase === 'roundEnd') return [{ type: 'continue' }];
  return [];
}

function forbiddenBid(state, seat, bid) {
  if (!state.options.hookRule) return false;
  if (seat !== state.dealer) return false;
  const placed = state.bids.reduce((sum, b) => sum + (b ?? 0), 0);
  return placed + bid === state.round;
}

export function playableCards(state, seat) {
  const hand = state.hands[seat];
  if (!state.ledSuit || state.wizardLed) return hand.slice();
  const canFollow = hand.some((c) => c.kind === 'suit' && c.suit === state.ledSuit);
  if (!canFollow) return hand.slice();
  // Wizards and Jesters are always legal, suit cards must follow.
  return hand.filter((c) => c.kind !== 'suit' || c.suit === state.ledSuit);
}

// ---------------------------------------------------------------- apply move

export function applyMove(state, seat, move) {
  const fail = (error) => ({ ok: false, error });
  if (state.phase === 'gameOver') return fail('The game is over.');

  if (move.type === 'chooseTrump') {
    if (state.phase !== 'chooseTrump' || seat !== state.turn) return fail('Not your call.');
    if (!SUITS.includes(move.suit)) return fail('Unknown suit.');
    state.trumpSuit = move.suit;
    state.phase = 'bidding';
    state.turn = (state.dealer + 1) % state.players.length;
    log(state, `${state.players[seat].name} calls ${move.suit} trump.`);
    return { ok: true };
  }

  if (move.type === 'bid') {
    if (state.phase !== 'bidding' || seat !== state.turn) return fail('Not your bid.');
    const bid = Number(move.bid);
    if (!Number.isInteger(bid) || bid < 0 || bid > state.round) return fail('Bid out of range.');
    if (forbiddenBid(state, seat, bid)) return fail('The dealer may not make the bids add up.');
    state.bids[seat] = bid;
    log(state, `${state.players[seat].name} bids ${bid}.`);
    const n = state.players.length;
    if (state.bids.every((b) => b !== null)) {
      state.phase = 'playing';
      state.turn = state.leader;
    } else {
      state.turn = (seat + 1) % n;
    }
    return { ok: true };
  }

  if (move.type === 'play') {
    if (state.phase !== 'playing' || seat !== state.turn) return fail('Not your turn.');
    const hand = state.hands[seat];
    const idx = hand.findIndex((c) => c.id === move.cardId);
    if (idx === -1) return fail('You do not hold that card.');
    const card = hand[idx];
    if (!playableCards(state, seat).some((c) => c.id === card.id)) {
      return fail(`You must follow ${state.ledSuit}.`);
    }
    hand.splice(idx, 1);
    state.trick.push({ seat, card });
    if (card.kind === 'wizard' && state.trick.length === 1) state.wizardLed = true;
    if (!state.wizardLed && !state.ledSuit && card.kind === 'suit') state.ledSuit = card.suit;
    log(state, `${state.players[seat].name} plays ${cardLabel(card)}.`);

    if (state.trick.length === state.players.length) {
      const winner = trickWinner(state.trick, state.trumpSuit);
      state.tricksWon[winner] += 1;
      state.lastTrick = { plays: state.trick.map((p) => ({ ...p })), winner };
      state.phase = 'trickEnd';
      log(state, `${state.players[winner].name} takes the trick.`);
    } else {
      state.turn = (seat + 1) % state.players.length;
    }
    return { ok: true };
  }

  if (move.type === 'continue') {
    if (state.phase === 'trickEnd') {
      const winner = state.lastTrick.winner;
      state.trick = [];
      state.ledSuit = null;
      state.wizardLed = false;
      state.leader = winner;
      state.turn = winner;
      if (state.hands.every((h) => h.length === 0)) scoreRound(state);
      else state.phase = 'playing';
      return { ok: true };
    }
    if (state.phase === 'roundEnd') {
      if (state.round >= state.options.rounds) {
        state.phase = 'gameOver';
        const best = Math.max(...state.scores);
        state.winners = state.scores.map((s, i) => (s === best ? i : -1)).filter((i) => i >= 0);
        log(state, `Game over — ${state.winners.map((i) => state.players[i].name).join(' & ')} wins.`);
      } else {
        startRound(state);
      }
      return { ok: true };
    }
    return fail('Nothing to continue.');
  }

  return fail('Unknown move.');
}

export function trickWinner(trick, trumpSuit) {
  const firstWizard = trick.find((p) => p.card.kind === 'wizard');
  if (firstWizard) return firstWizard.seat;
  let ledSuit = null;
  for (const p of trick) {
    if (p.card.kind === 'suit') { ledSuit = p.card.suit; break; }
  }
  if (!ledSuit) return trick[0].seat; // all Jesters: the lead wins
  let best = null;
  for (const p of trick) {
    if (p.card.kind !== 'suit') continue;
    const isTrump = trumpSuit && p.card.suit === trumpSuit;
    const follows = p.card.suit === ledSuit;
    if (!isTrump && !follows) continue;
    const score = (isTrump ? 100 : 0) + p.card.rank;
    if (!best || score > best.score) best = { seat: p.seat, score };
  }
  return best ? best.seat : trick[0].seat;
}

function scoreRound(state) {
  const deltas = state.players.map((_, i) => {
    const bid = state.bids[i];
    const won = state.tricksWon[i];
    return bid === won ? 20 + 10 * won : -10 * Math.abs(won - bid);
  });
  deltas.forEach((d, i) => { state.scores[i] += d; });
  state.scoreboard.push({
    round: state.round,
    bids: state.bids.slice(),
    tricks: state.tricksWon.slice(),
    deltas,
    totals: state.scores.slice()
  });
  state.phase = 'roundEnd';
  log(state, `Round ${state.round} scored: ${deltas.map((d, i) => `${state.players[i].name} ${d >= 0 ? '+' : ''}${d}`).join(', ')}.`);
}

// ---------------------------------------------------------------- seat view

// What one seat is allowed to know. Other hands become counts.
export function view(state, seat) {
  return {
    game: 'wizard',
    seat,
    phase: state.phase,
    round: state.round,
    rounds: state.options.rounds,
    hookRule: state.options.hookRule,
    dealer: state.dealer,
    turn: state.turn,
    leader: state.leader,
    players: state.players.map((p, i) => ({
      seat: i,
      name: p.name,
      isBot: p.isBot,
      cards: state.hands[i].length,
      bid: state.bids[i],
      tricks: state.tricksWon[i],
      score: state.scores[i]
    })),
    hand: seat == null ? [] : state.hands[seat].slice(),
    playable: seat != null && state.phase === 'playing' && state.turn === seat
      ? playableCards(state, seat).map((c) => c.id)
      : [],
    legalBids: seat != null && state.phase === 'bidding' && state.turn === seat
      ? legalMoves(state, seat).map((m) => m.bid)
      : [],
    trick: state.trick.map((p) => ({ seat: p.seat, card: p.card })),
    ledSuit: state.ledSuit,
    trumpCard: state.trumpCard,
    trumpSuit: state.trumpSuit,
    lastTrick: state.lastTrick,
    scoreboard: state.scoreboard,
    log: state.log.slice(-40),
    winners: state.winners
  };
}

export function isOver(state) {
  return state.phase === 'gameOver';
}

// Seats whose move the table is waiting on (used to drive bots / prompts).
export function activeSeats(state) {
  if (state.phase === 'trickEnd' || state.phase === 'roundEnd') return [state.turn];
  if (['bidding', 'playing', 'chooseTrump'].includes(state.phase)) return [state.turn];
  return [];
}
