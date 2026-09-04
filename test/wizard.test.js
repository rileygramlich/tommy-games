import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/lib/games/wizard/engine.js';
import * as bot from '../src/lib/games/wizard/bot.js';
import { buildDeck } from '../src/lib/games/wizard/deck.js';
import { makeRng } from '../src/lib/games/rng.js';

const card = (id) => buildDeck().find((c) => c.id === id);
const players = (n) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isBot: true }));

test('the deck is 60 cards: 52 plus four Wizards and four Jesters', () => {
  const deck = buildDeck();
  assert.equal(deck.length, 60);
  assert.equal(deck.filter((c) => c.kind === 'wizard').length, 4);
  assert.equal(deck.filter((c) => c.kind === 'jester').length, 4);
  assert.equal(new Set(deck.map((c) => c.id)).size, 60);
});

test('the first Wizard played takes the trick', () => {
  const trick = [
    { seat: 0, card: card('S14') },
    { seat: 1, card: card('W1') },
    { seat: 2, card: card('W2') }
  ];
  assert.equal(E.trickWinner(trick, 'S'), 1);
});

test('trump beats the led suit, and rank decides within a suit', () => {
  const trick = [
    { seat: 0, card: card('H14') },
    { seat: 1, card: card('C2') },
    { seat: 2, card: card('H13') }
  ];
  assert.equal(E.trickWinner(trick, 'C'), 1);
  assert.equal(E.trickWinner(trick, 'S'), 0);
});

test('a Jester lead hands the suit to the next real card', () => {
  const trick = [
    { seat: 0, card: card('J1') },
    { seat: 1, card: card('D5') },
    { seat: 2, card: card('H14') }
  ];
  assert.equal(E.trickWinner(trick, null), 1, 'hearts is off-suit, so the five of diamonds holds');
});

test('a trick of nothing but Jesters goes to the lead', () => {
  const trick = [0, 1, 2].map((seat) => ({ seat, card: card(`J${seat + 1}`) }));
  assert.equal(E.trickWinner(trick, 'S'), 0);
});

test('you must follow suit when you can, but Wizards and Jesters are always legal', () => {
  const state = E.createGame({ players: players(3), seed: 3 });
  state.phase = 'playing';
  state.ledSuit = 'H';
  state.wizardLed = false;
  state.hands[0] = [card('H5'), card('S14'), card('W1'), card('J1')];
  const legal = E.playableCards(state, 0).map((c) => c.id);
  assert.deepEqual(legal.sort(), ['H5', 'J1', 'W1']);

  state.turn = 0;
  const rejected = E.applyMove(state, 0, { type: 'play', cardId: 'S14' });
  assert.equal(rejected.ok, false);
});

test('scoring pays 20 plus 10 a trick for an exact bid, and 10 off per trick missed', () => {
  const state = E.createGame({ players: players(3), seed: 11 });
  state.round = 3;
  state.bids = [2, 0, 1];
  state.tricksWon = [2, 1, 3];
  state.hands = [[], [], []];
  state.phase = 'trickEnd';
  state.lastTrick = { plays: [], winner: 0 };
  E.applyMove(state, 0, { type: 'continue' });
  assert.deepEqual(state.scores, [40, -10, -20]);
  assert.equal(state.phase, 'roundEnd');
});

test('the hook rule stops the dealer from making the bids add up', () => {
  const state = E.createGame({ players: players(3), options: { hookRule: true }, seed: 21 });
  state.round = 3;
  state.phase = 'bidding';
  state.dealer = 2;
  state.turn = 2;
  state.bids = [1, 1, null];
  assert.equal(E.applyMove(state, 2, { type: 'bid', bid: 1 }).ok, false);
  assert.equal(E.applyMove(state, 2, { type: 'bid', bid: 2 }).ok, true);
});

test('bots play 60 legal games start to finish', () => {
  for (let g = 0; g < 60; g++) {
    const n = 3 + (g % 4);
    const state = E.createGame({ players: players(n), options: { hookRule: g % 2 === 0 }, seed: g + 1 });
    const rng = makeRng(g * 31 + 7);
    let guard = 0;
    while (!E.isOver(state)) {
      assert.ok(++guard < 20000, 'game stalled');
      const seat = E.activeSeats(state)[0];
      const result = E.applyMove(state, seat, bot.chooseMove(E.view(state, seat), rng));
      assert.ok(result.ok, result.error);
    }
    assert.equal(state.scoreboard.length, state.options.rounds);
    for (const round of state.scoreboard) {
      assert.equal(round.tricks.reduce((a, b) => a + b, 0), round.round, 'every trick is accounted for');
    }
  }
});

test('a seat view never leaks another player\'s hand', () => {
  const state = E.createGame({ players: players(4), seed: 99 });
  const v = E.view(state, 1);
  assert.equal(v.hand.length, state.hands[1].length);
  assert.equal(JSON.stringify(v).includes(state.hands[2][0].id), false);
});
