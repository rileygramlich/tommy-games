// Quiddler — eight rounds of drawing, discarding and spelling your hand out.
// Pure state machine, shared by the browser (local tables) and the server.
import { makeRng, shuffle } from '../rng.js';
import { buildDeck, handSize, ROUNDS } from './deck.js';

export const meta = {
  id: 'quiddler',
  name: 'Quiddler',
  tagline: 'The short word game. Spell out your whole hand and go out.',
  minPlayers: 2,
  maxPlayers: 8,
  defaultPlayers: 3
};

// The engine needs a dictionary to judge words; there is one per process.
let dict = null;
export function setDictionary(d) { dict = d; }
export function getDictionary() { return dict; }

export function createGame({ players, options = {}, seed = 1 }) {
  const n = players.length;
  if (n < meta.minPlayers || n > meta.maxPlayers) throw new Error('Quiddler seats 2-8 players');
  const state = {
    game: 'quiddler',
    seed,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, userId: p.userId ?? null })),
    options: {
      rounds: Math.min(options.rounds ?? ROUNDS, ROUNDS),
      bonuses: options.bonuses !== false // longest word / most words, 10 each
    },
    round: 0,
    // Randomised so seat 0 is not always dealt last in round one.
    dealer: (seed % n + n - 1) % n,
    phase: 'idle',
    hands: [],
    drawPile: [],
    discardPile: [],
    turn: 0,
    goneOut: null,
    finished: Array(n).fill(false),
    layouts: Array(n).fill(null),
    scores: Array(n).fill(0),
    scoreboard: [],
    roundSummary: null,
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
  const rng = makeRng(state.seed + state.round * 104729);
  const deck = shuffle(buildDeck(), rng);
  const size = handSize(state.round);
  state.hands = Array.from({ length: n }, () => deck.splice(0, size).sort((a, b) => a.letters.localeCompare(b.letters)));
  state.discardPile = [deck.pop()];
  state.drawPile = deck;
  state.turn = (state.dealer + 1) % n;
  state.goneOut = null;
  state.finished = Array(n).fill(false);
  state.layouts = Array(n).fill(null);
  state.roundSummary = null;
  state.phase = 'draw';
  log(state, `Round ${state.round}: ${size} cards each.`);
}

export function legalMoves(state, seat) {
  if (state.phase === 'draw' && seat === state.turn) {
    const moves = [{ type: 'draw', from: 'deck' }];
    if (state.discardPile.length) moves.push({ type: 'draw', from: 'discard' });
    return moves;
  }
  if (state.phase === 'discard' && seat === state.turn) {
    return state.hands[seat].map((c) => ({ type: 'discard', cardId: c.id }));
  }
  if (state.phase === 'roundEnd') return [{ type: 'continue' }];
  return [];
}

// ---------------------------------------------------------------- layouts

// A layout is a list of words, each a list of card ids from the player's hand.
export function validateLayout(hand, words, requireAll) {
  if (!dict) return { ok: false, error: 'The word list has not loaded yet.' };
  if (!Array.isArray(words)) return { ok: false, error: 'Malformed layout.' };
  const byId = new Map(hand.map((c) => [c.id, c]));
  const used = new Set();
  const out = [];
  for (const ids of words) {
    if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: 'Empty word.' };
    let letters = '';
    let value = 0;
    for (const id of ids) {
      const card = byId.get(id);
      if (!card) return { ok: false, error: 'That card is not in your hand.' };
      if (used.has(id)) return { ok: false, error: 'A card can only be used once.' };
      used.add(id);
      letters += card.letters;
      value += card.value;
    }
    if (letters.length < 2) return { ok: false, error: `"${letters}" is too short — words need two letters.` };
    if (!dict.has(letters)) return { ok: false, error: `"${letters}" is not in the word list.` };
    out.push({ word: letters, value, cardIds: [...ids] });
  }
  const leftover = hand.filter((c) => !used.has(c.id));
  if (requireAll && leftover.length) {
    return { ok: false, error: 'To go out, every card in your hand must be part of a word.' };
  }
  return {
    ok: true,
    layout: {
      words: out,
      leftover: leftover.map((c) => c.id),
      leftoverValue: leftover.reduce((sum, c) => sum + c.value, 0),
      wordValue: out.reduce((sum, w) => sum + w.value, 0)
    }
  };
}

// ---------------------------------------------------------------- apply move

