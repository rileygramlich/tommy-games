// Sequence — play a card, cover its square, get five in a row. Jacks bend it.
import { makeRng, shuffle } from '../rng.js';
import { buildDeck, cardLabel } from '../cards.js';
import { BOARD, SIZE, isCorner, squaresFor, isWildJack, isRemoveJack, isJack, cellLabel } from './board.js';

export const meta = {
  id: 'sequence',
  name: 'Sequence',
  tagline: 'Cover the card, build the line. Two-eyed jacks go anywhere.',
  minPlayers: 2,
  maxPlayers: 3,
  defaultPlayers: 2
};

export const CHIP_COLOURS = ['#2f6f9f', '#3f8a55', '#a8433a'];
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

export function createGame({ players, options = {}, seed = 1 }) {
  const n = players.length;
  const rng = makeRng(seed);
  const deck = shuffle(buildDeck({ copies: 2 }), rng);
  const handSize = n === 2 ? 7 : 6;
  const state = {
    game: 'sequence',
    seed,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, userId: p.userId ?? null })),
    options: { needed: options.needed ?? (n === 2 ? 2 : 1) },
    chips: new Array(SIZE * SIZE).fill(null),
    sequences: [],
    hands: Array.from({ length: n }, () => deck.splice(0, handSize)),
    drawPile: deck,
    discardPile: [],
    turn: seed % n,
    phase: 'playing',
    exchanged: false,
    passes: 0,
    lastMove: null,
    log: [],
    winners: null
  };
  state.hands.forEach((h) => h.sort(handSort));
  log(state, `${state.players[state.turn].name} starts.`);
  return state;
}

function handSort(a, b) {
  return a.suit.localeCompare(b.suit) || a.rank - b.rank;
}

function log(state, text) {
  state.log.push({ text });
  if (state.log.length > 200) state.log.shift();
}

export function lockedCells(state) {
  const set = new Set();
  for (const seq of state.sequences) for (const cell of seq.cells) set.add(cell);
  return set;
}

function ownsCell(state, seat, index) {
  return isCorner(index) || state.chips[index] === seat;
}

export function isDead(state, card) {
  if (isJack(card)) return false;
  return squaresFor(card).every((i) => state.chips[i] !== null);
}

export function legalMoves(state, seat) {
  if (state.phase !== 'playing' || state.turn !== seat) return [];
  const moves = [];
  const locked = lockedCells(state);
  for (const card of state.hands[seat]) {
    if (isWildJack(card)) {
      for (let i = 0; i < state.chips.length; i++) {
        if (!isCorner(i) && state.chips[i] === null) moves.push({ type: 'play', cardId: card.id, index: i });
      }
    } else if (isRemoveJack(card)) {
      for (let i = 0; i < state.chips.length; i++) {
        if (state.chips[i] !== null && state.chips[i] !== seat && !locked.has(i)) {
          moves.push({ type: 'remove', cardId: card.id, index: i });
        }
      }
    } else {
      for (const i of squaresFor(card)) {
        if (state.chips[i] === null) moves.push({ type: 'play', cardId: card.id, index: i });
      }
      if (!state.exchanged && isDead(state, card)) moves.push({ type: 'exchange', cardId: card.id });
    }
  }
  // Every card dead and the one swap already used: the turn is simply lost.
  return moves.length ? moves : [{ type: 'pass' }];
}

function draw(state, seat) {
  if (!state.drawPile.length && state.discardPile.length > 1) {
    const rng = makeRng(state.seed + state.discardPile.length * 97);
    state.drawPile = shuffle(state.discardPile.splice(0, state.discardPile.length - 1), rng);
    log(state, 'The discards are shuffled back in.');
  }
  const card = state.drawPile.pop();
  if (card) {
    state.hands[seat].push(card);
    state.hands[seat].sort(handSort);
  }
}

