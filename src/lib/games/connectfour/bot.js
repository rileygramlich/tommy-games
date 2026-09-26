// Connect Four bot: alpha-beta over a threat-counting evaluation.
//
// Connect Four is small enough that a fixed depth plays well, but it is also
// solved, so a full-strength bot would simply never lose as first player. The
// depth here is tuned to the rest of the shelf: it sees immediate wins and
// blocks, it will not hand you a trivial loss, and it can still be beaten.
import { COLS, ROWS, dropRow, lineThrough, isFull } from './engine.js';

const CENTER = Math.floor(COLS / 2);
// Search the middle first: it sits on more lines than any other column, so it
// both plays better and prunes harder.
const ORDER = Array.from({ length: COLS }, (_, i) => i).sort(
  (a, b) => Math.abs(a - CENTER) - Math.abs(b - CENTER)
);
const DEPTH = 6;
const WIN = 100000;

function play(board, col, seat) {
  const row = dropRow(board, col);
  if (row === -1) return null;
  const next = board.slice();
  next[row * COLS + col] = seat;
  return { board: next, index: row * COLS + col };
}

/** Every window of four cells on the board, precomputed once. */
function buildWindows() {
  const windows = [];
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      for (const [dr, dc] of dirs) {
        const cells = [];
        for (let k = 0; k < 4; k++) {
          const r = row + dr * k;
          const c = col + dc * k;
          if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break;
          cells.push(r * COLS + c);
        }
        if (cells.length === 4) windows.push(cells);
      }
    }
  }
  return windows;
}
const WINDOWS = buildWindows();

function evaluate(board, seat) {
  const other = 1 - seat;
  let score = 0;
  for (const cells of WINDOWS) {
    let mine = 0;
    let theirs = 0;
    for (const i of cells) {
      if (board[i] === seat) mine++;
      else if (board[i] === other) theirs++;
    }
    // A window holding both colours can never become a four for anyone.
    if (mine && theirs) continue;
    if (mine === 3) score += 60;
    else if (mine === 2) score += 8;
    else if (mine === 1) score += 1;
    if (theirs === 3) score -= 70; // block a little harder than you build
    else if (theirs === 2) score -= 9;
    else if (theirs === 1) score -= 1;
  }
  // Central discs support more future lines.
  for (let row = 0; row < ROWS; row++) {
    const v = board[row * COLS + CENTER];
    if (v === seat) score += 6;
    else if (v === other) score -= 6;
  }
  return score;
}

function search(board, seat, toMove, depth, alpha, beta) {
  const maximizing = toMove === seat;
  let best = maximizing ? -Infinity : Infinity;
  let moved = false;
  for (const col of ORDER) {
    const step = play(board, col, toMove);
    if (!step) continue;
    moved = true;
    let score;
    if (lineThrough(step.board, step.index)) {
      // A win found deeper is worth less, so the bot prefers the quickest one
      // and delays a loss as long as it can.
      score = maximizing ? WIN + depth : -WIN - depth;
    } else if (depth === 0 || isFull(step.board)) {
      score = isFull(step.board) ? 0 : evaluate(step.board, seat);
    } else {
      score = search(step.board, seat, 1 - toMove, depth - 1, alpha, beta);
    }
    if (maximizing) {
      if (score > best) best = score;
      if (score > alpha) alpha = score;
    } else {
      if (score < best) best = score;
      if (score < beta) beta = score;
    }
    if (alpha >= beta) break;
  }
  if (!moved) return 0; // full board
  return best;
}

export function chooseMove(v, rng = Math.random) {
  const board = v.board;
  const seat = v.seat;
  const options = ORDER.filter((col) => dropRow(board, col) !== -1);
  if (!options.length) return null;

  let best = null;
  let alpha = -Infinity;
  for (const col of options) {
    const step = play(board, col, seat);
    let score;
    if (lineThrough(step.board, step.index)) score = WIN + DEPTH; // take it now
    else if (isFull(step.board)) score = 0;
    else score = search(step.board, seat, 1 - seat, DEPTH - 1, alpha, Infinity);
    score += (rng() - 0.5) * 0.01; // break exact ties differently game to game
    if (!best || score > best.score) best = { score, col };
    if (score > alpha) alpha = score;
  }
  return { type: 'drop', col: best.col };
}
