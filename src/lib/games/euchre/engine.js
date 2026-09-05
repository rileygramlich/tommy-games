// Euchre — 24 cards, four players, two teams, and a jack that changes sides.
import { makeRng, shuffle } from '../rng.js';
import { buildDeck, cardLabel, sameColour, SUITS, SUIT_NAMES } from '../cards.js';

export const meta = {
  id: 'euchre',
  name: 'Euchre',
  tagline: 'Name the trump, take three tricks. The bowers do the rest.',
  minPlayers: 4,
  maxPlayers: 4,
  defaultPlayers: 4
};

export const RANKS = [9, 10, 11, 12, 13, 14];
export const teamOf = (seat) => seat % 2;
export const partnerOf = (seat) => (seat + 2) % 4;

/** The left bower counts as trump, which is the whole trick of this game. */
export function effectiveSuit(card, trump) {
  if (!trump) return card.suit;
  if (card.rank === 11 && card.suit !== trump && sameColour(card.suit, trump)) return trump;
  return card.suit;
}

export function trumpRank(card, trump) {
  if (effectiveSuit(card, trump) !== trump) return -1;
  if (card.rank === 11 && card.suit === trump) return 8;   // right bower
  if (card.rank === 11) return 7;                          // left bower
  return { 14: 6, 13: 5, 12: 4, 10: 3, 9: 2 }[card.rank];
}

export function createGame({ players, options = {}, seed = 1 }) {
  if (players.length !== 4) throw new Error('Euchre seats exactly four players');
  const state = {
    game: 'euchre',
    seed,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, userId: p.userId ?? null })),
    options: {
      target: options.target ?? 10,
      stickTheDealer: !!options.stickTheDealer,
      allowAlone: options.allowAlone !== false
    },
    hand: 0,
    dealer: (seed % 4 + 3) % 4,
    phase: 'idle',
    hands: [[], [], [], []],
    kitty: [],
    upcard: null,
    turnedDown: null,
    trump: null,
    maker: null,
    alone: false,
    sitter: null,
    turn: 0,
    leader: 0,
    trick: [],
    ledSuit: null,
    lastTrick: null,
    tricksWon: [0, 0, 0, 0],
    scores: [0, 0],
    handSummary: null,
    log: [],
    winners: null
  };
  deal(state);
  return state;
}

function log(state, text) {
  state.log.push({ text });
  if (state.log.length > 200) state.log.shift();
}

function deal(state) {
  state.hand += 1;
  state.dealer = (state.dealer + 1) % 4;
  const rng = makeRng(state.seed + state.hand * 3571);
  const deck = shuffle(buildDeck({ ranks: RANKS }), rng);
  state.hands = [0, 1, 2, 3].map(() => deck.splice(0, 5));
  for (const hand of state.hands) hand.sort(handSort);
  state.upcard = deck.shift();
  state.kitty = deck;
  state.turnedDown = null;
  state.trump = null;
  state.maker = null;
  state.alone = false;
  state.sitter = null;
  state.trick = [];
  state.ledSuit = null;
  state.lastTrick = null;
  state.tricksWon = [0, 0, 0, 0];
  state.handSummary = null;
  state.turn = (state.dealer + 1) % 4;
  state.phase = 'bid1';
  log(state, `Hand ${state.hand}: ${state.players[state.dealer].name} deals, ${cardLabel(state.upcard)} is up.`);
}

function handSort(a, b) {
  return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || b.rank - a.rank;
}

function nextSeat(state, seat) {
  let next = (seat + 1) % 4;
  if (state.sitter !== null && next === state.sitter) next = (next + 1) % 4;
  return next;
}

export function legalMoves(state, seat) {
  if (state.turn !== seat) {
    return state.phase === 'trickEnd' || state.phase === 'handEnd' ? [{ type: 'continue' }] : [];
  }
  switch (state.phase) {
    case 'bid1': {
      const moves = [{ type: 'pass' }, { type: 'orderUp', alone: false }];
      if (state.options.allowAlone) moves.push({ type: 'orderUp', alone: true });
      return moves;
    }
    case 'bid2': {
      const moves = [];
      const forced = state.options.stickTheDealer && seat === state.dealer;
      if (!forced) moves.push({ type: 'pass' });
      for (const suit of SUITS) {
        if (suit === state.turnedDown) continue;
        moves.push({ type: 'call', suit, alone: false });
        if (state.options.allowAlone) moves.push({ type: 'call', suit, alone: true });
      }
      return moves;
    }
    case 'dealerDiscard':
      return state.hands[seat].map((c) => ({ type: 'discard', cardId: c.id }));
    case 'playing':
      return playableCards(state, seat).map((c) => ({ type: 'play', cardId: c.id }));
    case 'trickEnd':
    case 'handEnd':
      return [{ type: 'continue' }];
    default:
      return [];
  }
}

