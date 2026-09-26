import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TEXT, MAX_NAME, RATE_LIMIT, KEEP,
  validate, record, tooMany, resetRateLimit
} from '../server/suggestions.js';
import { getData } from '../server/store.js';

test('a suggestion needs some text', () => {
  assert.equal(validate({ text: 'Add cribbage for four' }).ok, true);
  assert.equal(validate({ text: '   ' }).ok, false);
  assert.equal(validate({}).ok, false);
  assert.equal(validate(null).ok, false);
  assert.equal(validate([]).ok, false, 'an array is not a suggestion');
  assert.equal(validate('just a string').ok, false);
});

test('text and name are bounded', () => {
  assert.equal(validate({ text: 'x'.repeat(MAX_TEXT) }).ok, true);
  const tooLong = validate({ text: 'x'.repeat(MAX_TEXT + 1) });
  assert.equal(tooLong.ok, false);
  assert.match(tooLong.error, /longer/i);

  const long = validate({ text: 'hello', from: 'n'.repeat(MAX_NAME + 50) });
  assert.equal(long.entry.from.length, MAX_NAME, 'a long name is trimmed, not rejected');
});

test('a missing name is stored as null rather than an empty string', () => {
  assert.equal(validate({ text: 'hello' }).entry.from, null);
  assert.equal(validate({ text: 'hello', from: '  ' }).entry.from, null);
  assert.equal(validate({ text: 'hello', from: ' Tommy ' }).entry.from, 'Tommy');
});

test('the honeypot is accepted and discarded, not rejected', () => {
  // Telling a bot it failed only teaches it to try again.
  const spam = validate({ text: 'buy things', website: 'http://example.com' });
  assert.equal(spam.ok, true);
  assert.equal(spam.drop, true);
  assert.equal(spam.entry, undefined, 'nothing to store');
  // An empty honeypot is what a real person sends.
  assert.equal(validate({ text: 'real', website: '' }).drop, undefined);
});

test('entries carry a timestamp', () => {
  const { entry } = validate({ text: 'add checkers' });
  assert.ok(!Number.isNaN(Date.parse(entry.at)));
});

test('the rate limit lets a few through then stops', () => {
  resetRateLimit();
  for (let i = 0; i < RATE_LIMIT; i++) {
    assert.equal(tooMany('1.2.3.4'), false, `submission ${i + 1} is allowed`);
  }
  assert.equal(tooMany('1.2.3.4'), true, 'one past the limit is refused');
  assert.equal(tooMany('5.6.7.8'), false, 'a different address is unaffected');
  resetRateLimit();
});

test('the rate limit forgets an address once its window passes', () => {
  resetRateLimit();
  const now = Date.now();
  for (let i = 0; i < RATE_LIMIT + 2; i++) tooMany('9.9.9.9', now);
  assert.equal(tooMany('9.9.9.9', now), true);
  assert.equal(tooMany('9.9.9.9', now + 60 * 60_000), false, 'an hour later it is clear');
  resetRateLimit();
});

test('stored suggestions are capped so the file cannot grow forever', () => {
  const data = getData();
  data.suggestions = [];
  for (let i = 0; i < KEEP + 25; i++) record({ text: `note ${i}`, from: null, at: '2026-01-01' });
  assert.equal(data.suggestions.length, KEEP);
  assert.equal(data.suggestions[0].text, 'note 25', 'the oldest fall off the front');
  assert.equal(data.suggestions.at(-1).text, `note ${KEEP + 24}`);
  data.suggestions = [];
});