export function applyMove(state, seat, move) {
  const fail = (error) => ({ ok: false, error });
  if (state.phase === 'gameOver') return fail('The game is over.');

  if (move.type === 'draw') {
    if (state.phase !== 'draw' || seat !== state.turn) return fail('Not your turn.');
    if (move.from === 'discard') {
      if (!state.discardPile.length) return fail('The discard pile is empty.');
      const card = state.discardPile.pop();
      state.hands[seat].push(card);
      log(state, `${state.players[seat].name} takes ${card.letters.toUpperCase()} from the discard pile.`);
    } else {
      refillDrawPile(state);
      if (!state.drawPile.length) return fail('No cards left to draw.');
      state.hands[seat].push(state.drawPile.pop());
      log(state, `${state.players[seat].name} draws.`);
    }
    state.phase = 'discard';
    return { ok: true };
  }

  if (move.type === 'discard') {
    if (state.phase !== 'discard' || seat !== state.turn) return fail('Not your turn.');
    const hand = state.hands[seat];
    const idx = hand.findIndex((c) => c.id === move.cardId);
    if (idx === -1) return fail('You do not hold that card.');

    const remaining = hand.filter((_, i) => i !== idx);
    const mustLayDown = state.goneOut !== null; // final turn after someone went out
    const wantsToGoOut = !!move.layout && state.goneOut === null;

    let layout = null;
    if (move.layout || mustLayDown) {
      const words = move.layout?.words ?? [];
      const check = validateLayout(remaining, words, wantsToGoOut);
      if (!check.ok) return fail(check.error);
      layout = check.layout;
    }

    const discarded = hand[idx];
    state.hands[seat] = remaining;
    state.discardPile.push(discarded);

    if (layout) {
      state.layouts[seat] = layout;
      state.finished[seat] = true;
      if (wantsToGoOut) {
        state.goneOut = seat;
        log(state, `${state.players[seat].name} goes out with ${layout.words.map((w) => w.word).join(', ')}.`);
      } else {
        const words = layout.words.map((w) => w.word).join(', ') || 'nothing';
        log(state, `${state.players[seat].name} lays down ${words}.`);
      }
    }

    if (state.finished.every(Boolean)) {
      scoreRound(state);
    } else {
      let next = (seat + 1) % state.players.length;
      while (state.finished[next]) next = (next + 1) % state.players.length;
      state.turn = next;
      state.phase = 'draw';
    }
    return { ok: true };
  }

  if (move.type === 'continue') {
    if (state.phase !== 'roundEnd') return fail('Nothing to continue.');
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

  return fail('Unknown move.');
}

function refillDrawPile(state) {
  if (state.drawPile.length || state.discardPile.length <= 1) return;
  const top = state.discardPile.pop();
  const rng = makeRng(state.seed + state.round * 31 + state.discardPile.length);
  state.drawPile = shuffle(state.discardPile, rng);
  state.discardPile = [top];
  log(state, 'The discard pile is reshuffled into the draw pile.');
}

function scoreRound(state) {
  const n = state.players.length;
  const laid = state.layouts.map((l) => l ?? { words: [], leftover: [], leftoverValue: 0, wordValue: 0 });
  const deltas = laid.map((l) => l.wordValue - l.leftoverValue);
  const bonuses = Array(n).fill(0);

  if (state.options.bonuses) {
    const longest = Math.max(0, ...laid.map((l) => Math.max(0, ...l.words.map((w) => w.word.length))));
    const most = Math.max(0, ...laid.map((l) => l.words.length));
    for (let i = 0; i < n; i++) {
      if (longest > 0 && laid[i].words.some((w) => w.word.length === longest)) bonuses[i] += 10;
      if (most > 0 && laid[i].words.length === most) bonuses[i] += 10;
    }
  }

  const totals = deltas.map((d, i) => d + bonuses[i]);
  totals.forEach((t, i) => { state.scores[i] += t; });
  state.roundSummary = {
    round: state.round,
    goneOut: state.goneOut,
    rows: state.players.map((p, i) => ({
      seat: i,
      name: p.name,
      words: laid[i].words,
      leftover: laid[i].leftover,
      leftoverValue: laid[i].leftoverValue,
      wordValue: laid[i].wordValue,
      bonus: bonuses[i],
      delta: totals[i],
      total: state.scores[i]
    }))
  };
  state.scoreboard.push({ round: state.round, deltas: totals, totals: state.scores.slice() });
  state.phase = 'roundEnd';
  log(state, `Round ${state.round} scored.`);
}

// ---------------------------------------------------------------- seat view

export function view(state, seat) {
  const hand = seat == null ? [] : state.hands[seat];
  return {
    game: 'quiddler',
    seat,
    phase: state.phase,
    round: state.round,
    rounds: state.options.rounds,
    handSize: handSize(state.round),
    dealer: state.dealer,
    turn: state.turn,
    goneOut: state.goneOut,
    mustLayDown: state.goneOut !== null,
    players: state.players.map((p, i) => ({
      seat: i,
      name: p.name,
      isBot: p.isBot,
      cards: state.hands[i].length,
      finished: state.finished[i],
      score: state.scores[i],
      layout: state.layouts[i]
        ? { words: state.layouts[i].words, leftoverValue: state.layouts[i].leftoverValue }
        : null
    })),
    hand: hand.slice(),
    drawPile: state.drawPile.length,
    discardTop: state.discardPile[state.discardPile.length - 1] ?? null,
    discardCount: state.discardPile.length,
    roundSummary: state.roundSummary,
    scoreboard: state.scoreboard,
    log: state.log.slice(-40),
    winners: state.winners
  };
}

export function isOver(state) {
  return state.phase === 'gameOver';
}

export function activeSeats(state) {
  if (state.phase === 'roundEnd') return [state.turn];
  if (state.phase === 'draw' || state.phase === 'discard') return [state.turn];
  return [];
}
