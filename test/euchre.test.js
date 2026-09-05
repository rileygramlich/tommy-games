import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/lib/games/euchre/engine.js';
import * as bot from '../src/lib/games/euchre/bot.js';
import { makeCard } from '../src/lib/games/cards.js';
import { makeRng } from '../src/lib/games/rng.js';

const players = () => Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, isBot: true }));
const c = (suit, rank) => makeCard(suit, rank);

test('the left bower belongs to the trump suit', () => {
  assert.equal(E.effectiveSuit(c('D', 11), 'H'), 'H', 'jack of diamonds is a heart when hearts are trump');
  assert.equal(E.effectiveSuit(c('D', 11), 'S'), 'D', 'but not when spades are');
  assert.equal(E.effectiveSuit(c('D', 14), 'H'), 'D');
});

test('right bower beats left bower beats the ace of trump', () => {
  assert.ok(E.trumpRank(c('H', 11), 'H') > E.trumpRank(c('D', 11), 'H'));
  assert.ok(E.trumpRank(c('D', 11), 'H') > E.trumpRank(c('H', 14), 'H'));
  assert.equal(E.trumpRank(c('S', 14), 'H'), -1, 'off-suit is not trump at all');
});

test('the highest trump takes the trick, otherwise the suit led', () => {
  const trick = [
    { seat: 0, card: c('S', 14) },
    { seat: 1, card: c('H', 9) },
    { seat: 2, card: c('S', 13) },
    { seat: 3, card: c('D', 11) }
  ];
  assert.equal(E.trickWinner(trick, 'H'), 3, 'the left bower is the top heart here');
  assert.equal(E.trickWinner(trick, 'C'), 0, 'no trump played, so the ace of spades holds');
});

test('you must follow suit, counting the left bower as trump', () => {
  const state = E.createGame({ players: players(), seed: 4 });
  state.phase = 'playing';
  state.trump = 'H';
  state.ledSuit = 'H';
  state.turn = 0;
  state.hands[0] = [c('D', 11), c('S', 14), c('C', 9)];
  assert.deepEqual(E.playableCards(state, 0).map((x) => x.id), ['D11'], 'the left bower must be played');
  assert.equal(E.applyMove(state, 0, { type: 'play', cardId: 'S14' }).ok, false);
  assert.equal(E.applyMove(state, 0, { type: 'play', cardId: 'D11' }).ok, true);
});

test('ordering it up makes the dealer pick the card up and pitch one', () => {
  const state = E.createGame({ players: players(), seed: 6 });
  const bidder = state.turn;
  const before = state.hands[state.dealer].length;
  assert.ok(E.applyMove(state, bidder, { type: 'orderUp', alone: false }).ok);
  assert.equal(state.phase, 'dealerDiscard');
  assert.equal(state.hands[state.dealer].length, before + 1);
  assert.equal(state.trump, state.upcard.suit);
  const pitch = state.hands[state.dealer][0].id;
  assert.ok(E.applyMove(state, state.dealer, { type: 'discard', cardId: pitch }).ok);
  assert.equal(state.phase, 'playing');
  assert.equal(state.hands[state.dealer].length, 5);
});

test('scoring: one for the point, two for a march, two for a euchre, four alone', () => {
  const score = (tricks, alone) => {
    const state = E.createGame({ players: players(), seed: 8 });
    state.trump = 'H';
    state.maker = 0;
    state.alone = alone;
    state.tricksWon = tricks;
    state.hands = [[], [], [], []];
    state.phase = 'trickEnd';
    state.lastTrick = { plays: [], winner: 0 };
    E.applyMove(state, 0, { type: 'continue' });
    return state.scores;
  };
  assert.deepEqual(score([2, 0, 1, 2], false), [1, 0], 'three tricks is the point');
  assert.deepEqual(score([3, 0, 2, 0], false), [2, 0], 'all five is a march');
  assert.deepEqual(score([5, 0, 0, 0], true), [4, 0], 'alone and all five is four');
  assert.deepEqual(score([1, 2, 1, 1], false), [0, 2], 'euchred, and the other side takes two');
});

test('going alone sits the partner out of the play', () => {
  const state = E.createGame({ players: players(), seed: 12 });
  const bidder = state.turn;
  E.applyMove(state, bidder, { type: 'orderUp', alone: true });
  if (state.phase === 'dealerDiscard') {
    E.applyMove(state, state.dealer, { type: 'discard', cardId: state.hands[state.dealer][0].id });
  }
  assert.equal(state.sitter, E.partnerOf(bidder));
  assert.equal(state.hands[state.sitter].length, 0);
  assert.notEqual(state.turn, state.sitter, 'the empty seat never gets the lead');
});

test('bots play whole games to ten without an illegal move', () => {
  for (let g = 0; g < 12; g++) {
    const state = E.createGame({ players: players(), options: { stickTheDealer: g % 2 === 0 }, seed: g * 7 + 1 });
    const rng = makeRng(g * 13 + 5);
    let guard = 0;
    while (!E.isOver(state)) {
      assert.ok(++guard < 8000, 'game stalled');
      const seat = E.activeSeats(state)[0];
      const result = E.applyMove(state, seat, bot.chooseMove(E.view(state, seat), rng));
      assert.ok(result.ok, result.error);
    }
    assert.ok(Math.max(...state.scores) >= 10);
    assert.equal(state.winners.length, 2, 'a team wins together');
  }
});