export function playableCards(state, seat) {
  const hand = state.hands[seat];
  if (!state.ledSuit) return hand.slice();
  const canFollow = hand.some((c) => effectiveSuit(c, state.trump) === state.ledSuit);
  return canFollow ? hand.filter((c) => effectiveSuit(c, state.trump) === state.ledSuit) : hand.slice();
}

export function applyMove(state, seat, move) {
  const fail = (error) => ({ ok: false, error });
  if (state.phase === 'gameOver') return fail('The game is over.');

  if (move.type === 'continue') {
    if (state.phase === 'trickEnd') {
      state.trick = [];
      state.ledSuit = null;
      state.leader = state.lastTrick.winner;
      state.turn = state.lastTrick.winner;
      if (state.hands.every((h) => h.length === 0)) scoreHand(state);
      else state.phase = 'playing';
      return { ok: true };
    }
    if (state.phase === 'handEnd') {
      const target = state.options.target;
      if (state.scores.some((s) => s >= target)) {
        state.phase = 'gameOver';
        state.winners = state.scores[0] >= target ? [0, 2] : [1, 3];
        log(state, `Game to ${state.players[state.winners[0]].name} and ${state.players[state.winners[1]].name}.`);
      } else {
        deal(state);
      }
      return { ok: true };
    }
    return fail('Nothing to continue.');
  }

  if (state.turn !== seat) return fail('Not your turn.');

  if (move.type === 'pass') {
    if (state.phase === 'bid1') {
      log(state, `${state.players[seat].name} passes.`);
      if (seat === state.dealer) {
        state.phase = 'bid2';
        state.turnedDown = state.upcard.suit;
        state.turn = (state.dealer + 1) % 4;
        log(state, `${cardLabel(state.upcard)} is turned down.`);
      } else {
        state.turn = (seat + 1) % 4;
      }
      return { ok: true };
    }
    if (state.phase === 'bid2') {
      if (state.options.stickTheDealer && seat === state.dealer) return fail('You have to name a suit.');
      log(state, `${state.players[seat].name} passes.`);
      if (seat === state.dealer) {
        log(state, 'Nobody called — the deal moves on.');
        deal(state);
      } else {
        state.turn = (seat + 1) % 4;
      }
      return { ok: true };
    }
    return fail('Nothing to pass on.');
  }

  if (move.type === 'orderUp') {
    if (state.phase !== 'bid1') return fail('Too late to order it up.');
    setMaker(state, seat, state.upcard.suit, !!move.alone);
    state.hands[state.dealer].push(state.upcard);
    state.hands[state.dealer].sort(handSort);
    state.phase = 'dealerDiscard';
    state.turn = state.dealer;
    log(state, `${state.players[seat].name} orders it up${move.alone ? ', alone' : ''}.`);
    // The dealer sitting out an alone hand still has to pitch a card.
    return { ok: true };
  }

  if (move.type === 'call') {
    if (state.phase !== 'bid2') return fail('Not the naming round.');
    if (!SUITS.includes(move.suit)) return fail('No such suit.');
    if (move.suit === state.turnedDown) return fail('That suit was turned down.');
    setMaker(state, seat, move.suit, !!move.alone);
    startPlay(state);
    log(state, `${state.players[seat].name} calls ${SUIT_NAMES[move.suit]}${move.alone ? ', alone' : ''}.`);
    return { ok: true };
  }

  if (move.type === 'discard') {
    if (state.phase !== 'dealerDiscard' || seat !== state.dealer) return fail('Not yours to discard.');
    const hand = state.hands[seat];
    const idx = hand.findIndex((c) => c.id === move.cardId);
    if (idx === -1) return fail('You do not hold that card.');
    state.kitty.push(hand.splice(idx, 1)[0]);
    startPlay(state);
    return { ok: true };
  }

  if (move.type === 'play') {
    if (state.phase !== 'playing') return fail('Not the play.');
    const hand = state.hands[seat];
    const idx = hand.findIndex((c) => c.id === move.cardId);
    if (idx === -1) return fail('You do not hold that card.');
    const card = hand[idx];
    if (!playableCards(state, seat).some((c) => c.id === card.id)) {
      return fail(`You must follow ${SUIT_NAMES[state.ledSuit]}.`);
    }
    hand.splice(idx, 1);
    state.trick.push({ seat, card });
    if (!state.ledSuit) state.ledSuit = effectiveSuit(card, state.trump);
    log(state, `${state.players[seat].name} plays ${cardLabel(card)}.`);

    const playersInHand = state.alone ? 3 : 4;
    if (state.trick.length === playersInHand) {
      const winner = trickWinner(state.trick, state.trump);
      state.tricksWon[winner] += 1;
      state.lastTrick = { plays: state.trick.map((p) => ({ ...p })), winner };
      state.phase = 'trickEnd';
      log(state, `${state.players[winner].name} takes it.`);
    } else {
      state.turn = nextSeat(state, seat);
    }
    return { ok: true };
  }

  return fail('Unknown move.');
}

