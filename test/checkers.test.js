import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/lib/games/checkers/engine.js';
import * as bot from '../src/lib/games/checkers/bot.js';

const players = () => [{ name: 'Red', isBot: true }, { name: 'White', isBot: true }];
const at = (row, col) => row * 8 + col;
const move = (state, seat, from, to) => E.applyMove(state, seat, { type: 'move', from, to });

/** A board with only the listed pieces, for testing a rule in isolation. */
function position(pieces, turn = 0) {
  const state = E.createGame({ players: players(), seed: 1 });
  state.board.fill(E.EMPTY);
  for (const [index, seat, king] of pieces) state.board[index] = E.makePiece(seat, !!king);
  state.turn = turn;
  state.chainFrom = null;
  state.quiet = 0;
  return state;
}

test('the opening position is twelve a side on dark squares only', () => {
  const state = E.createGame({ players: players(), seed: 1 });
  assert.deepEqual(E.counts(state.board), [12, 12]);
  assert.equal(state.turn, 0);
  for (let i = 0; i < 64; i++) {
    if (!E.isPlayable(i)) assert.equal(state.board[i], E.EMPTY, 'light squares stay empty');
  }
  assert.equal(E.legalMoves(state, 0).length, 7, 'seven opening moves, as in real draughts');
});

test('men move diagonally forward only', () => {
  const state = position([[at(4, 3), 0]]);
  const tos = E.legalMoves(state, 0).map((m) => m.to).sort((a, b) => a - b);
  assert.deepEqual(tos, [at(3, 2), at(3, 4)], 'seat 0 moves up the board');

  const other = position([[at(3, 2), 1]], 1);
  const theirs = E.legalMoves(other, 1).map((m) => m.to).sort((a, b) => a - b);
  assert.deepEqual(theirs, [at(4, 1), at(4, 3)], 'seat 1 moves down the board');
});

test('captures are compulsory — quiet moves vanish when a jump exists', () => {
  const state = position([
    [at(5, 2), 0],           // can step, and can also jump
    [at(4, 3), 1],
    [at(5, 6), 0]            // this piece has only quiet moves
  ]);
  const moves = E.legalMoves(state, 0);
  assert.ok(moves.length > 0);
  assert.ok(moves.every((m) => m.captured !== -1), 'only jumps are offered');
  assert.deepEqual(moves.map((m) => m.to), [at(3, 4)]);
  // The quiet move is rejected with an explanation, not silently ignored.
  const refused = move(state, 0, at(5, 6), at(4, 5));
  assert.equal(refused.ok, false);
  assert.match(refused.error, /jump/i);
});

test('a jump removes the piece it hops', () => {
  const state = position([[at(5, 2), 0], [at(4, 3), 1]]);
  assert.ok(move(state, 0, at(5, 2), at(3, 4)).ok);
  assert.equal(state.board[at(4, 3)], E.EMPTY, 'the jumped piece is gone');
  assert.equal(E.seatOf(state.board[at(3, 4)]), 0);
  assert.deepEqual(E.counts(state.board), [1, 0]);
});

test('a multi-jump keeps the turn until the chain runs out', () => {
  const state = position([
    [at(5, 2), 0],
    [at(4, 3), 1],
    [at(2, 3), 1]
  ]);
  assert.ok(move(state, 0, at(5, 2), at(3, 4)).ok);
  assert.equal(state.turn, 0, 'still the same player');
  assert.equal(state.chainFrom, at(3, 4), 'and only the jumping piece may move');
  const during = E.legalMoves(state, 0);
  assert.ok(during.every((m) => m.from === at(3, 4)));
  assert.ok(move(state, 0, at(3, 4), at(1, 2)).ok);
  assert.deepEqual(E.counts(state.board), [1, 0]);
});

test('crowning ends the turn even mid-chain', () => {
  // Seat 0 jumps onto the back row; a further jump exists but the crown stops it.
  const state = position([
    [at(3, 2), 0],
    [at(2, 3), 1],
    [at(0, 3), 1]
  ]);
  assert.ok(move(state, 0, at(3, 2), at(1, 4)).ok);
  assert.ok(E.isKing(state.board[at(1, 4)]) === false, 'row 1 is not the crown row');
  const chained = position([
    [at(2, 1), 0],
    [at(1, 2), 1],
    [at(1, 6), 1],
    [at(3, 6), 1]
  ]);
  assert.ok(move(chained, 0, at(2, 1), at(0, 3)).ok);
  assert.ok(E.isKing(chained.board[at(0, 3)]), 'reaching the far row crowns');
  assert.equal(chained.chainFrom, null, 'the crown ends the chain');
  assert.equal(chained.turn, 1, 'and the turn passes');
});

