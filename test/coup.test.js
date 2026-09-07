import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/lib/games/coup/engine.js';
import * as bot from '../src/lib/games/coup/bot.js';
import { makeRng } from '../src/lib/games/rng.js';

const players = (n = 3) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, isBot: true }));

/** Put known cards in a hand so a test can rely on what a player holds. */
function setHand(state, seat, characters) {
  state.hands[seat] = characters.map((character, i) => ({ id: `t${seat}-${i}`, character }));
}
function respondAll(state, move = { type: 'allow' }) {
  let guard = 0;
  while (state.phase === 'respond') {
    assert.ok(++guard < 10, 'response window did not close');
    const seat = E.activeSeats(state)[0];
    const result = E.applyMove(state, seat, move);
    assert.ok(result.ok, result.error);
  }
}

test('everyone starts with two influences and two coins, one heads-up', () => {
  const three = E.createGame({ players: players(3), seed: 3 });
  assert.deepEqual(three.hands.map((h) => h.length), [2, 2, 2]);
  assert.deepEqual(three.coins, [2, 2, 2]);
  const heads = E.createGame({ players: players(2), seed: 4 });
  assert.equal(heads.coins[heads.turn], 1, 'the player who goes first starts a coin down');
  assert.equal(heads.coins[1 - heads.turn], 2);
});

test('income is not worth arguing with', () => {
  const state = E.createGame({ players: players(3), seed: 3 });
  const seat = state.turn;
  assert.ok(E.applyMove(state, seat, { type: 'action', action: 'income' }).ok);
  assert.equal(state.coins[seat], 3);
  assert.notEqual(state.turn, seat, 'and the turn moves on at once');
});

test('ten coins in hand means a coup and nothing else', () => {
  const state = E.createGame({ players: players(3), seed: 3 });
  state.coins[state.turn] = 10;
  const actions = E.legalActions(state, state.turn);
  assert.ok(actions.length > 0);
  assert.ok(actions.every((a) => a.action === 'coup'), 'no other action is offered');
});

test('a caught bluff costs a card and the action fails', () => {
  const state = E.createGame({ players: players(3), seed: 3 });
  const liar = state.turn;
  const caller = (liar + 1) % 3;
  setHand(state, liar, ['captain', 'contessa']);   // no Duke anywhere in that hand
  const before = state.coins[liar];
  assert.ok(E.applyMove(state, liar, { type: 'action', action: 'tax' }).ok);
  assert.equal(state.phase, 'respond');
  assert.ok(E.applyMove(state, caller, { type: 'challenge' }).ok);
  assert.equal(state.phase, 'lose', 'the bluffer picks which card to turn over');
  assert.equal(state.losing.seat, liar);
  E.applyMove(state, liar, { type: 'reveal', cardId: state.hands[liar][0].id });
  assert.equal(state.revealed[liar].length, 1);
  assert.equal(state.coins[liar], before, 'and takes no coins');
});

test('an honest claim punishes the challenger and still goes through', () => {
  const state = E.createGame({ players: players(3), seed: 3 });
  const duke = state.turn;
  const caller = (duke + 1) % 3;
  setHand(state, duke, ['duke', 'contessa']);
  E.applyMove(state, duke, { type: 'action', action: 'tax' });
  E.applyMove(state, caller, { type: 'challenge' });
  assert.equal(state.losing.seat, caller, 'the challenger pays');
  E.applyMove(state, caller, { type: 'reveal', cardId: state.hands[caller][0].id });
  assert.equal(state.coins[duke], 5, 'three coins collected');
  assert.ok(state.hands[duke].some((c) => c.character !== 'contessa'), 'the shown Duke was swapped for a fresh card');
  assert.equal(state.hands[duke].length, 2);
});

test('the Contessa stops an assassination, and the coins are gone regardless', () => {
  const state = E.createGame({ players: players(3), seed: 5 });
  const killer = state.turn;
  const mark = (killer + 1) % 3;
  setHand(state, killer, ['assassin', 'captain']);
  setHand(state, mark, ['contessa', 'duke']);
  state.coins[killer] = 3;
  E.applyMove(state, killer, { type: 'action', action: 'assassinate', target: mark });
  assert.equal(state.coins[killer], 0, 'paid on declaration');
  assert.ok(E.applyMove(state, mark, { type: 'block', claim: 'contessa' }).ok);
  respondAll(state);
  assert.equal(state.hands[mark].length, 2, 'the mark keeps both cards');
  assert.equal(state.coins[killer], 0, 'and the three coins do not come back');
});

