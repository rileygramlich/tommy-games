// Checkers — American/English draughts. Captures are compulsory, men crown on
// the far row, kings move both ways one square at a time.
export const meta = {
  id: 'checkers',
  name: 'Checkers',
  tagline: 'Jumps are compulsory. Crown a man and the board opens up.',
  minPlayers: 2,
  maxPlayers: 2,
  defaultPlayers: 2
};

export const SIZE = 8;
export const EMPTY = -1;

// A square holds -1, or a piece encoded as seat | (king ? 2 : 0). Keeping the
// board a flat array of small numbers means a state clone is a slice, which the
// bot's search leans on heavily.
export const seatOf = (piece) => (piece === EMPTY ? -1 : piece & 1);
export const isKing = (piece) => piece >= 2;
export const makePiece = (seat, king) => seat | (king ? 2 : 0);

const rowOf = (i) => Math.floor(i / SIZE);
const colOf = (i) => i % SIZE;
/** Only the dark squares are ever used. */
export const isPlayable = (i) => (rowOf(i) + colOf(i)) % 2 === 1;

// Seat 0 sits at the bottom and moves up the board (decreasing row).
const FORWARD = [-1, 1];
const DIAGONALS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

/** Moves without wrapping: a diagonal step must change row and column by one. */
function offset(index, dr, dc) {
  const row = rowOf(index) + dr;
  const col = colOf(index) + dc;
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return -1;
  return row * SIZE + col;
}

function directionsFor(piece) {
  if (isKing(piece)) return DIAGONALS;
  const dr = FORWARD[seatOf(piece)];
  return [[dr, -1], [dr, 1]];
}

/** Every jump available from one square. */
export function jumpsFrom(board, index) {
  const piece = board[index];
  if (piece === EMPTY) return [];
  const seat = seatOf(piece);
  const out = [];
  for (const [dr, dc] of directionsFor(piece)) {
    const over = offset(index, dr, dc);
    if (over === -1 || board[over] === EMPTY || seatOf(board[over]) === seat) continue;
    const landing = offset(index, dr * 2, dc * 2);
    if (landing === -1 || board[landing] !== EMPTY) continue;
    out.push({ type: 'move', from: index, to: landing, captured: over });
  }
  return out;
}

/** Every quiet (non-capturing) step from one square. */
export function stepsFrom(board, index) {
  const piece = board[index];
  if (piece === EMPTY) return [];
  const out = [];
  for (const [dr, dc] of directionsFor(piece)) {
    const to = offset(index, dr, dc);
    if (to !== -1 && board[to] === EMPTY) out.push({ type: 'move', from: index, to, captured: -1 });
  }
  return out;
}

/**
 * Legal moves for a seat.
 *
 * Two rules shape this list. Captures are compulsory, so when any jump exists
 * the quiet moves disappear. And a multi-jump is played one hop at a time: while
 * a chain is in progress only the jumping piece may move, and only by jumping.
 */
export function legalMoves(state, seat) {
  if (state.phase !== 'playing' || state.turn !== seat) return [];
  const board = state.board;
  if (state.chainFrom !== null) return jumpsFrom(board, state.chainFrom);

  const jumps = [];
  const steps = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === EMPTY || seatOf(board[i]) !== seat) continue;
    jumps.push(...jumpsFrom(board, i));
    steps.push(...stepsFrom(board, i));
  }
  return jumps.length ? jumps : steps;
}

export function createGame({ players, options = {}, seed = 1 }) {
  const board = new Array(SIZE * SIZE).fill(EMPTY);
  for (let i = 0; i < board.length; i++) {
    if (!isPlayable(i)) continue;
    const row = rowOf(i);
    if (row < 3) board[i] = makePiece(1, false);       // seat 1 starts at the top
    else if (row > 4) board[i] = makePiece(0, false);  // seat 0 starts at the bottom
  }
  return {
    game: 'checkers',
    seed,
    players: players.map((p, i) => ({
      seat: i, name: p.name, isBot: !!p.isBot, userId: p.userId ?? null
    })),
    options: { showHints: options.showHints !== false },
    board,
    turn: 0,
    phase: 'playing',
    // Set while a multi-jump is mid-chain: only this square may move.
    chainFrom: null,
    lastMove: null,
    // Plies since the last capture or crowning, for the draw rule.
    quiet: 0,
    log: [],
    winners: null
  };
}

