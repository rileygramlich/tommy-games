// Connect Four — drop a disc, own a line of four. Gravity does the rest.
export const meta = {
  id: 'connectfour',
  name: 'Connect Four',
  tagline: 'Drop a disc, take a line of four. Gravity decides the rest.',
  minPlayers: 2,
  maxPlayers: 2,
  defaultPlayers: 2
};

export const COLS = 7;
export const ROWS = 6;

const rowOf = (i) => Math.floor(i / COLS);
const colOf = (i) => i % COLS;

/** Index of the lowest empty cell in a column, or -1 when the column is full. */
export function dropRow(board, col) {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row * COLS + col] === -1) return row;
  }
  return -1;
}

export function createGame({ players, options = {}, seed = 1 }) {
  return {
    game: 'connectfour',
    seed,
    players: players.map((p, i) => ({
      seat: i, name: p.name, isBot: !!p.isBot, userId: p.userId ?? null
    })),
    options: { showHints: options.showHints !== false },
    board: new Array(ROWS * COLS).fill(-1),
    turn: 0, // seat 0 drops first
    phase: 'playing',
    lastMove: null,
    line: [],
    log: [],
    winners: null
  };
}

export function legalMoves(state, seat) {
  if (state.phase !== 'playing' || state.turn !== seat) return [];
  const out = [];
  for (let col = 0; col < COLS; col++) {
    if (dropRow(state.board, col) !== -1) out.push({ type: 'drop', col });
  }
  return out;
}

/**
 * The four-in-a-row through `index`, or null. Only lines through the disc just
 * played can be new, so a win check never has to scan the whole board.
 */
export function lineThrough(board, index) {
  const seat = board[index];
  if (seat === -1) return null;
  const row = rowOf(index);
  const col = colOf(index);
  // right, down, down-right, down-left
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    const cells = [index];
    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r * COLS + c] === seat) {
        cells.push(r * COLS + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (cells.length >= 4) return cells.sort((a, b) => a - b);
  }
  return null;
}

export function isFull(board) {
  return board.every((v) => v !== -1);
}

export function applyMove(state, seat, move) {
  if (state.phase !== 'playing') return { ok: false, error: 'The game is over.' };
  if (move.type !== 'drop') return { ok: false, error: 'Unknown move.' };
  if (state.turn !== seat) return { ok: false, error: 'Not your turn.' };
  const col = Number(move.col);
  if (!Number.isInteger(col) || col < 0 || col >= COLS) {
    return { ok: false, error: 'That column is off the board.' };
  }
  const row = dropRow(state.board, col);
  if (row === -1) return { ok: false, error: 'That column is full.' };

  const index = row * COLS + col;
  state.board[index] = seat;
  state.lastMove = index;
  const name = state.players[seat].name;
  state.log.push({ text: `${name} drops into column ${col + 1}.` });

  const line = lineThrough(state.board, index);
  if (line) {
    state.line = line;
    state.phase = 'gameOver';
    state.winners = [seat];
    state.log.push({ text: `${name} connects four.` });
  } else if (isFull(state.board)) {
    state.phase = 'gameOver';
    state.winners = [0, 1];
    state.log.push({ text: 'The board is full — a draw.' });
  } else {
    state.turn = 1 - seat;
  }
  if (state.log.length > 200) state.log.shift();
  return { ok: true };
}

export function view(state, seat) {
  return {
    game: 'connectfour',
    seat,
    phase: state.phase,
    board: state.board.slice(),
    turn: state.turn,
    legal: seat != null && state.turn === seat && state.phase === 'playing'
      ? legalMoves(state, seat).map((m) => m.col)
      : [],
    hints: state.options.showHints,
    // Where a disc would land in each column, so the table can preview a drop.
    landing: Array.from({ length: COLS }, (_, col) => dropRow(state.board, col)),
    players: state.players.map((p, i) => ({ seat: i, name: p.name, isBot: p.isBot })),
    lastMove: state.lastMove,
    line: state.line.slice(),
    log: state.log.slice(-30),
    winners: state.winners
  };
}

export function isOver(state) { return state.phase === 'gameOver'; }
export function activeSeats(state) { return state.phase === 'playing' ? [state.turn] : []; }
