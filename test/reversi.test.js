import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/lib/games/reversi/engine.js';
import * as bot from '../src/lib/games/reversi/bot.js';

const players = () => [{ name: 'Dark', isBot: true }, { name: 'Light', isBot: true }];
const at = (state, row, col) => state.board[row * 8 + col];

test('the board opens with four discs and four legal moves', () => {
  const state = E.createGame({ players: players(), seed: 1 });
  assert.deepEqual(E.counts(state.board), [2, 2]);
  assert.equal(state.turn, 0, 'dark moves first');
  assert.deepEqual(E.legalMoves(state, 0).map((m) => m.index).sort((a, b) => a - b), [19, 26, 37, 44]);
});

test('placing a disc flips the line it brackets', () => {
  const state = E.createGame({ players: players(), seed: 1 });
  assert.ok(E.applyMove(state, 0, { type: 'place', index: 19 }).ok); // d3
  assert.equal(at(state, 2, 3), 0);
  assert.equal(at(state, 3, 3), 0, 'the light disc between two dark ones flipped');
  assert.deepEqual(E.counts(state.board), [4, 1]);
});

test('a square that flips nothing is not a move', () => {
  const state = E.createGame({ players: players(), seed: 1 });
  const result = E.applyMove(state, 0, { type: 'place', index: 0 });
  assert.equal(result.ok, false);
  assert.match(result.error, /flip/);
});

test('lines do not wrap around the edge of the board', () => {
  const state = E.createGame({ players: players(), seed: 1 });
  state.board = new Array(64).fill(-1);
  state.board[8] = 0;   // a1-side
  state.board[7] = 1;   // far right of row 0
  state.board[6] = 0;
  // Dark at index 6 and 8 must not bracket index 7 across the row break.
  assert.equal(E.flipsFor(state.board, 15, 0).length, 0);
});

test('a player with no move is skipped, and the game ends when neither can move', () => {
  const state = E.createGame({ players: players(), seed: 1 });
  state.board = new Array(64).fill(-1);
  state.board[0] = 0; state.board[1] = 1; state.board[3] = 0;
  state.turn = 0;
  assert.ok(E.applyMove(state, 0, { type: 'place', index: 2 }).ok);
  assert.equal(state.phase, 'gameOver');
  assert.deepEqual(state.winners, [0]);
});

test('bots play a full board out, legally, every time', () => {
  for (let g = 0; g < 6; g++) {
    const state = E.createGame({ players: players(), seed: g + 1 });
    let guard = 0;
    while (!E.isOver(state)) {
      assert.ok(++guard < 200, 'game stalled');
      const seat = E.activeSeats(state)[0];
      const move = bot.chooseMove(E.view(state, seat));
      assert.ok(E.applyMove(state, seat, move).ok);
    }
    const [dark, light] = E.counts(state.board);
    assert.ok(dark + light >= 40, 'the board filled up');
    assert.ok(state.winners.length >= 1);
  }
});

test('a seat view carries the legal squares for that seat only', () => {
  const state = E.createGame({ players: players(), seed: 4 });
  assert.equal(E.view(state, 0).legal.length, 4);
  assert.equal(E.view(state, 1).legal.length, 0, 'not light\'s turn');
});
