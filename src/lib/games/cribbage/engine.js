// Cribbage for two — discard to the crib, peg to thirty-one, then count.
import { makeRng, shuffle } from '../rng.js';
import { buildDeck } from '../cards.js';
import { scoreShow, scorePegging, valueOf, label } from './scoring.js';

export const meta = {
  id: 'cribbage',
  name: 'Cribbage',
  tagline: 'Fifteen two, fifteen four — and a race up the board to 121.',
  minPlayers: 2,
  maxPlayers: 2,
  defaultPlayers: 2
};

export function createGame({ players, options = {}, seed = 1 }) {
  if (players.length !== 2) throw new Error('This cribbage board seats two');
  const state = {
    game: 'cribbage',
    seed,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, userId: p.userId ?? null })),
    options: { target: options.target ?? 121 },
    deal: 0,
    dealer: seed % 2,
    phase: 'idle',
    hands: [[], []],
    kept: [[], []],
    crib: [],
    discarded: [false, false],
    deck: [],
    starter: null,
    pile: [],
    played: [],
    count: 0,
    turn: 0,
    lastPlayer: null,
    saidGo: [false, false],
    scores: [0, 0],
    showStep: 0,
    showRows: [],
    lastScore: null,
    log: [],
    winners: null
  };
  dealHand(state);
  return state;
}

function log(state, text) {
  state.log.push({ text });
  if (state.log.length > 200) state.log.shift();
}

function award(state, seat, points, reason) {
  if (!points) return;
  state.scores[seat] += points;
  state.lastScore = { seat, points, reason };
  log(state, `${state.players[seat].name} pegs ${points} — ${reason}.`);
  if (state.scores[seat] >= state.options.target) {
    state.scores[seat] = Math.min(state.scores[seat], state.options.target);
    state.phase = 'gameOver';
    state.winners = [seat];
    log(state, `${state.players[seat].name} is home.`);
  }
}

function dealHand(state) {
  state.deal += 1;
  state.dealer = 1 - state.dealer;
  const rng = makeRng(state.seed + state.deal * 2657);
  const deck = shuffle(buildDeck(), rng);
  state.hands = [deck.splice(0, 6), deck.splice(0, 6)];
  state.hands.forEach((h) => h.sort((a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit)));
  state.kept = [[], []];
  state.crib = [];
  state.discarded = [false, false];
  state.deck = deck;
  state.starter = null;
  state.pile = [];
  state.played = [];
  state.count = 0;
  state.lastPlayer = null;
  state.saidGo = [false, false];
  state.showStep = 0;
  state.showRows = [];
  state.phase = 'discard';
  state.turn = 1 - state.dealer; // the non-dealer lays away first
  log(state, `Deal ${state.deal}: ${state.players[state.dealer].name}'s crib.`);
}

const nonDealer = (state) => 1 - state.dealer;

export function canPlay(state, seat) {
  return state.hands[seat].some((c) => state.count + valueOf(c) <= 31);
}

export function legalMoves(state, seat) {
  if (state.phase === 'discard') {
    if (state.discarded[seat] || state.turn !== seat) return [];
    const hand = state.hands[seat];
    const moves = [];
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        moves.push({ type: 'discard', cardIds: [hand[i].id, hand[j].id] });
      }
    }
    return moves;
  }
  if (state.phase === 'pegging' && state.turn === seat) {
    const playable = state.hands[seat].filter((c) => state.count + valueOf(c) <= 31);
    return playable.length ? playable.map((c) => ({ type: 'play', cardId: c.id })) : [{ type: 'go' }];
  }
  if (state.phase === 'show') return [{ type: 'continue' }];
  return [];
}

export function applyMove(state, seat, move) {
  const fail = (error) => ({ ok: false, error });
  if (state.phase === 'gameOver') return fail('The game is over.');

  if (move.type === 'discard') {
    if (state.phase !== 'discard') return fail('Not the lay-away.');
    if (state.discarded[seat]) return fail('You have already laid away.');
    if (state.turn !== seat) return fail('Wait your turn.');
    const ids = move.cardIds ?? [];
    if (ids.length !== 2 || ids[0] === ids[1]) return fail('Lay away exactly two cards.');
    const hand = state.hands[seat];
    const chosen = ids.map((id) => hand.find((c) => c.id === id));
    if (chosen.some((c) => !c)) return fail('You do not hold those cards.');
    state.hands[seat] = hand.filter((c) => !ids.includes(c.id));
    state.kept[seat] = state.hands[seat].slice();
    state.crib.push(...chosen);
    state.discarded[seat] = true;
    log(state, `${state.players[seat].name} lays away two.`);

    if (state.discarded.every(Boolean)) startPegging(state);
    else state.turn = state.dealer;
    return { ok: true };
  }

  if (move.type === 'play') {
    if (state.phase !== 'pegging' || state.turn !== seat) return fail('Not your play.');
    const hand = state.hands[seat];
    const card = hand.find((c) => c.id === move.cardId);
    if (!card) return fail('You do not hold that card.');
    if (state.count + valueOf(card) > 31) return fail('That would take it past thirty-one.');

    state.hands[seat] = hand.filter((c) => c.id !== card.id);
    state.pile.push(card);
    state.played.push({ seat, card });
    state.count += valueOf(card);
    state.lastPlayer = seat;

    const pegs = scorePegging(state.pile, state.count);
    if (pegs.total) award(state, seat, pegs.total, pegs.parts.map((p) => p.label.toLowerCase()).join(' and '));
    if (state.phase === 'gameOver') return { ok: true };

    const done = state.hands.every((h) => h.length === 0);
    if (done) {
      if (state.count !== 31) award(state, seat, 1, 'last card');
      if (state.phase !== 'gameOver') startShow(state);
      return { ok: true };
    }
    if (state.count === 31) {
      resetSequence(state, 1 - seat);
      return { ok: true };
    }
    state.turn = passTo(state, seat);
    return { ok: true };
  }

  if (move.type === 'go') {
    if (state.phase !== 'pegging' || state.turn !== seat) return fail('Not your play.');
    if (canPlay(state, seat)) return fail('You have a card you can play.');
    state.saidGo[seat] = true;
    const other = 1 - seat;
    if (canPlay(state, other)) {
      state.turn = other;
      return { ok: true };
    }
    // Neither can go on: the last card played takes a point.
    if (state.lastPlayer !== null && state.count !== 31) award(state, state.lastPlayer, 1, 'the go');
    if (state.phase === 'gameOver') return { ok: true };
    if (state.hands.every((h) => h.length === 0)) startShow(state);
    else resetSequence(state, state.lastPlayer === null ? seat : 1 - state.lastPlayer);
    return { ok: true };
  }

  if (move.type === 'continue') {
    if (state.phase !== 'show') return fail('Nothing to continue.');
    return advanceShow(state);
  }

  return fail('Unknown move.');
}

