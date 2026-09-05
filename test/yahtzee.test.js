import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/lib/games/yahtzee/engine.js';
import * as bot from '../src/lib/games/yahtzee/bot.js';
import { makeRng } from '../src/lib/games/rng.js';

const players = (n = 2) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isBot: true }));

test('every box scores by the book', () => {
  assert.equal(E.scoreFor('fours', [4, 4, 2, 4, 1]), 12);
  assert.equal(E.scoreFor('threeKind', [5, 5, 5, 2, 1]), 18);
  assert.equal(E.scoreFor('threeKind', [5, 5, 2, 2, 1]), 0);
  assert.equal(E.scoreFor('fourKind', [6, 6, 6, 6, 3]), 27);
  assert.equal(E.scoreFor('fullHouse', [2, 2, 3, 3, 3]), 25);
  assert.equal(E.scoreFor('fullHouse', [2, 2, 2, 3, 4]), 0);
  assert.equal(E.scoreFor('smallStraight', [1, 2, 3, 4, 4]), 30);
  assert.equal(E.scoreFor('smallStraight', [1, 2, 3, 5, 6]), 0);
  assert.equal(E.scoreFor('largeStraight', [2, 3, 4, 5, 6]), 40);
  assert.equal(E.scoreFor('yahtzee', [3, 3, 3, 3, 3]), 50);
  assert.equal(E.scoreFor('chance', [1, 2, 3, 4, 5]), 15);
});

test('the upper bonus lands at sixty-three', () => {
  const card = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 };
  assert.equal(E.upperTotal(card), 63);
  assert.equal(E.upperBonus(card), 35);
  assert.equal(E.upperBonus({ ...card, sixes: 12 }), 0);
});

test('a turn is roll, hold, then write it down', () => {
  const state = E.createGame({ players: players(), seed: 3 });
  assert.equal(E.applyMove(state, 0, { type: 'score', category: 'chance' }).ok, false, 'must roll first');
  assert.ok(E.applyMove(state, 0, { type: 'roll' }).ok);
  assert.equal(state.rollsLeft, 2);
  assert.ok(E.applyMove(state, 0, { type: 'hold', index: 0 }).ok);
  assert.equal(state.held[0], true);
  const kept = state.dice[0];
  assert.ok(E.applyMove(state, 0, { type: 'roll' }).ok);
  assert.equal(state.dice[0], kept, 'a held die does not change');
  assert.ok(E.applyMove(state, 0, { type: 'score', category: 'chance' }).ok);
  assert.equal(state.turn, 1);
  assert.equal(state.rollsLeft, 3, 'the next player starts fresh');
});

test('a box can only be used once', () => {
  const state = E.createGame({ players: players(1), seed: 5 });
  E.applyMove(state, 0, { type: 'roll' });
  E.applyMove(state, 0, { type: 'score', category: 'chance' });
  E.applyMove(state, 0, { type: 'roll' });
  const again = E.applyMove(state, 0, { type: 'score', category: 'chance' });
  assert.equal(again.ok, false);
  assert.match(again.error, /already/);
});

test('a second five-of-a-kind pays a hundred and plays as a joker', () => {
  const state = E.createGame({ players: players(1), seed: 9 });
  state.cards[0].yahtzee = 50;
  state.dice = [4, 4, 4, 4, 4];
  state.rollsLeft = 0;
  assert.equal(E.isJoker(state, 0, state.dice), true);
  assert.ok(E.applyMove(state, 0, { type: 'score', category: 'largeStraight' }).ok);
  assert.equal(state.cards[0].largeStraight, 40, 'the joker fills a straight');
  assert.equal(state.yahtzeeBonus[0], 100);
});

test('bots fill all thirteen boxes and score like a person would', () => {
  const totals = [];
  for (let g = 0; g < 3; g++) {
    const state = E.createGame({ players: players(2), seed: g * 7 + 1 });
    const rng = makeRng(g + 3);
    let guard = 0;
    while (!E.isOver(state)) {
      assert.ok(++guard < 3000, 'game stalled');
      const seat = E.activeSeats(state)[0];
      assert.ok(E.applyMove(state, seat, bot.chooseMove(E.view(state, seat), rng)).ok);
    }
    for (const card of state.cards) {
      assert.equal(Object.values(card).filter((v) => v === null).length, 0, 'every box filled');
    }
    totals.push(...E.view(state, 0).players.map((p) => p.total));
  }
  const average = totals.reduce((a, b) => a + b, 0) / totals.length;
  assert.ok(average > 140 && average < 320, `a plausible average, got ${average}`);
});