test('kings move and jump in both directions', () => {
  const state = position([[at(4, 3), 0, true]]);
  const tos = E.legalMoves(state, 0).map((m) => m.to).sort((a, b) => a - b);
  assert.deepEqual(tos, [at(3, 2), at(3, 4), at(5, 2), at(5, 4)]);

  const backwards = position([[at(3, 2), 0, true], [at(4, 3), 1]]);
  const jump = E.legalMoves(backwards, 0).find((m) => m.captured !== -1);
  assert.ok(jump, 'a king can jump backwards');
  assert.equal(jump.to, at(5, 4));
});

test('running out of pieces loses', () => {
  const state = position([[at(5, 2), 0], [at(4, 3), 1]]);
  assert.ok(move(state, 0, at(5, 2), at(3, 4)).ok);
  assert.equal(state.phase, 'gameOver');
  assert.deepEqual(state.winners, [0]);
});

test('having no legal move loses, it is not a pass', () => {
  // Seat 1 has one man at a1. Its two forward diagonals are occupied, one jump
  // would land off the board, and seat 0's move takes away the other landing
  // square — so seat 1 is left with nothing, which is a loss in draughts.
  const state = position([
    [at(0, 1), 1],
    [at(1, 0), 0, true],
    [at(1, 2), 0, true],
    [at(3, 4), 0, true]
  ], 0);
  // legalMoves is turn-gated, so check seat 1's escape on its own turn.
  const escape = position([
    [at(0, 1), 1],
    [at(1, 0), 0, true],
    [at(1, 2), 0, true]
  ], 1);
  assert.ok(escape.phase === 'playing' && E.legalMoves(escape, 1).some((m) => m.captured !== -1),
    'with b6 free, seat 1 can still jump out');

  assert.ok(move(state, 0, at(3, 4), at(2, 3)).ok, 'seat 0 closes the landing square');
  assert.equal(state.turn, 1, 'it is seat 1 to move');
  assert.equal(state.phase, 'gameOver');
  assert.deepEqual(state.winners, [0]);
});

test('forty quiet moves is a draw', () => {
  const state = position([[at(4, 3), 0, true], [at(0, 1), 1, true]]);
  state.quiet = E.QUIET_LIMIT - 1;
  assert.ok(move(state, 0, at(4, 3), at(3, 2)).ok);
  assert.equal(state.phase, 'gameOver');
  assert.deepEqual(state.winners, [0, 1], 'a quiet game is drawn, not won');
});

test('moves are refused out of turn, off the board and after the game', () => {
  const state = E.createGame({ players: players(), seed: 1 });
  assert.equal(move(state, 1, at(2, 1), at(3, 0)).ok, false, 'not your turn');
  assert.equal(move(state, 0, at(5, 0), at(4, 0)).ok, false, 'straight ahead is not a move');
  assert.equal(E.applyMove(state, 0, { type: 'nonsense' }).ok, false);
  state.phase = 'gameOver';
  assert.equal(move(state, 0, at(5, 2), at(4, 3)).ok, false);
});

test('the view exposes what the player may pick up', () => {
  const state = position([[at(5, 2), 0], [at(4, 3), 1], [at(5, 6), 0]]);
  const v = E.view(state, 0);
  assert.deepEqual(v.movable, [at(5, 2)], 'only the jumping piece is movable');
  assert.equal(v.legal.length, 1);
  assert.deepEqual(v.players.map((p) => p.pieces), [2, 1]);
});

test('the bot takes a free capture', () => {
  const state = position([[at(5, 2), 0], [at(4, 3), 1], [at(7, 0), 0]]);
  const choice = bot.chooseMove(E.view(state, 0), () => 0.5);
  assert.deepEqual(
    { from: choice.from, to: choice.to },
    { from: at(5, 2), to: at(3, 4) }
  );
});

test('the bot only continues the jumping piece mid-chain', () => {
  const state = position([[at(5, 2), 0], [at(4, 3), 1], [at(2, 3), 1], [at(7, 0), 0]]);
  assert.ok(move(state, 0, at(5, 2), at(3, 4)).ok);
  assert.equal(state.chainFrom, at(3, 4));
  const choice = bot.chooseMove(E.view(state, 0), () => 0.5);
  assert.equal(choice.from, at(3, 4), 'the chain must be continued, not abandoned');
});

test('two bots play a full legal game to a finish', () => {
  const state = E.createGame({ players: players(), seed: 3 });
  let plies = 0;
  while (state.phase === 'playing' && plies < 400) {
    const seat = state.turn;
    const choice = bot.chooseMove(E.view(state, seat), () => 0.5);
    assert.ok(choice, 'the bot always finds a move while the game is live');
    const result = E.applyMove(state, seat, choice);
    assert.ok(result.ok, `bot played an illegal move: ${result.error}`);
    plies++;
  }
  assert.equal(state.phase, 'gameOver', 'the game reached a result');
  assert.ok(Array.isArray(state.winners) && state.winners.length >= 1);
});