export function applyMove(state, seat, move) {
  const fail = (error) => ({ ok: false, error });
  if (state.phase !== 'playing') return fail('The game is over.');
  if (state.turn !== seat) return fail('Not your turn.');

  if (move.type === 'pass') {
    const others = legalMoves(state, seat).filter((m) => m.type !== 'pass');
    if (others.length) return fail('You have a card you can play.');
    log(state, `${state.players[seat].name} cannot play and sits it out.`);
    state.passes += 1;
    // Once everyone has passed in turn the board is stuck and the game is drawn.
    if (state.passes >= state.players.length) {
      state.phase = 'gameOver';
      state.winners = [];
      log(state, 'Nobody can move — the board is dead and the game is drawn.');
      return { ok: true };
    }
    // Advance the seat but keep the pass count: endTurn would clear it.
    state.exchanged = false;
    state.turn = (state.turn + 1) % state.players.length;
    return { ok: true };
  }

  const hand = state.hands[seat];
  const card = hand.find((c) => c.id === move.cardId);
  if (!card) return fail('You do not hold that card.');

  if (move.type === 'exchange') {
    if (state.exchanged) return fail('Only one dead card a turn.');
    if (!isDead(state, card)) return fail('That card still has an open square.');
    state.hands[seat] = hand.filter((c) => c.id !== card.id);
    state.discardPile.push(card);
    draw(state, seat);
    state.exchanged = true;
    log(state, `${state.players[seat].name} swaps a dead ${cardLabel(card)}.`);
    return { ok: true };
  }

  if (move.type === 'play') {
    const index = Number(move.index);
    if (!Number.isInteger(index) || index < 0 || index >= state.chips.length) return fail('No such square.');
    if (isCorner(index)) return fail('The corners are free spaces.');
    if (state.chips[index] !== null) return fail('That square is taken.');
    if (!isWildJack(card)) {
      const cell = BOARD[index];
      if (!cell || cell.suit !== card.suit || cell.rank !== card.rank) {
        return fail(`${cardLabel(card)} does not go there.`);
      }
    }
    state.chips[index] = seat;
    state.hands[seat] = hand.filter((c) => c.id !== card.id);
    state.discardPile.push(card);
    draw(state, seat);
    state.lastMove = { seat, index, type: 'play' };
    log(state, `${state.players[seat].name} covers ${cellLabel(index)}${isWildJack(card) ? ' with a jack' : ''}.`);
    countSequences(state, seat, index);
    if (state.phase === 'gameOver') return { ok: true };
    endTurn(state);
    return { ok: true };
  }

  if (move.type === 'remove') {
    const index = Number(move.index);
    if (!isRemoveJack(card)) return fail('That card cannot remove a chip.');
    if (state.chips[index] === null) return fail('There is no chip there.');
    if (state.chips[index] === seat) return fail('You cannot remove your own chip.');
    if (lockedCells(state).has(index)) return fail('That chip is part of a finished sequence.');
    const victim = state.chips[index];
    state.chips[index] = null;
    state.hands[seat] = hand.filter((c) => c.id !== card.id);
    state.discardPile.push(card);
    draw(state, seat);
    state.lastMove = { seat, index, type: 'remove' };
    log(state, `${state.players[seat].name} knocks ${state.players[victim].name} off ${cellLabel(index)}.`);
    endTurn(state);
    return { ok: true };
  }

  return fail('Unknown move.');
}

function endTurn(state) {
  state.exchanged = false;
  state.passes = 0;
  state.turn = (state.turn + 1) % state.players.length;
}

// A new run of five may share at most one chip with this player's earlier ones.
function countSequences(state, seat, index) {
  let added = true;
  while (added) {
    added = false;
    const mine = new Set();
    for (const seq of state.sequences) {
      if (seq.seat === seat) for (const cell of seq.cells) mine.add(cell);
    }
    for (const [dr, dc] of DIRS) {
      const line = [];
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      for (let step = -4; step <= 4; step++) {
        const r = row + dr * step;
        const c = col + dc * step;
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) { line.push(null); continue; }
        const cell = r * SIZE + c;
        line.push(ownsCell(state, seat, cell) ? cell : null);
      }
      for (let start = 0; start + 5 <= line.length; start++) {
        const window = line.slice(start, start + 5);
        if (window.some((cell) => cell === null)) continue;
        if (!window.includes(index)) continue;
        const shared = window.filter((cell) => mine.has(cell)).length;
        if (shared > 1) continue;
        state.sequences.push({ seat, cells: window });
        log(state, `${state.players[seat].name} completes a sequence.`);
        added = true;
        break;
      }
      if (added) break;
    }
    const count = state.sequences.filter((s) => s.seat === seat).length;
    if (count >= state.options.needed) {
      state.phase = 'gameOver';
      state.winners = [seat];
      log(state, `${state.players[seat].name} wins with ${count} sequence${count > 1 ? 's' : ''}.`);
      return;
    }
  }
}

export function view(state, seat) {
  const locked = [...lockedCells(state)];
  return {
    game: 'sequence',
    seat,
    phase: state.phase,
    turn: state.turn,
    board: BOARD,
    chips: state.chips.slice(),
    locked,
    sequences: state.sequences.map((s) => ({ seat: s.seat, cells: s.cells })),
    needed: state.options.needed,
    hand: seat == null ? [] : state.hands[seat].slice(),
    dead: seat == null ? [] : state.hands[seat].filter((c) => isDead(state, c)).map((c) => c.id),
    exchanged: state.exchanged,
    drawPile: state.drawPile.length,
    lastMove: state.lastMove,
    players: state.players.map((p, i) => ({
      seat: i, name: p.name, isBot: p.isBot, colour: CHIP_COLOURS[i],
      cards: state.hands[i].length,
      sequences: state.sequences.filter((s) => s.seat === i).length
    })),
    log: state.log.slice(-30),
    winners: state.winners
  };
}

export function isOver(state) { return state.phase === 'gameOver'; }
export function activeSeats(state) { return state.phase === 'playing' ? [state.turn] : []; }
