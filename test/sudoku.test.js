import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/lib/games/sudoku/engine.js';
import * as bot from '../src/lib/games/sudoku/bot.js';

const solo = [{ name: 'You', isBot: false }];
const firstEmpty = (state) => state.grid.findIndex((v) => !v);

test('every difficulty deals a grid with exactly one solution', () => {
  for (const [difficulty, level] of Object.entries(E.DIFFICULTIES)) {
    const state = E.createGame({ players: solo, options: { difficulty }, seed: 7 });
    const givens = state.puzzle.filter(Boolean).length;
    assert.equal(E.countSolutions(state.puzzle, 2), 1, `${difficulty} should be unique`);
    assert.ok(givens <= level.givens + 2, `${difficulty} gives ${givens}, wanted about ${level.givens}`);
    assert.equal(state.solution.filter(Boolean).length, 81, 'the solution is a full grid');
  }
});

test('harder grids start with fewer numbers than easier ones', () => {
  const count = (difficulty) =>
    E.createGame({ players: solo, options: { difficulty }, seed: 3 }).puzzle.filter(Boolean).length;
  assert.ok(count('easy') > count('medium'), 'easy should show more than medium');
  assert.ok(count('medium') > count('hard'), 'medium should show more than hard');
});

test('the numbers dealt with the grid cannot be changed', () => {
  const state = E.createGame({ players: solo, seed: 11 });
  const given = state.puzzle.findIndex(Boolean);
  assert.equal(E.applyMove(state, 0, { type: 'place', index: given, value: 5 }).ok, false);
  assert.equal(E.applyMove(state, 0, { type: 'erase', index: given }).ok, false);
  assert.equal(state.grid[given], state.puzzle[given]);
});

test('a wrong number is allowed, flagged, and costs nothing', () => {
  const state = E.createGame({ players: solo, seed: 5 });
  const cell = firstEmpty(state);
  const wrong = state.solution[cell] === 9 ? 8 : 9;

  assert.equal(E.applyMove(state, 0, { type: 'place', index: cell, value: wrong }).ok, true);
  assert.equal(state.phase, 'playing', 'there are no lives to lose');
  assert.equal(E.isOver(state), false);

  // It only shows as wrong if it clashes with something already on the grid.
  const v = E.view(state, 0);
  assert.equal(v.cells[cell].value, wrong);
  assert.deepEqual(E.activeSeats(state), [0], 'the grid keeps waiting');

  assert.equal(E.applyMove(state, 0, { type: 'place', index: cell, value: state.solution[cell] }).ok, true);
  assert.equal(state.grid[cell], state.solution[cell]);
});

test('a number that clashes with its row, column or box is marked', () => {
  const state = E.createGame({ players: solo, seed: 9 });
  const cell = firstEmpty(state);
  const row = Math.floor(cell / 9);
  const neighbour = [...Array(9).keys()].map((c) => row * 9 + c).find((i) => i !== cell && state.grid[i]);
  E.applyMove(state, 0, { type: 'place', index: cell, value: state.grid[neighbour] });

  const v = E.view(state, 0);
  assert.equal(v.cells[cell].conflict, true);
  assert.equal(v.cells[neighbour].conflict, true);
});

test('pencil marks go in and come out, and a real number clears them', () => {
  const state = E.createGame({ players: solo, seed: 13 });
  const cell = firstEmpty(state);

  E.applyMove(state, 0, { type: 'note', index: cell, value: 4 });
  E.applyMove(state, 0, { type: 'note', index: cell, value: 7 });
  assert.deepEqual(state.notes[cell], [4, 7]);

  E.applyMove(state, 0, { type: 'note', index: cell, value: 4 });
  assert.deepEqual(state.notes[cell], [7], 'noting the same number again rubs it out');

  E.applyMove(state, 0, { type: 'place', index: cell, value: state.solution[cell] });
  assert.deepEqual(state.notes[cell], [], 'writing the number in clears the pencil marks');
  assert.equal(E.applyMove(state, 0, { type: 'note', index: cell, value: 2 }).ok, false);
});

test('erasing empties a square you filled in', () => {
  const state = E.createGame({ players: solo, seed: 21 });
  const cell = firstEmpty(state);
  E.applyMove(state, 0, { type: 'place', index: cell, value: state.solution[cell] });
  assert.equal(E.applyMove(state, 0, { type: 'erase', index: cell }).ok, true);
  assert.equal(state.grid[cell], 0);
  assert.equal(E.applyMove(state, 0, { type: 'erase', index: cell }).ok, false, 'nothing left to erase');
});

test('filling every square correctly finishes the grid', () => {
  const state = E.createGame({ players: solo, options: { difficulty: 'easy' }, seed: 31 });
  for (let i = 0; i < 81; i++) {
    if (state.grid[i]) continue;
    const result = E.applyMove(state, 0, { type: 'place', index: i, value: state.solution[i] });
    assert.ok(result.ok, result.error);
  }
  assert.equal(state.phase, 'gameOver');
  assert.equal(E.isOver(state), true);
  assert.deepEqual(state.winners, [0]);
  assert.deepEqual(E.activeSeats(state), []);
  assert.equal(E.view(state, 0).empty, 0);
});

test('a full grid of wrong numbers does not count as solved', () => {
  const state = E.createGame({ players: solo, options: { difficulty: 'easy' }, seed: 41 });
  const cell = firstEmpty(state);
  const wrong = state.solution[cell] === 1 ? 2 : 1;
  for (let i = 0; i < 81; i++) {
    if (state.grid[i]) continue;
    E.applyMove(state, 0, { type: 'place', index: i, value: i === cell ? wrong : state.solution[i] });
  }
  assert.equal(state.phase, 'playing', 'one wrong square keeps the grid open');
  E.applyMove(state, 0, { type: 'place', index: cell, value: state.solution[cell] });
  assert.equal(state.phase, 'gameOver');
});

test('the bot solves a grid at every difficulty', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const state = E.createGame({ players: [{ name: 'Bot', isBot: true }], options: { difficulty }, seed: 17 });
    let guard = 0;
    while (!E.isOver(state)) {
      assert.ok(++guard < 400, `${difficulty} stalled`);
      const move = bot.chooseMove(E.view(state, 0), Math.random);
      const result = E.applyMove(state, 0, move);
      assert.ok(result.ok, result.error);
    }
    assert.deepEqual(state.grid, state.solution, `${difficulty} should end matching the solution`);
  }
});