test('bluffing a block gets you killed twice over', () => {
  const state = E.createGame({ players: players(3), seed: 5 });
  const killer = state.turn;
  const mark = (killer + 1) % 3;
  const other = (killer + 2) % 3;
  setHand(state, killer, ['assassin', 'captain']);
  setHand(state, mark, ['duke', 'ambassador']);   // no Contessa
  state.coins[killer] = 3;
  E.applyMove(state, killer, { type: 'action', action: 'assassinate', target: mark });
  E.applyMove(state, mark, { type: 'block', claim: 'contessa' });
  assert.equal(state.pending.stage, 'blockChallenge');
  // Answers come round the table in turn order, so the bystander speaks first.
  assert.equal(E.activeSeats(state)[0], other);
  assert.ok(E.applyMove(state, other, { type: 'allow' }).ok);
  assert.ok(E.applyMove(state, killer, { type: 'challenge' }).ok);
  // Caught: the blocker gives up a card, and then the knife still lands.
  assert.equal(state.losing.seat, mark);
  E.applyMove(state, mark, { type: 'reveal', cardId: state.hands[mark][0].id });
  assert.ok(E.isOut(state, mark), 'both influences gone in one turn');
});

test('surviving a challenge still leaves the block window open', () => {
  const state = E.createGame({ players: players(3), seed: 7 });
  const killer = state.turn;
  const mark = (killer + 1) % 3;
  const other = (killer + 2) % 3;
  setHand(state, killer, ['assassin', 'captain']);
  setHand(state, mark, ['contessa', 'duke']);
  state.coins[killer] = 3;
  E.applyMove(state, killer, { type: 'action', action: 'assassinate', target: mark });
  E.applyMove(state, mark, { type: 'challenge' });          // and loses it
  assert.equal(state.losing.seat, mark);
  E.applyMove(state, mark, { type: 'reveal', cardId: state.hands[mark].find((c) => c.character === 'duke').id });
  assert.equal(state.phase, 'respond');
  assert.equal(state.pending.stage, 'block', 'the Contessa can still be played');
  assert.ok(E.applyMove(state, mark, { type: 'block', claim: 'contessa' }).ok);
  respondAll(state);
  assert.equal(state.hands[mark].length, 1, 'one card lost to the bad call, none to the knife');
  assert.equal(E.isOut(state, mark), false);
});

test('stealing takes what is there and no more', () => {
  const state = E.createGame({ players: players(3), seed: 9 });
  const thief = state.turn;
  const mark = (thief + 1) % 3;
  setHand(state, thief, ['captain', 'duke']);
  state.coins[mark] = 1;
  const before = state.coins[thief];
  E.applyMove(state, thief, { type: 'action', action: 'steal', target: mark });
  respondAll(state);
  assert.equal(state.coins[mark], 0);
  assert.equal(state.coins[thief], before + 1);
});

test('an exchange keeps exactly as many cards as you had', () => {
  const state = E.createGame({ players: players(3), seed: 11 });
  const envoy = state.turn;
  setHand(state, envoy, ['ambassador', 'duke']);
  E.applyMove(state, envoy, { type: 'action', action: 'exchange' });
  respondAll(state);
  assert.equal(state.phase, 'exchange');
  assert.equal(state.exchange.cards.length, 4);
  const bad = E.applyMove(state, envoy, { type: 'keep', cardIds: [state.exchange.cards[0].id] });
  assert.equal(bad.ok, false, 'you cannot quietly keep three');
  const keep = state.exchange.cards.slice(0, 2).map((c) => c.id);
  assert.ok(E.applyMove(state, envoy, { type: 'keep', cardIds: keep }).ok);
  assert.equal(state.hands[envoy].length, 2);
});

