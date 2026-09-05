// Reversi bot: alpha-beta over a positional table, with an exact endgame solve.
import { flipsFor, counts, SIZE } from './engine.js';

// Corners are worth everything; the squares beside them hand corners away.
const WEIGHTS = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
   20,  -5, 15, 3, 3, 15,  -5,  20,
    5,  -5,  3, 3, 3,  3,  -5,   5,
    5,  -5,  3, 3, 3,  3,  -5,   5,
   20,  -5, 15, 3, 3, 15,  -5,  20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120
];

function movesFor(board, seat) {
  const out = [];
  for (let i = 0; i < board.length; i++) {
    const flips = flipsFor(board, i, seat);
    if (flips.length) out.push({ index: i, flips });
  }
  return out;
}

function play(board, index, flips, seat) {
  const next = board.slice();
  next[index] = seat;
  for (const i of flips) next[i] = seat;
  return next;
}

function evaluate(board, seat, empties) {
  const [dark, light] = counts(board);
  const mine = seat === 0 ? dark : light;
  const theirs = seat === 0 ? light : dark;
  if (empties === 0) return (mine - theirs) * 10000;

  let position = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === seat) position += WEIGHTS[i];
    else if (board[i] === 1 - seat) position -= WEIGHTS[i];
  }
  const mobility = movesFor(board, seat).length - movesFor(board, 1 - seat).length;
  // Late on, raw disc count is what actually wins; early on it is a trap.
  const discWeight = empties < 12 ? 12 : 1;
  return position + mobility * 14 + (mine - theirs) * discWeight;
}

function search(board, seat, toMove, depth, alpha, beta, empties) {
  if (depth === 0 || empties === 0) return evaluate(board, seat, empties);
  const moves = movesFor(board, toMove);
  if (!moves.length) {
    // No move: pass, unless neither side can move, which ends the game.
    if (!movesFor(board, 1 - toMove).length) return evaluate(board, seat, 0);
    return search(board, seat, 1 - toMove, depth - 1, alpha, beta, empties);
  }
  moves.sort((a, b) => WEIGHTS[b.index] - WEIGHTS[a.index]);
  if (toMove === seat) {
    let best = -Infinity;
    for (const m of moves) {
      const score = search(play(board, m.index, m.flips, toMove), seat, 1 - toMove, depth - 1, alpha, beta, empties - 1);
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    const score = search(play(board, m.index, m.flips, toMove), seat, 1 - toMove, depth - 1, alpha, beta, empties - 1);
    best = Math.min(best, score);
    beta = Math.min(beta, score);
    if (alpha >= beta) break;
  }
  return best;
}

export function chooseMove(v, rng = Math.random) {
  const board = v.board;
  const seat = v.seat;
  const moves = movesFor(board, seat);
  if (!moves.length) return null;
  if (moves.length === 1) return { type: 'place', index: moves[0].index };

  const empties = v.empties;
  // Solve the ending outright; play a shallower search while the board is open.
  const depth = empties <= 10 ? empties : empties <= 20 ? 6 : 4;

  let best = null;
  let alpha = -Infinity;
  for (const m of moves) {
    const score = search(play(board, m.index, m.flips, seat), seat, 1 - seat, depth - 1, alpha, Infinity, empties - 1)
      + (rng() - 0.5) * 0.01; // break exact ties differently game to game
    if (!best || score > best.score) best = { score, index: m.index };
    alpha = Math.max(alpha, score);
  }
  return { type: 'place', index: best.index };
}