function setMaker(state, seat, suit, alone) {
  state.trump = suit;
  state.maker = seat;
  state.alone = alone && state.options.allowAlone;
  state.sitter = state.alone ? partnerOf(seat) : null;
  if (state.sitter !== null) state.hands[state.sitter] = [];
}

function startPlay(state) {
  state.phase = 'playing';
  state.leader = (state.dealer + 1) % 4;
  if (state.sitter !== null && state.leader === state.sitter) state.leader = (state.leader + 1) % 4;
  state.turn = state.leader;
  state.trick = [];
  state.ledSuit = null;
}

export function trickWinner(trick, trump) {
  const led = effectiveSuit(trick[0].card, trump);
  let best = null;
  for (const play of trick) {
    const isTrump = effectiveSuit(play.card, trump) === trump;
    const follows = effectiveSuit(play.card, trump) === led;
    if (!isTrump && !follows) continue;
    const score = isTrump ? 100 + trumpRank(play.card, trump) : play.card.rank;
    if (!best || score > best.score) best = { seat: play.seat, score };
  }
  return best.seat;
}

function scoreHand(state) {
  const makers = teamOf(state.maker);
  const takes = [0, 1, 2, 3].reduce((acc, s) => {
    acc[teamOf(s)] += state.tricksWon[s];
    return acc;
  }, [0, 0]);
  let points = 0;
  let text;
  if (takes[makers] >= 3) {
    if (takes[makers] === 5) {
      points = state.alone ? 4 : 2;
      text = state.alone ? 'a march, alone — four' : 'a march — two';
    } else {
      points = 1;
      text = 'the point';
    }
    state.scores[makers] += points;
  } else {
    points = 2;
    text = 'euchred — two to the other side';
    state.scores[1 - makers] += points;
  }
  state.handSummary = {
    hand: state.hand,
    trump: state.trump,
    maker: state.maker,
    alone: state.alone,
    takes,
    points,
    scoredBy: takes[makers] >= 3 ? makers : 1 - makers,
    text
  };
  state.phase = 'handEnd';
  log(state, `${state.players[state.maker].name}'s team took ${takes[makers]}: ${text}.`);
}

export function view(state, seat) {
  return {
    game: 'euchre',
    seat,
    phase: state.phase,
    hand: state.hand,
    target: state.options.target,
    dealer: state.dealer,
    turn: state.turn,
    leader: state.leader,
    trump: state.trump,
    turnedDown: state.turnedDown,
    upcard: ['bid1', 'dealerDiscard'].includes(state.phase) ? state.upcard : null,
    maker: state.maker,
    alone: state.alone,
    sitter: state.sitter,
    ledSuit: state.ledSuit,
    stickTheDealer: state.options.stickTheDealer,
    allowAlone: state.options.allowAlone,
    players: state.players.map((p, i) => ({
      seat: i, name: p.name, isBot: p.isBot, team: teamOf(i),
      cards: state.hands[i].length, tricks: state.tricksWon[i]
    })),
    teams: [0, 1].map((t) => ({
      team: t,
      score: state.scores[t],
      tricks: state.tricksWon.reduce((sum, n, s) => sum + (teamOf(s) === t ? n : 0), 0),
      names: [0, 1, 2, 3].filter((s) => teamOf(s) === t).map((s) => state.players[s].name)
    })),
    cards: seat == null ? [] : state.hands[seat].slice(),
    playable: seat != null && state.phase === 'playing' && state.turn === seat
      ? playableCards(state, seat).map((c) => c.id)
      : [],
    trick: state.trick.map((p) => ({ seat: p.seat, card: p.card })),
    lastTrick: state.lastTrick,
    handSummary: state.handSummary,
    log: state.log.slice(-30),
    winners: state.winners
  };
}

export function isOver(state) { return state.phase === 'gameOver'; }
export function activeSeats(state) {
  if (['trickEnd', 'handEnd'].includes(state.phase)) return [state.turn];
  if (['bid1', 'bid2', 'dealerDiscard', 'playing'].includes(state.phase)) return [state.turn];
  return [];
}
