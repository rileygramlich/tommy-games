import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/lib/games/sequence/engine.js';
import * as bot from '../src/lib/games/sequence/bot.js';
import { BOARD, CORNERS, squaresFor, isWildJack, isRemoveJack } from '../src/lib/games/sequence/board.js';
import { makeCard } from '../src/lib/games/cards.js';
import { makeRng } from '../src/lib/games/rng.js';

const players = (n = 2) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isBot: true }));

test('the board prints every non-jack card twice and leaves the corners free', () => {
  const seen = new Map();
  BOARD.forEach((cell, i) => {
    if (!cell) { assert.ok(CORNERS.includes(i), `square ${i} is empty but not a corner`); return; }
    assert.notEqual(cell.rank, 11, 'jacks are wild, never printed');
    const key = `${cell.suit}${cell.rank}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  });
  assert.equal(seen.size, 48);
  assert.ok([...seen.values()].every((n) => n === 2));
});

test('two-eyed jacks are wild and one-eyed jacks are not', () => {
  assert.ok(isWildJack(makeCard('D', 11)) && isWildJack(makeCard('C', 11)));
  assert.ok(isRemoveJack(makeCard('H', 11)) && isRemoveJack(makeCard('S', 11)));
  assert.equal(isWildJack(makeCard('H', 11)), false);
});

test('a card only covers its own squares', () => {
  const state = E.createGame({ players: players(), seed: 3 });
  const card = state.hands[0].find((c) => c.rank !== 11);
  state.turn = 0;
  const wrong = BOARD.findIndex((cell, i) => cell && state.chips[i] == null
    && !(cell.suit === card.suit && cell.rank === card.rank));
  assert.equal(E.applyMove(state, 0, { type: 'play', cardId: card.id, index: wrong }).ok, false);
  assert.ok(E.applyMove(state, 0, { type: 'play', cardId: card.id, index: squaresFor(card)[0] }).ok);
});

test('the corners are free spaces, not squares to cover', () => {
  const state = E.createGame({ players: players(), seed: 3 });
  state.turn = 0;
  const jack = makeCard('D', 11);
  state.hands[0].push(jack);
  const result = E.applyMove(state, 0, { type: 'play', cardId: jack.id, index: CORNERS[0] });
  assert.equal(result.ok, false);
  assert.match(result.error, /free/);
});

test('five in a row is a sequence, and corners count towards it', () => {
  const state = E.createGame({ players: players(), seed: 3 });
  state.turn = 0;
  // Row 0 runs corner, then four squares — filling those four makes five.
  for (const cell of [1, 2, 3]) state.chips[cell] = 0;
  const target = BOARD[4];
  const card = makeCard(target.suit, target.rank);
  state.hands[0].push(card);
  assert.ok(E.applyMove(state, 0, { type: 'play', cardId: card.id, index: 4 }).ok);
  assert.equal(state.sequences.length, 1, 'the free corner completed the line');
  assert.ok(state.sequences[0].cells.includes(CORNERS[0]));
});

test('a one-eyed jack lifts a loose chip but not one in a sequence', () => {
  const state = E.createGame({ players: players(), seed: 3 });
  state.turn = 0;
  state.chips[45] = 1;
  const jack = makeCard('H', 11);
  state.hands[0].push(jack);
  assert.equal(E.applyMove(state, 0, { type: 'remove', cardId: jack.id, index: 45 }).ok, true);
  assert.equal(state.chips[45], null);

  const state2 = E.createGame({ players: players(), seed: 3 });
  state2.turn = 0;
  state2.chips[45] = 1;
  state2.sequences.push({ seat: 1, cells: [45, 46, 47, 48, 49] });
  const jack2 = makeCard('S', 11);
  state2.hands[0].push(jack2);
  const guarded = E.applyMove(state2, 0, { type: 'remove', cardId: jack2.id, index: 45 });
  assert.equal(guarded.ok, false);
  assert.match(guarded.error, /finished sequence/);
});

test('a dead card can be swapped once a turn, and the turn carries on', () => {
  const state = E.createGame({ players: players(), seed: 5 });
  state.turn = 0;
  const card = state.hands[0].find((c) => c.rank !== 11);
  for (const i of squaresFor(card)) state.chips[i] = 1;
  assert.equal(E.isDead(state, card), true);
  assert.ok(E.applyMove(state, 0, { type: 'exchange', cardId: card.id }).ok);
  assert.equal(state.turn, 0, 'swapping is free');
  const another = state.hands[0].find((c) => E.isDead(state, c));
  if (another) {
    assert.equal(E.applyMove(state, 0, { type: 'exchange', cardId: another.id }).ok, false, 'only one a turn');
  }
});

test('bots finish games, and a stuck board is a draw rather than a hang', () => {
  let draws = 0;
  for (let g = 0; g < 14; g++) {
    const state = E.createGame({ players: players(2 + (g % 2)), seed: g * 17 + 3 });
    const rng = makeRng(g * 29 + 11);
    let guard = 0;
    while (!E.isOver(state)) {
      assert.ok(++guard < 3000, 'game stalled');
      const seat = E.activeSeats(state)[0];
      const result = E.applyMove(state, seat, bot.chooseMove(E.view(state, seat), rng));
      assert.ok(result.ok, result.error);
    }
    if (!state.winners.length) draws += 1;
    else assert.ok(state.sequences.filter((s) => s.seat === state.winners[0]).length >= state.options.needed);
  }
  assert.ok(draws <= 3, 'draws should be the exception');
});