export function counts(board) {
  const out = [0, 0];
  for (const piece of board) if (piece !== EMPTY) out[seatOf(piece)] += 1;
  return out;
}

export function square(index) {
  return `${'abcdefgh'[colOf(index)]}${SIZE - rowOf(index)}`;
}

/** The row a seat crowns on. */
const crownRow = (seat) => (seat === 0 ? 0 : SIZE - 1);

/** Plies without a capture or a crowning before the game is called a draw. */
export const QUIET_LIMIT = 80;

export function applyMove(state, seat, move) {
  if (state.phase !== 'playing') return { ok: false, error: 'The game is over.' };
  if (move.type !== 'move') return { ok: false, error: 'Unknown move.' };
  if (state.turn !== seat) return { ok: false, error: 'Not your turn.' };

  const legal = legalMoves(state, seat).find(
    (m) => m.from === move.from && m.to === move.to
  );
  if (!legal) {
    const jumpAvailable = state.chainFrom === null
      && legalMoves(state, seat).some((m) => m.captured !== -1);
    return {
      ok: false,
      error: jumpAvailable ? 'A jump is available, and jumps must be taken.' : 'That is not a legal move.'
    };
  }

  const board = state.board;
  const piece = board[legal.from];
  board[legal.from] = EMPTY;
  board[legal.to] = piece;
  const name = state.players[seat].name;

  if (legal.captured !== -1) {
    board[legal.captured] = EMPTY;
    state.quiet = 0;
    state.log.push({ text: `${name} jumps ${square(legal.from)}→${square(legal.to)}.` });
  } else {
    state.quiet += 1;
    state.log.push({ text: `${name} moves ${square(legal.from)}→${square(legal.to)}.` });
  }
  state.lastMove = { from: legal.from, to: legal.to, captured: legal.captured };

  // Crowning ends the turn, even mid-chain — that is the American rule, and it
  // is the one place a multi-jump can stop early.
  let crowned = false;
  if (!isKing(piece) && rowOf(legal.to) === crownRow(seat)) {
    board[legal.to] = makePiece(seat, true);
    crowned = true;
    state.quiet = 0;
    state.log.push({ text: `${name} crowns at ${square(legal.to)}.` });
  }

  const more = legal.captured !== -1 && !crowned && jumpsFrom(board, legal.to).length > 0;
  if (more) {
    state.chainFrom = legal.to;
  } else {
    state.chainFrom = null;
    state.turn = 1 - seat;
  }

  settle(state);
  if (state.log.length > 200) state.log.shift();
  return { ok: true };
}

/** End the game when a side is wiped out, stuck, or the position has gone quiet. */
function settle(state) {
  if (state.phase !== 'playing') return;
  const [zero, one] = counts(state.board);
  if (zero === 0 || one === 0) {
    state.phase = 'gameOver';
    state.winners = [zero === 0 ? 1 : 0];
    state.log.push({ text: `${state.players[state.winners[0]].name} takes every piece.` });
    return;
  }
  if (!legalMoves(state, state.turn).length) {
    // Being unable to move is a loss in draughts, not a pass.
    state.phase = 'gameOver';
    state.winners = [1 - state.turn];
    state.log.push({ text: `${state.players[state.turn].name} has no move left.` });
    return;
  }
  if (state.quiet >= QUIET_LIMIT) {
    state.phase = 'gameOver';
    state.winners = [0, 1];
    state.log.push({ text: 'Forty moves without a capture or a crown — drawn.' });
  }
}

export function view(state, seat) {
  const [zero, one] = counts(state.board);
  const mine = seat != null && state.turn === seat && state.phase === 'playing'
    ? legalMoves(state, seat)
    : [];
  return {
    game: 'checkers',
    seat,
    phase: state.phase,
    board: state.board.slice(),
    turn: state.turn,
    legal: mine.map((m) => ({ from: m.from, to: m.to, captured: m.captured })),
    // Squares the player may pick up this turn — during a chain, only one.
    movable: [...new Set(mine.map((m) => m.from))],
    chainFrom: state.chainFrom,
    hints: state.options.showHints,
    players: state.players.map((p, i) => ({
      seat: i, name: p.name, isBot: p.isBot, pieces: i === 0 ? zero : one
    })),
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    log: state.log.slice(-30),
    winners: state.winners
  };
}

export function isOver(state) { return state.phase === 'gameOver'; }
export function activeSeats(state) { return state.phase === 'playing' ? [state.turn] : []; }
