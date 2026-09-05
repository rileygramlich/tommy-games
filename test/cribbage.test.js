import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/lib/games/cribbage/engine.js';
import * as bot from '../src/lib/games/cribbage/bot.js';
import { scoreShow, scorePegging } from '../src/lib/games/cribbage/scoring.js';
import { makeCard } from '../src/lib/games/cards.js';
import { makeRng } from '../src/lib/games/rng.js';

const players = () => [{ name: 'A', isBot: true }, { name: 'B', isBot: true }];
const c = (suit, rank) => makeCard(suit, rank);

test('the twenty-nine hand counts twenty-nine', () => {
  const hand = [c('C', 5), c('D', 5), c('S', 5), c('H', 11)];
  assert.equal(scoreShow(hand, c('H', 5)).total, 29);
});

test('double runs, fifteens and pairs all count together', () => {
  const result = scoreShow([c('C', 5), c('D', 6), c('S', 6), c('H', 7)], null);
  assert.equal(result.total, 8, 'a pair and two runs of three');
  assert.equal(scoreShow([c('C', 7), c('D', 8), c('S', 9), c('H', 6)], c('C', 10)).total, 9, 'run of five, plus a fifteen');
});

test('a flush needs four in hand and all five in the crib', () => {
  const hearts = [c('H', 2), c('H', 4), c('H', 9), c('H', 13)];
  assert.equal(scoreShow(hearts, c('S', 7), false).total, 6, 'four-card flush plus a fifteen');
  assert.equal(scoreShow(hearts, c('H', 7), false).total, 7, 'the starter makes it five');
  assert.equal(scoreShow(hearts, c('S', 7), true).total, 2, 'the crib gets nothing for four');
});

test('his nobs is the jack matching the cut', () => {
  const hand = [c('H', 11), c('C', 13), c('D', 3), c('S', 6)]; // nothing else in it
  assert.equal(scoreShow(hand, c('H', 14)).total, 1, 'the jack of hearts with a heart cut');
  assert.equal(scoreShow(hand, c('C', 14)).total, 0, 'no point for the wrong suit');
});

test('pegging counts fifteens, thirty-ones, pairs and runs', () => {
  assert.equal(scorePegging([c('C', 7), c('D', 8)], 15).total, 2);
  assert.equal(scorePegging([c('C', 5), c('D', 5), c('S', 5)], 15).total, 8, 'fifteen and three of a kind');
  assert.equal(scorePegging([c('C', 4), c('D', 6), c('S', 5)], 15).total, 5, 'fifteen and a run of three');
  assert.equal(scorePegging([c('C', 13), c('D', 11), c('S', 14)], 31).total, 2);
});

test('both players lay two away and then the deck is cut', () => {
  const state = E.createGame({ players: players(), seed: 2 });
  const first = state.turn;
  assert.equal(first, 1 - state.dealer, 'the non-dealer lays away first');
  assert.ok(E.applyMove(state, first, { type: 'discard', cardIds: state.hands[first].slice(0, 2).map((x) => x.id) }).ok);
  assert.equal(state.phase, 'discard');
  const dealer = state.dealer;
  assert.ok(E.applyMove(state, dealer, { type: 'discard', cardIds: state.hands[dealer].slice(0, 2).map((x) => x.id) }).ok);
  assert.equal(state.phase, 'pegging');
  assert.equal(state.crib.length, 4);
  assert.ok(state.starter);
  assert.equal(state.turn, 1 - state.dealer, 'the non-dealer leads');
});

test('you cannot play past thirty-one, and the go pays a point', () => {
  const state = E.createGame({ players: players(), seed: 3 });
  state.phase = 'pegging';
  state.turn = 0;
  state.count = 30;
  state.pile = [c('S', 10), c('H', 10), c('D', 10)];
  state.hands = [[c('C', 9)], [c('D', 9)]];
  state.lastPlayer = 1;
  assert.equal(E.applyMove(state, 0, { type: 'play', cardId: 'C9' }).ok, false, 'nine would make thirty-nine');
  const before = state.scores[1];
  // Neither player can go on, so the go resolves on the spot.
  assert.ok(E.applyMove(state, 0, { type: 'go' }).ok);
  assert.equal(state.scores[1], before + 1, 'the last card played takes the go');
  assert.equal(state.count, 0, 'and the count starts again');
  assert.equal(state.turn, 0, 'the player who could not go leads the next one');
});

test('a go passes the play back while the other side can still lay cards', () => {
  const state = E.createGame({ players: players(), seed: 7 });
  state.phase = 'pegging';
  state.turn = 0;
  state.count = 25;
  state.pile = [c('S', 10), c('H', 10), c('D', 5)];
  state.hands = [[c('C', 13)], [c('D', 4), c('H', 2)]];
  state.lastPlayer = 1;
  assert.ok(E.applyMove(state, 0, { type: 'go' }).ok);
  assert.equal(state.turn, 1, 'the opponent keeps playing');
  assert.ok(E.applyMove(state, 1, { type: 'play', cardId: 'D4' }).ok);
  assert.equal(state.count, 29);
});

test('the game stops the moment someone reaches the target', () => {
  const state = E.createGame({ players: players(), options: { target: 121 }, seed: 5 });
  state.scores = [120, 90];
  state.phase = 'pegging';
  state.turn = 0;
  state.count = 13;
  state.pile = [c('S', 6), c('H', 7)];
  state.hands = [[c('C', 2)], [c('D', 9)]];
  assert.ok(E.applyMove(state, 0, { type: 'play', cardId: 'C2' }).ok, 'fifteen two');
  assert.equal(state.phase, 'gameOver');
  assert.deepEqual(state.winners, [0]);
  assert.equal(state.scores[0], 121, 'nobody goes past the end of the board');
});

test('bots play full games to 121', () => {
  for (let g = 0; g < 5; g++) {
    const state = E.createGame({ players: players(), seed: g * 11 + 3 });
    const rng = makeRng(g * 31 + 7);
    let guard = 0;
    while (!E.isOver(state)) {
      assert.ok(++guard < 5000, 'game stalled');
      const seat = E.activeSeats(state)[0];
      const result = E.applyMove(state, seat, bot.chooseMove(E.view(state, seat), rng));
      assert.ok(result.ok, result.error);
    }
    assert.equal(Math.max(...state.scores), 121);
    assert.ok(state.deal >= 4 && state.deal <= 20, `a believable game length, got ${state.deal} deals`);
  }
});
