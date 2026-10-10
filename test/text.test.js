import test from 'node:test';
import assert from 'node:assert/strict';
import { youGrammar, plural } from '../src/lib/text.js';

test('messages about the "You" seat read as English', () => {
  const cases = {
    'You takes the trick': 'You take the trick',
    'You takes it': 'You take it',
    'You wins': 'You win',
    'You is home': 'You are home',
    'You has no move left.': 'You have no move left.',
    'You goes first.': 'You go first.',
    'You passes.': 'You pass.',
    'You empties the reserve of 4.': 'You empty the reserve of 4.',
    'You bids 2.': 'You bid 2.',
    "You's turn": 'Your turn',
    'Game over — You & Marigold wins.': 'Game over — You & Marigold wins.',
    'Marigold steals 2 from You.': 'Marigold steals 2 from You.',
    'You 12': 'You 12',
    'Marigold takes the trick': 'Marigold takes the trick'
  };
  for (const [raw, want] of Object.entries(cases)) assert.equal(youGrammar(raw), want, raw);
});

test('plural', () => {
  assert.equal(plural(1, 'trick'), '1 trick');
  assert.equal(plural(0, 'trick'), '0 tricks');
});