function passTo(state, seat) {
  const other = 1 - seat;
  return canPlay(state, other) ? other : seat;
}

function resetSequence(state, leader) {
  state.pile = [];
  state.count = 0;
  state.saidGo = [false, false];
  state.lastPlayer = null;
  state.turn = state.hands[leader].length ? leader : 1 - leader;
  log(state, 'The count goes back to nothing.');
}

function startPegging(state) {
  const starter = state.deck.pop();
  state.starter = starter;
  log(state, `Cut: ${label(starter)}.`);
  if (starter.rank === 11) award(state, state.dealer, 2, 'his heels');
  if (state.phase === 'gameOver') return;
  state.phase = 'pegging';
  state.turn = nonDealer(state);
  state.count = 0;
  state.pile = [];
}

function startShow(state) {
  state.phase = 'show';
  state.showStep = 0;
  state.showRows = [];
  state.turn = nonDealer(state);
}

function advanceShow(state) {
  const step = state.showStep;
  if (step === 0 || step === 1) {
    const seat = step === 0 ? nonDealer(state) : state.dealer;
    const result = scoreShow(state.kept[seat], state.starter, false);
    state.showRows.push({
      who: state.players[seat].name, seat, cards: state.kept[seat], crib: false, ...result
    });
    award(state, seat, result.total, `${result.total ? result.parts.map((p) => p.label.toLowerCase()).join(', ') : 'nothing'} in hand`);
    state.showStep = step + 1;
    state.turn = step === 0 ? state.dealer : state.dealer;
    return { ok: true };
  }
  if (step === 2) {
    const result = scoreShow(state.crib, state.starter, true);
    state.showRows.push({
      who: `${state.players[state.dealer].name}'s crib`, seat: state.dealer, cards: state.crib, crib: true, ...result
    });
    award(state, state.dealer, result.total, `${result.total ? result.parts.map((p) => p.label.toLowerCase()).join(', ') : 'nothing'} in the crib`);
    state.showStep = 3;
    return { ok: true };
  }
  dealHand(state);
  return { ok: true };
}

export function view(state, seat) {
  const showing = state.phase === 'show';
  return {
    game: 'cribbage',
    seat,
    phase: state.phase,
    deal: state.deal,
    target: state.options.target,
    dealer: state.dealer,
    turn: state.turn,
    starter: state.starter,
    count: state.count,
    pile: state.pile.slice(),
    played: state.played.map((p) => ({ seat: p.seat, card: p.card })),
    hand: seat == null ? [] : state.hands[seat].slice(),
    kept: seat == null ? [] : state.kept[seat].slice(),
    playable: seat != null && state.phase === 'pegging' && state.turn === seat
      ? state.hands[seat].filter((c) => state.count + valueOf(c) <= 31).map((c) => c.id)
      : [],
    mustGo: seat != null && state.phase === 'pegging' && state.turn === seat && !canPlay(state, seat),
    discarded: state.discarded.slice(),
    cribSize: state.crib.length,
    crib: showing && state.showStep >= 3 ? state.crib.slice() : [],
    showStep: state.showStep,
    showRows: state.showRows,
    players: state.players.map((p, i) => ({
      seat: i, name: p.name, isBot: p.isBot, score: state.scores[i], cards: state.hands[i].length
    })),
    lastScore: state.lastScore,
    log: state.log.slice(-30),
    winners: state.winners
  };
}

export function isOver(state) { return state.phase === 'gameOver'; }

export function activeSeats(state) {
  if (state.phase === 'discard') {
    if (!state.discarded[state.turn]) return [state.turn];
    return [1 - state.turn];
  }
  if (state.phase === 'pegging' || state.phase === 'show') return [state.turn];
  return [];
}
