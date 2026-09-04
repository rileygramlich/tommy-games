import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../src/lib/games/quiddler/engine.js';
import * as bot from '../src/lib/games/quiddler/bot.js';
import { buildDeck, LETTERS, handSize } from '../src/lib/games/quiddler/deck.js';
import { createDictionary } from '../src/lib/games/quiddler/dictionary.js';
import { bestLayout } from '../src/lib/games/quiddler/solver.js';
import { makeRng } from '../src/lib/games/rng.js';

const dict = createDictionary(readFileSync(new URL('../public/data/quiddler-words.txt', import.meta.url), 'utf8'));
E.setDictionary(dict);

const players = (n) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isBot: true }));
const hand = (...specs) => specs.map(([letters, value], i) => ({ id: `${letters}#${i}`, letters, value }));

test('the deck is 118 cards and the two-letter faces are all there', () => {
  const deck = buildDeck();
  assert.equal(deck.length, 118);
  assert.equal(LETTERS.reduce((sum, l) => sum + l.count, 0), 118);
  for (const pair of ['cl', 'er', 'in', 'qu', 'th']) {
    assert.equal(deck.filter((c) => c.letters === pair).length, 2, pair);
  }
  assert.equal(new Set(deck.map((c) => c.id)).size, 118);
});

test('rounds one through eight deal three to ten cards', () => {
  assert.equal(handSize(1), 3);
  assert.equal(handSize(8), 10);
});

test('the dictionary knows real words and rejects abbreviations', () => {
  for (const word of ['quiz', 'the', 'qi', 'za', 'xu', 'clique', 'jazzy']) {
    assert.ok(dict.has(word), `${word} should be playable`);
  }
  for (const junk of ['mph', 'tsp', 'aaron', 'ftp', 'zz', 'a']) {
    assert.equal(dict.has(junk), false, `${junk} should not be playable`);
  }
});

test('the solver spells across two-letter cards', () => {
  const cards = hand(['cl', 10], ['i', 2], ['qu', 9], ['e', 2]);
  const best = bestLayout(cards, dict);
  assert.equal(best.canGoOut, true);
  assert.deepEqual(best.words.map((w) => w.word), ['clique']);
  assert.equal(best.score, 23, 'every card used, so the score is the full hand value');
});

test('the solver leaves the dead weight behind when it cannot use it', () => {
  const cards = hand(['j', 13], ['o', 2], ['b', 8], ['z', 14]);
  const best = bestLayout(cards, dict);
  assert.deepEqual(best.words.map((w) => w.word), ['job']);
  assert.deepEqual(best.leftover.map((id) => id.split('#')[0]), ['z']);
  assert.equal(best.score, 23 - 14);
  assert.equal(best.canGoOut, false);
});

test('the solver takes the higher-scoring split, not the longer word', () => {
  // "cat" (13) leaves the z behind for -14; "za" (16) leaves c and t for -11.
  const cards = hand(['c', 8], ['a', 2], ['t', 3], ['z', 14]);
  const best = bestLayout(cards, dict);
  assert.deepEqual(best.words.map((w) => w.word), ['za']);
  assert.equal(best.score, 16 - 11);
});

test('layouts must be real words, of two letters or more, using each card once', () => {
  const cards = hand(['c', 8], ['a', 2], ['t', 3]);
  const ids = cards.map((c) => c.id);
  assert.equal(E.validateLayout(cards, [ids], true).ok, true);
  assert.equal(E.validateLayout(cards, [[ids[0], ids[0], ids[1]]], false).ok, false, 'no reusing a card');
  assert.equal(E.validateLayout(cards, [[ids[0]]], false).ok, false, 'single letters are too short');
  assert.equal(E.validateLayout(cards, [[ids[2], ids[0], ids[1]]], true).ok, false, '"tca" is not a word');
  assert.equal(E.validateLayout(cards, [[ids[0], ids[1]]], true).ok, false, 'going out needs every card');
});

