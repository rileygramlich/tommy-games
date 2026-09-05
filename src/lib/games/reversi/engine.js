// Reversi (Othello) — flip every line you bracket, own the board at the end.
export const meta = {
  id: 'reversi',
  name: 'Reversi',
  tagline: 'Bracket a line, flip it all. Corners are forever.',
  minPlayers: 2,
  maxPlayers: 2,
  defaultPlayers: 2
};

export const SIZE = 8;
const DIRS = [-9, -8, -7, -1, 1, 7, 8, 9];

const rowOf = (i) => Math.floor(i / SIZE);
const colOf = (i) => i % SIZE;

// Steps that would wrap around an edge are not moves.
function stepOk(from, to) {
  if (to < 0 || to >= SIZE * SIZE) return false;
  return Math.abs(colOf(from) - colOf(to)) <= 1 && Math.abs(rowOf(from) - rowOf(to)) <= 1;
}

export function createGame({ players, options = {}, seed = 1 }) {
  const board = new Array(SIZE * SIZE).fill(-1);
  const mid = SIZE / 2;
  board[(mid - 1) * SIZE + (mid - 1)] = 1;
  board[(mid - 1) * SIZE + mid] = 0;
  board[mid * SIZE + (mid - 1)] = 0;
  board[mid * SIZE + mid] = 1;
  return {
    game: 'reversi',
    seed,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, userId: p.userId ?? null })),
    options: { showHints: options.showHints !== false },
    board,
    turn: 0,      // seat 0 is dark and moves first, as it should
    phase: 'playing',
    lastMove: null,
    lastFlips: [],
    passes: 0,
    log: [],
    winners: null
  };
}

export function flipsFor(board, index, seat) {
  if (board[index] !== -1) return [];
  const other = 1 - seat;
  const out = [];
  for (const dir of DIRS) {
    const line = [];
    let from = index;
    let to = index + dir;
    while (stepOk(from, to) && board[to] === other) {
      line.push(to);
      from = to;
      to += dir;
    }
    if (line.length && stepOk(from, to) && board[to] === seat) out.push(...line);
  }
  return out;
}

export function legalMoves(state, seat) {
  if (state.phase !== 'playing' || state.turn !== seat) return [];
  const out = [];
  for (let i = 0; i < state.board.length; i++) {
    if (flipsFor(state.board, i, seat).length) out.push({ type: 'place', index: i });
  }
  return out;
}

function hasMove(board, seat) {
  for (let i = 0; i < board.length; i++) if (flipsFor(board, i, seat).length) return true;
  return false;
}

export function counts(board) {
  return [board.filter((v) => v === 0).length, board.filter((v) => v === 1).length];
}

export function applyMove(state, seat, move) {
  if (state.phase !== 'playing') return { ok: false, error: 'The game is over.' };
  if (move.type !== 'place') return { ok: false, error: 'Unknown move.' };
  if (state.turn !== seat) return { ok: false, error: 'Not your turn.' };
  const flips = flipsFor(state.board, move.index, seat);
  if (!flips.length) return { ok: false, error: 'That square would not flip anything.' };

  state.board[move.index] = seat;
  for (const i of flips) state.board[i] = seat;
  state.lastMove = move.index;
  state.lastFlips = flips;
  const name = state.players[seat].name;
  state.log.push({ text: `${name} plays ${square(move.index)} and flips ${flips.length}.` });

  const other = 1 - seat;
  if (hasMove(state.board, other)) {
    state.turn = other;
    state.passes = 0;
  } else if (hasMove(state.board, seat)) {
    state.passes = 1;
    state.log.push({ text: `${state.players[other].name} has nowhere to play — ${name} goes again.` });
  } else {
    finish(state);
  }
  if (state.log.length > 200) state.log.shift();
  return { ok: true };
}

function finish(state) {
  state.phase = 'gameOver';
  const [dark, light] = counts(state.board);
  if (dark === light) state.winners = [0, 1];
  else state.winners = [dark > light ? 0 : 1];
  state.log.push({ text: `Final: ${dark}–${light}.` });
}

export function square(index) {
  return `${'abcdefgh'[colOf(index)]}${rowOf(index) + 1}`;
}

export function view(state, seat) {
  const [dark, light] = counts(state.board);
  return {
    game: 'reversi',
    seat,
    phase: state.phase,
    board: state.board.slice(),
    turn: state.turn,
    legal: seat != null && state.turn === seat && state.phase === 'playing'
      ? legalMoves(state, seat).map((m) => m.index)
      : [],
    hints: state.options.showHints,
    players: state.players.map((p, i) => ({
      seat: i, name: p.name, isBot: p.isBot, discs: i === 0 ? dark : light
    })),
    lastMove: state.lastMove,
    lastFlips: state.lastFlips.slice(),
    empties: state.board.filter((v) => v === -1).length,
    log: state.log.slice(-30),
    winners: state.winners
  };
}

export function isOver(state) { return state.phase === 'gameOver'; }
export function activeSeats(state) { return state.phase === 'playing' ? [state.turn] : []; }
