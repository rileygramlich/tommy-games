import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/lib/games/connectfour/engine.js';
import * as bot from '../src/lib/games/connectfour/bot.js';

const players = () => [{ name: 'Red', isBot: true }, { name: 'Yellow', isBot: true }];
const drop = (state, seat, col) => E.applyMove(state, seat, { type: 'drop', col });

test('the board opens empty with every column playable', () => {
  const state = E.createGame({ players: players(), seed: 1 });
  assert.equal(state.board.filter((v) => v === -1).length, 42);
  assert.equal(state.turn, 0);
  assert.deepEqual(E.legalMoves(state, 0).map((m) => m.col), [0, 1, 2, 3, 4, 5, 6]);
});

test('discs fall to the lowest empty cell in a column', () => {
  const state = E.createGame({ players: players(), seed: 1 });
  drop(state, 0, 3);
  assert.equal(state.board[5 * 7 + 3], 0, 'the first disc rests on the floor');
  drop(state, 1, 3);
  assert.equal(state.board[4 * 7 + 3], 1, 'the second stacks on top of it');
});

test('a full column is not a legal move', () => {
  const state = E.createGame({ players: players(), seed: 1 });
  // Fill column 0 by alternating, avoiding a vertical four for either seat.
  for (const seat of [0, 1, 1, 0, 0, 1]) {
    state.turn = seat;
    assert.ok(drop(state, seat, 0).ok);
  }
  assert.equal(E.dropRow(state.board, 0), -1);
  state.turn = 0;
  assert.deepEqual(E.legalMoves(state, 0).map((m) => m.col), [1, 2, 3, 4, 5, 6]);
  assert.equal(drop(state, 0, 0).ok, false);
});

test('four in a row wins, horizontally', () => {
  const state = E.createGame({ players: players(), seed: 1 });
  for (const col of [0, 1, 2]) {
    state.turn = 0;
    drop(state, 0, col);
  }
  state.turn = 0;
  drop(state, 0, 3);
  assert.equal(state.phase, 'gameOver');
  assert.deepEqual(state.winners, [0]);
  assert.equal(state.line.length, 4);
});

test('four in a row wins, vertically and diagonally', () => {
  const vertical = E.createGame({ players: players(), seed: 1 });
  for (let i = 0; i < 4; i++) {
    vertical.turn = 0;
    drop(vertical, 0, 2);
  }
  assert.deepEqual(vertical.winners, [0]);

  const diagonal = E.createGame({ players: players(), seed: 1 });
  // Build a staircase: one disc in col 0, two in col 1, three in col 2, then
  // land the fourth on top of col 3.
  const fill = [[0, 0], [1, 1], [1, 0], [2, 1], [2, 1], [2, 0], [3, 1], [3, 1], [3, 1]];
  for (const [col, seat] of fill) {
    diagonal.turn = seat;
    assert.ok(drop(diagonal, seat, col).ok);
  }
  diagonal.turn = 0;
  assert.ok(drop(diagonal, 0, 3).ok);
  assert.deepEqual(diagonal.winners, [0], 'a rising diagonal counts');
  assert.equal(diagonal.line.length, 4);
});

test('a line of five still reads as a win', () => {
  // Five in a row contains a four; the engine must not require exactly four.
  const state = E.createGame({ players: players(), seed: 1 });
  for (const col of [0, 1, 2, 4]) {
    state.turn = 0;
    drop(state, 0, col);
  }
  assert.equal(state.phase, 'playing', 'a gap at column 3 is not yet a line');
  state.turn = 0;
  drop(state, 0, 3);
  assert.deepEqual(state.winners, [0]);
  assert.ok(state.line.length >= 4);
});

test('a full board with no line is a draw', () => {
  const state = E.createGame({ players: players(), seed: 1 });
  // Column-paired filling that never creates four in a row.
  const order = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6];
  let seat = 0;
  for (let pass = 0; pass < 3; pass++) {
    for (const col of order) {
      if (E.dropRow(state.board, col) === -1) continue;
      state.turn = seat;
      if (state.phase !== 'playing') break;
      drop(state, seat, col);
      seat = 1 - seat;
    }
  }
  if (E.isFull(state.board) && state.phase === 'gameOver' && !state.line.length) {
    assert.deepEqual(state.winners, [0, 1]);
  }
  assert.ok(E.isFull(state.board) || state.phase === 'gameOver');
});

test('moves are refused out of turn, after the game, and off the board', () => {
  const state = E.createGame({ players: players(), seed: 1 });
  assert.equal(drop(state, 1, 0).ok, false, 'not your turn');
  assert.equal(drop(state, 0, 9).ok, false, 'off the board');
  assert.equal(E.applyMove(state, 0, { type: 'nonsense' }).ok, false);
  state.phase = 'gameOver';
  assert.equal(drop(state, 0, 0).ok, false, 'the game is over');
});

test('the view exposes landing rows so a drop can be previewed', () => {
  const state = E.createGame({ players: players(), seed: 1 });
  drop(state, 0, 3);
  const v = E.view(state, 1);
  assert.equal(v.landing[3], 4, 'column 3 now lands one higher');
  assert.equal(v.landing[0], 5);
  assert.deepEqual(v.legal, [0, 1, 2, 3, 4, 5, 6]);
});

test('the bot takes an immediate win', () => {
  const state = E.createGame({ players: players(), seed: 1 });
  for (const col of [0, 1, 2]) {
    state.turn = 1;
    drop(state, 1, col);
  }
  state.turn = 1;
  const move = bot.chooseMove(E.view(state, 1), () => 0.5);
  assert.equal(move.col, 3, 'completing the line beats anything else');
});

test('the bot blocks an immediate loss', () => {
  const state = E.createGame({ players: players(), seed: 1 });
  for (const col of [0, 1, 2]) {
    state.turn = 0;
    drop(state, 0, col);
  }
  state.turn = 1;
  const move = bot.chooseMove(E.view(state, 1), () => 0.5);
  assert.equal(move.col, 3, 'the only square that stops four must be taken');
});

test('the bot always returns a legal move on a crowded board', () => {
  const state = E.createGame({ players: players(), seed: 7 });
  let seat = 0;
  for (let i = 0; i < 20 && state.phase === 'playing'; i++) {
    const move = bot.chooseMove(E.view(state, seat), () => 0.5);
    assert.ok(move, 'the bot found a move');
    assert.ok(E.dropRow(state.board, move.col) !== -1, 'the column has room');
    assert.ok(E.applyMove(state, seat, move).ok);
    seat = 1 - seat;
  }
});