test('a turn is draw then discard, in that order', () => {
  const state = E.createGame({ players: players(2), seed: 4 });
  const seat = state.turn;
  assert.equal(state.phase, 'draw');
  assert.equal(E.applyMove(state, seat, { type: 'discard', cardId: state.hands[seat][0].id }).ok, false);
  assert.equal(E.applyMove(state, (seat + 1) % 2, { type: 'draw', from: 'deck' }).ok, false, 'wrong seat');
  assert.equal(E.applyMove(state, seat, { type: 'draw', from: 'deck' }).ok, true);
  assert.equal(state.hands[seat].length, handSize(1) + 1);
  assert.equal(E.applyMove(state, seat, { type: 'discard', cardId: state.hands[seat][0].id }).ok, true);
  assert.equal(state.turn, (seat + 1) % 2);
});

test('going out gives everyone else exactly one more turn', () => {
  const state = E.createGame({ players: players(3), seed: 8 });
  // Force a hand that spells out completely.
  const seat = state.turn;
  state.hands[seat] = hand(['c', 8], ['a', 2], ['t', 3], ['x', 12]);
  state.phase = 'discard';
  const ids = state.hands[seat].map((c) => c.id);
  const result = E.applyMove(state, seat, {
    type: 'discard',
    cardId: ids[3],
    layout: { words: [[ids[0], ids[1], ids[2]]] }
  });
  assert.ok(result.ok, result.error);
  assert.equal(state.goneOut, seat);
  assert.equal(state.finished.filter(Boolean).length, 1);

  for (const other of [1, 2].map((o) => (seat + o) % 3)) {
    assert.equal(state.turn, other);
    E.applyMove(state, other, { type: 'draw', from: 'deck' });
    const keep = state.hands[other];
    E.applyMove(state, other, { type: 'discard', cardId: keep[0].id, layout: { words: [] } });
  }
  assert.equal(state.phase, 'roundEnd');
  assert.equal(state.round, 1);
});

test('scoring counts words up, leftovers down, and pays both bonuses', () => {
  const state = E.createGame({ players: players(2), seed: 12 });
  state.phase = 'discard';
  state.turn = 0;

  // Seat 0 goes out with QUIZ + AT (40 points) and pitches the spare card.
  state.hands[0] = hand(['q', 15], ['u', 4], ['i', 2], ['z', 14], ['a', 2], ['t', 3], ['v', 11]);
  const first = state.hands[0].map((c) => c.id);
  let result = E.applyMove(state, 0, {
    type: 'discard',
    cardId: first[6],
    layout: { words: [first.slice(0, 4), first.slice(4, 6)] }
  });
  assert.ok(result.ok, result.error);
  assert.equal(state.goneOut, 0);

  // Seat 1 gets one last turn: CAT down, the Z stuck in hand.
  state.hands[1] = hand(['c', 8], ['a', 2], ['t', 3], ['z', 14]);
  state.phase = 'discard';
  const second = state.hands[1].map((c) => c.id);
  result = E.applyMove(state, 1, {
    type: 'discard',
    cardId: second[3],
    layout: { words: [second.slice(0, 3)] }
  });
  assert.ok(result.ok, result.error);

  const rows = state.roundSummary.rows;
  assert.equal(rows[0].bonus, 20, 'longest word and most words');
  assert.equal(rows[0].delta, 40 + 20);
  assert.equal(rows[1].bonus, 0);
  assert.equal(rows[1].delta, 13, 'the discarded z does not count against you');
});

test('bots play 8 legal games start to finish', () => {
  for (let g = 0; g < 8; g++) {
    const n = 2 + (g % 4);
    const state = E.createGame({ players: players(n), seed: g + 5 });
    const rng = makeRng(g * 17 + 2);
    let guard = 0;
    while (!E.isOver(state)) {
      assert.ok(++guard < 5000, 'game stalled');
      const seat = E.activeSeats(state)[0];
      const move = bot.chooseMove(E.view(state, seat), rng, dict);
      const result = E.applyMove(state, seat, move);
      assert.ok(result.ok, result.error);
    }
    assert.equal(state.scoreboard.length, 8);
    assert.ok(state.scores.every((s) => Number.isFinite(s)));
  }
});

test('a seat view never leaks another player\'s letters', () => {
  const state = E.createGame({ players: players(3), seed: 77 });
  const v = E.view(state, 0);
  assert.equal(v.hand.length, handSize(1));
  for (const card of state.hands[1]) {
    assert.equal(JSON.stringify(v.players).includes(card.id), false);
  }
});