test('a seat view shows your own cards and nobody else\'s', () => {
  const state = E.createGame({ players: players(4), seed: 13 });
  const v = E.view(state, 1);
  assert.equal(v.hand.length, 2);
  // Quote the ids: "c1" must not match inside "c13".
  const text = JSON.stringify(v);
  const leaked = (id) => text.includes(`"${id}"`);
  for (const seat of [0, 2, 3]) {
    for (const card of state.hands[seat]) {
      assert.equal(leaked(card.id), false, `seat 1 can see ${seat}'s card id`);
    }
  }
  for (const card of state.deck) assert.equal(leaked(card.id), false, 'the deck is face down');
  const mine = new Set(state.hands[1].map((c) => c.id));
  assert.ok(v.hand.every((c) => mine.has(c.id)), 'and does see its own');
  assert.deepEqual(v.players.map((p) => p.influence), [2, 2, 2, 2]);
});

test('factions: you cannot hit your own side, and converting fills the reserve', () => {
  const state = E.createGame({ players: players(4), options: { factions: true }, seed: 2 });
  const seat = state.turn;
  const ally = state.players.findIndex((p, i) => i !== seat && state.allegiance[i] === state.allegiance[seat]);
  state.coins[seat] = 7;
  const actions = E.legalActions(state, seat);
  assert.equal(actions.some((a) => a.action === 'coup' && a.target === ally), false, 'no couping your own');
  assert.ok(actions.some((a) => a.action === 'coup'), 'the other side is fair game');

  const before = state.allegiance[seat];
  assert.ok(E.applyMove(state, seat, { type: 'action', action: 'convert', target: seat }).ok);
  assert.equal(state.allegiance[seat], 1 - before);
  assert.equal(state.reserve, 1, 'the coin goes to the reserve, not to a player');
});

test('factions: conversion cannot be used to empty a side', () => {
  const state = E.createGame({ players: players(3), options: { factions: true }, seed: 2 });
  state.allegiance = [0, 0, 1];
  state.turn = 0;
  state.coins[0] = 5;
  const actions = E.legalActions(state, 0);
  assert.equal(actions.some((a) => a.action === 'convert' && a.target === 2), false, 'seat 2 is the last of their faction');
  assert.ok(actions.some((a) => a.action === 'convert' && a.target === 0), 'but you can still cross the floor yourself');
});

test('factions: the last side standing wins together', () => {
  const state = E.createGame({ players: players(3), options: { factions: true }, seed: 2 });
  state.allegiance = [0, 1, 0];
  state.revealed[1] = state.hands[1].splice(0, 2);
  state.turn = 0;
  E.applyMove(state, 0, { type: 'action', action: 'income' });
  assert.equal(state.phase, 'gameOver');
  assert.deepEqual(state.winners.sort(), [0, 2]);
});

test('the Embezzler only appears when there is a treasury to raid', () => {
  const withoutFactions = E.createGame({ players: players(3), options: { set: 'treasury' }, seed: 3 });
  assert.equal(E.legalActions(withoutFactions, withoutFactions.turn).some((a) => a.action === 'embezzle'), false);
  const withFactions = E.createGame({ players: players(3), options: { set: 'treasury', factions: true }, seed: 3 });
  assert.ok(E.legalActions(withFactions, withFactions.turn).some((a) => a.action === 'embezzle'));
  withFactions.reserve = 5;
  const seat = withFactions.turn;
  E.applyMove(withFactions, seat, { type: 'action', action: 'embezzle' });
  respondAll(withFactions);
  assert.equal(withFactions.reserve, 0);
  assert.equal(withFactions.coins[seat], 7, 'two coins plus the whole pot');
});

test('bots play every mode out without an illegal move', () => {
  const modes = [{}, { factions: true }, { set: 'inquisition' }, { set: 'treasury', factions: true }];
  for (const [m, options] of modes.entries()) {
    for (let g = 0; g < 8; g++) {
      const state = E.createGame({ players: players(2 + ((g + m) % 5)), options, seed: g * 17 + m * 101 + 5 });
      const rng = makeRng(g * 31 + m * 7 + 3);
      let guard = 0;
      while (!E.isOver(state)) {
        assert.ok(++guard < 8000, `stuck in ${state.phase}`);
        const seat = E.activeSeats(state)[0];
        assert.notEqual(seat, undefined, `no seat to act in ${state.phase}`);
        const result = E.applyMove(state, seat, bot.chooseMove(E.view(state, seat), rng));
        assert.ok(result.ok, result.error);
      }
      assert.ok(state.winners.length >= 1);
      // Nobody keeps playing after both their cards are face up.
      for (const seat of state.winners) assert.equal(E.isOut(state, seat), false);
    }
  }
});
