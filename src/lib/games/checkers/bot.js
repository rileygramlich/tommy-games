// Checkers bot: alpha-beta over material and position.
//
// Draughts branches narrowly — captures are compulsory, so most positions offer
// only a handful of moves — which means a modest depth already plays a decent
// game. Depth is kept where the bot punishes a hanging piece and sees a
// two-jump combination, without becoming the kind of opponent nobody beats.
import {
  EMPTY, SIZE, seatOf, isKing, makePiece, jumpsFrom, stepsFrom
} from './engine.js';

const DEPTH = 6;
const WIN = 100000;
const rowOf = (i) => Math.floor(i / SIZE);
const colOf = (i) => i % SIZE;

const MAN = 100;
const KING = 175;
// Creeping up the board is worth something, but not enough to break formation.
const ADVANCE = 4;
// A piece on your own back row cannot be crowned against, and holds the edge.
const BACK_ROW = 6;
// The middle two files are where a piece keeps the most options.
const CENTRE = 3;

function movesFor(board, seat) {
  const jumps = [];
  const steps = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === EMPTY || seatOf(board[i]) !== seat) continue;
    jumps.push(...jumpsFrom(board, i));
    steps.push(...stepsFrom(board, i));
  }
  return jumps.length ? jumps : steps;
}

/**
 * Apply one hop. Returns the next board and whether the same seat continues,
 * mirroring the engine: a chain continues only if the hop was a jump, nothing
 * was crowned, and another jump exists from the landing square.
 */
function play(board, move, seat) {
  const next = board.slice();
  const piece = next[move.from];
  next[move.from] = EMPTY;
  next[move.to] = piece;
  if (move.captured !== -1) next[move.captured] = EMPTY;
  let crowned = false;
  if (!isKing(piece) && rowOf(move.to) === (seat === 0 ? 0 : SIZE - 1)) {
    next[move.to] = makePiece(seat, true);
    crowned = true;
  }
  const again = move.captured !== -1 && !crowned && jumpsFrom(next, move.to).length > 0;
  return { board: next, again };
}

function evaluate(board, seat) {
  const other = 1 - seat;
  let score = 0;
  let mine = 0;
  let theirs = 0;
  for (let i = 0; i < board.length; i++) {
    const piece = board[i];
    if (piece === EMPTY) continue;
    const owner = seatOf(piece);
    const king = isKing(piece);
    let value = king ? KING : MAN;
    if (!king) {
      // Distance travelled toward the crowning row.
      const advanced = owner === 0 ? SIZE - 1 - rowOf(i) : rowOf(i);
      value += advanced * ADVANCE;
      if (rowOf(i) === (owner === 0 ? SIZE - 1 : 0)) value += BACK_ROW;
    }
    const col = colOf(i);
    if (col >= 2 && col <= 5) value += CENTRE;
    if (owner === seat) {
      score += value;
      mine++;
    } else {
      score -= value;
      theirs++;
    }
  }
  if (mine === 0) return -WIN;
  if (theirs === 0) return WIN;
  return score;
}

function search(board, seat, toMove, depth, alpha, beta) {
  const moves = movesFor(board, toMove);
  // No move is a loss for the side to move, which is a real result, not a pass.
  if (!moves.length) return toMove === seat ? -WIN - depth : WIN + depth;
  if (depth === 0) return evaluate(board, seat);

  // Jumps first: they change material and prune hardest.
  moves.sort((a, b) => (b.captured !== -1) - (a.captured !== -1));
  const maximizing = toMove === seat;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    const { board: next, again } = play(board, move, toMove);
    // A continuing chain is still the same player's turn, and costs no depth —
    // otherwise the search would evaluate a position mid-jump, with a piece
    // apparently hanging that is about to be captured.
    const score = again
      ? search(next, seat, toMove, depth, alpha, beta)
      : search(next, seat, 1 - toMove, depth - 1, alpha, beta);
    if (maximizing) {
      if (score > best) best = score;
      if (score > alpha) alpha = score;
    } else {
      if (score < best) best = score;
      if (score < beta) beta = score;
    }
    if (alpha >= beta) break;
  }
  return best;
}

export function chooseMove(v, rng = Math.random) {
  const board = v.board;
  const seat = v.seat;
  // Mid-chain the engine allows only the jumping piece; respect that exactly.
  const moves = v.chainFrom !== null ? jumpsFrom(board, v.chainFrom) : movesFor(board, seat);
  if (!moves.length) return null;
  if (moves.length === 1) {
    const { from, to } = moves[0];
    return { type: 'move', from, to };
  }

  let best = null;
  let alpha = -Infinity;
  for (const move of moves) {
    const { board: next, again } = play(board, move, seat);
    const score = (again
      ? search(next, seat, seat, DEPTH, alpha, Infinity)
      : search(next, seat, 1 - seat, DEPTH - 1, alpha, Infinity))
      + (rng() - 0.5) * 0.01; // break exact ties differently game to game
    if (!best || score > best.score) best = { score, move };
    if (score > alpha) alpha = score;
  }
  return { type: 'move', from: best.move.from, to: best.move.to };
}
