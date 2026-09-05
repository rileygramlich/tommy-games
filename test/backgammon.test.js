import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/lib/games/backgammon/engine.js';
import * as bot from '../src/lib/games/backgammon/bot.js';
import { makeRng } from '../src/lib/games/rng.js';

const players = () => [{ name: 'A', isBot: true }, { name: 'B', isBot: true }];
const empty = () => new Array(24).fill(0);

test('the opening position is the standard one, 167 pips each', () => {
  const state = E.createGame({ players: players(), seed: 2 });
  assert.equal(E.pipCount(state.points, state.bar, 0), 167);
  assert.equal(E.pipCount(state.points, state.bar, 1), 167);
  const mine = state.points.filter((v) => v > 0).reduce((a, b) => a + b, 0);
  assert.equal(mine, 15);
});

test('you may not land on a point held by two of the other side', () => {
  const points = empty();
  points[10] = 1;
  points[7] = -2;
  const moves = E.movesForDie(points, [0, 0], 0, 3);
  assert.equal(moves.some((m) => m.to === 7), false);
  assert.ok(E.movesForDie(points, [0, 0], 0, 4).some((m) => m.to === 6), 'an open point is fine');
});

test('a lone checker gets hit and goes to the bar', () => {
  const points = empty();
  points[10] = 1;
  points[7] = -1;
  const bar = [0, 0], off = [0, 0];
  E.applySingle(points, bar, off, 0, { from: 10, to: 7, die: 3 });
  assert.equal(points[7], 1);
  assert.equal(bar[1], 1);
});

test('a checker on the bar has to come in before anything else moves', () => {
  const points = empty();
  points[10] = 1;
  points[20] = 1;
  const moves = E.movesForDie(points, [1, 0], 0, 4);
  assert.deepEqual(moves.map((m) => m.from), ['bar']);
  assert.equal(moves[0].to, 20, 'seat 0 enters on the twenty-first point with a four');
});

test('bearing off needs everyone home, and a big die only takes the back checker', () => {
  const points = empty();
  points[3] = 2;
  points[1] = 1;
  assert.equal(E.allHome(points, [0, 0], 0), true);
  const withFive = E.movesForDie(points, [0, 0], 0, 5);
  assert.deepEqual(withFive.filter((m) => m.to === 'off').map((m) => m.from), [3], 'only from the furthest point back');
  const withFour = E.movesForDie(points, [0, 0], 0, 4);
  assert.deepEqual(withFour.filter((m) => m.to === 'off').map((m) => m.from), [3]);
  points[20] = 1;
  assert.equal(E.allHome(points, [0, 0], 0), false, 'a straggler stops the bear-off');
  assert.equal(E.movesForDie(points, [0, 0], 0, 5).some((m) => m.to === 'off'), false);
});

test('when only one die can be played, it has to be the bigger one', () => {
  const state = E.createGame({ players: players(), seed: 2 });
  state.points = empty();
  // One checker, and the only point it could reach with both dice is blocked:
  // 10/8 then 8/3 is shut, 10/5 then 5/3 is shut, so exactly one die can play.
  state.points[10] = 1;
  state.points[3] = -2;
  state.turn = 0;
  state.phase = 'move';
  state.dice = [2, 5];
  state.diceLeft = [2, 5];
  const legal = E.legalMoves(state, 0).filter((m) => m.type === 'move');
  assert.ok(legal.length > 0);
  assert.ok(legal.every((m) => m.die === 5), 'the five is forced');
});

test('bearing off the fifteenth checker ends the game, gammons counted', () => {
  const state = E.createGame({ players: players(), options: { target: 5 }, seed: 2 });
  state.points = empty();
  state.points[0] = 1;
  state.off = [14, 0];
  state.points[23] = -15;   // the loser has borne nothing off and sits in seat 0's home
  state.turn = 0;
  state.phase = 'move';
  state.dice = [1, 1];
  state.diceLeft = [1, 1, 1, 1];
  assert.ok(E.applyMove(state, 0, { type: 'move', from: 0, to: 'off', die: 1 }).ok);
  assert.equal(state.phase, 'gameEnd');
  assert.equal(state.lastResult.points, 2, 'a gammon is worth two');
  assert.equal(state.scores[0], 2);
});

test('bots play matches out without losing or inventing a checker', () => {
  for (let g = 0; g < 5; g++) {
    const state = E.createGame({ players: players(), options: { target: 3 }, seed: g * 5 + 1 });
    const rng = makeRng(g * 13 + 2);
    let guard = 0;
    while (!E.isOver(state)) {
      assert.ok(++guard < 30000, 'match stalled');
      const seat = E.activeSeats(state)[0];
      const result = E.applyMove(state, seat, bot.chooseMove(E.view(state, seat), rng));
      assert.ok(result.ok, result.error);
      const dark = state.points.filter((v) => v > 0).reduce((a, b) => a + b, 0) + state.bar[0] + state.off[0];
      const light = -state.points.filter((v) => v < 0).reduce((a, b) => a + b, 0) + state.bar[1] + state.off[1];
      assert.equal(dark, 15);
      assert.equal(light, 15);
    }
    assert.ok(Math.max(...state.scores) >= 3);
  }
});
