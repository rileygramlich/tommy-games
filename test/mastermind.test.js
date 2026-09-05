import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/lib/games/mastermind/engine.js';
import * as bot from '../src/lib/games/mastermind/bot.js';
import { makeRng } from '../src/lib/games/rng.js';

const players = () => [{ name: 'A', isBot: true }, { name: 'B', isBot: true }];

test('marks count exact hits first, then colours that sit elsewhere', () => {
  assert.deepEqual(E.markGuess(['r', 'o', 'y', 'g'], ['r', 'o', 'y', 'g']), { exact: 4, colour: 0 });
  assert.deepEqual(E.markGuess(['r', 'o', 'y', 'g'], ['o', 'r', 'g', 'y']), { exact: 0, colour: 4 });
  assert.deepEqual(E.markGuess(['r', 'r', 'r', 'r'], ['g', 'g', 'g', 'g']), { exact: 0, colour: 0 });
  // A guess with more of a colour than the code holds only scores what is there.
  assert.deepEqual(E.markGuess(['r', 'o', 'r', 'g'], ['r', 'r', 'o', 'o']), { exact: 1, colour: 2 });
  assert.deepEqual(E.markGuess(['r', 'o', 'y', 'g'], ['r', 'r', 'r', 'r']), { exact: 1, colour: 0 });
});

test('the codebreaker never sees the code until the round is over', () => {
  const state = E.createGame({ players: players(), seed: 2 });
  const maker = state.codemaker;
  const breaker = E.breakerOf(state);
  assert.ok(E.applyMove(state, maker, { type: 'setCode', code: ['r', 'o', 'y', 'g'] }).ok);
  assert.equal(E.view(state, breaker).secret, null);
  assert.deepEqual(E.view(state, maker).secret, ['r', 'o', 'y', 'g'], 'the maker can see their own code');
  assert.equal(JSON.stringify(E.view(state, breaker)).includes('"y","g"'), false);
});

test('only the right seat may set the code or guess', () => {
  const state = E.createGame({ players: players(), seed: 2 });
  const maker = state.codemaker;
  const breaker = E.breakerOf(state);
  assert.equal(E.applyMove(state, breaker, { type: 'setCode', code: ['r', 'r', 'r', 'r'] }).ok, false);
  E.applyMove(state, maker, { type: 'setCode', code: ['r', 'o', 'y', 'g'] });
  const wrongSeat = E.applyMove(state, maker, { type: 'guess', code: ['r', 'o', 'y', 'g'] });
  assert.equal(wrongSeat.ok, false);
  assert.match(wrongSeat.error, /hiding the code/);
});

test('codes are checked against the options in play', () => {
  const state = E.createGame({ players: players(), options: { repeats: false }, seed: 2 });
  const maker = state.codemaker;
  assert.match(E.applyMove(state, maker, { type: 'setCode', code: ['r', 'o'] }).error, /exactly 4/);
  assert.match(E.applyMove(state, maker, { type: 'setCode', code: ['r', 'r', 'o', 'y'] }).error, /repeated/);
  assert.match(E.applyMove(state, maker, { type: 'setCode', code: ['r', 'o', 'y', 'w'] }).error, /not in play/);
  assert.ok(E.applyMove(state, maker, { type: 'setCode', code: ['r', 'o', 'y', 'g'] }).ok);
});

test('the codemaker scores a point a guess, and one more for a code that holds', () => {
  const cracked = E.createGame({ players: players(), seed: 2 });
  const maker = cracked.codemaker;
  E.applyMove(cracked, maker, { type: 'setCode', code: ['r', 'o', 'y', 'g'] });
  E.applyMove(cracked, E.breakerOf(cracked), { type: 'guess', code: ['r', 'r', 'r', 'r'] });
  E.applyMove(cracked, E.breakerOf(cracked), { type: 'guess', code: ['r', 'o', 'y', 'g'] });
  assert.equal(cracked.phase, 'roundEnd');
  assert.equal(cracked.scores[maker], 2, 'two guesses, two points');

  const held = E.createGame({ players: players(), options: { maxGuesses: 3 }, seed: 2 });
  const maker2 = held.codemaker;
  E.applyMove(held, maker2, { type: 'setCode', code: ['r', 'o', 'y', 'g'] });
  for (let i = 0; i < 3; i++) {
    E.applyMove(held, E.breakerOf(held), { type: 'guess', code: ['p', 'p', 'p', 'p'] });
  }
  assert.equal(held.phase, 'roundEnd');
  assert.equal(held.solved, false);
  assert.equal(held.scores[maker2], 4, 'three guesses plus one for holding');
});

test('roles swap every round', () => {
  const state = E.createGame({ players: players(), options: { rounds: 4 }, seed: 2 });
  const first = state.codemaker;
  E.applyMove(state, first, { type: 'setCode', code: ['r', 'o', 'y', 'g'] });
  E.applyMove(state, E.breakerOf(state), { type: 'guess', code: ['r', 'o', 'y', 'g'] });
  E.applyMove(state, first, { type: 'continue' });
  assert.equal(state.round, 2);
  assert.equal(state.codemaker, 1 - first);
});

test('the bot cracks a code in about four and a half guesses', () => {
  const rng = makeRng(99);
  const used = [];
  for (let t = 0; t < 25; t++) {
    const state = E.createGame({ players: players(), options: { rounds: 2 }, seed: t * 11 + 5 });
    let guard = 0;
    while (state.phase !== 'roundEnd') {
      assert.ok(++guard < 100, 'round stalled');
      const seat = E.activeSeats(state)[0];
      const result = E.applyMove(state, seat, bot.chooseMove(E.view(state, seat), rng));
      assert.ok(result.ok, result.error);
    }
    assert.equal(state.roundSummary.solved, true, 'the bot always gets there');
    used.push(state.roundSummary.guesses);
  }
  const average = used.reduce((a, b) => a + b, 0) / used.length;
  assert.ok(average < 5.5, `average of ${average} guesses`);
  assert.ok(Math.max(...used) <= 7);
});

test('bots play a whole match without an illegal move', () => {
  for (let g = 0; g < 6; g++) {
    const state = E.createGame({ players: players(), options: { rounds: 4 }, seed: g * 3 + 1 });
    const rng = makeRng(g * 7 + 2);
    let guard = 0;
    while (!E.isOver(state)) {
      assert.ok(++guard < 400, 'match stalled');
      const seat = E.activeSeats(state)[0];
      const result = E.applyMove(state, seat, bot.chooseMove(E.view(state, seat), rng));
      assert.ok(result.ok, result.error);
    }
    assert.equal(state.round, 4);
    assert.ok(state.winners.length >= 1);
  }
});
