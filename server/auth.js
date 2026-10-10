import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getData, touch } from './store.js';

const TOKEN_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days

function hash(password, salt) {
  return scryptSync(password, salt, 32).toString('hex');
}

function normalise(username) {
  return String(username ?? '').trim().toLowerCase();
}

export function validateCredentials(username, password) {
  const id = normalise(username);
  if (!/^[a-z0-9_-]{3,16}$/.test(id)) {
    return 'Names are 3–16 characters: letters, numbers, dash or underscore.';
  }
  if (typeof password !== 'string' || password.length < 6) {
    return 'Passwords need at least six characters.';
  }
  return null;
}

export function register(username, password) {
  const problem = validateCredentials(username, password);
  if (problem) return { error: problem };
  const data = getData();
  const id = normalise(username);
  if (data.users[id]) return { error: 'That name is taken.' };
  const salt = randomBytes(16).toString('hex');
  data.users[id] = {
    id,
    display: String(username).trim(),
    salt,
    hash: hash(password, salt),
    createdAt: Date.now(),
    stats: {}
  };
  touch();
  return { user: data.users[id], token: issueToken(id) };
}

export function login(username, password) {
  const data = getData();
  const user = data.users[normalise(username)];
  // Google accounts have no password to sign in with.
  if (!user || !user.hash) return { error: 'No account with that name.' };
  const attempt = Buffer.from(hash(password, user.salt), 'hex');
  const stored = Buffer.from(user.hash, 'hex');
  if (attempt.length !== stored.length || !timingSafeEqual(attempt, stored)) {
    return { error: 'Wrong password.' };
  }
  return { user, token: issueToken(user.id) };
}

/** The account for a Google profile Google has vouched for, made on first sign-in. */
export function googleAccount(payload) {
  if (!payload?.sub) throw new Error('Google sent no account ID.');
  const data = getData();
  const id = `google:${payload.sub}`;
  if (!data.users[id]) {
    // Keyed by Google's account ID, so a later name change is not a new account.
    // Nothing else from Google is kept: no email, no photo.
    const display = String(payload.given_name || payload.name || 'Player').trim().slice(0, 16);
    data.users[id] = { id, display, google: true, createdAt: Date.now(), stats: {} };
    touch();
  }
  return data.users[id];
}

export function issueToken(userId) {
  const data = getData();
  const token = randomBytes(24).toString('hex');
  data.tokens[token] = { userId, at: Date.now() };
  touch();
  return token;
}

// Guests pick a name and play: no password, no record. They live in memory
// only, so a restart forgets them along with the tables they were sitting at.
const guests = new Map(); // token -> user
const GUEST_LIMIT = 2000;

export function guest(name) {
  const display = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (display.length < 1 || display.length > 16) return { error: 'Pick a name of 1–16 characters.' };
  if (guests.size >= GUEST_LIMIT) guests.delete(guests.keys().next().value); // oldest first
  const token = `guest-${randomBytes(24).toString('hex')}`;
  const user = { id: `guest:${randomBytes(6).toString('hex')}`, display, guest: true, stats: {} };
  guests.set(token, user);
  return { user, token };
}

export function resume(token) {
  if (guests.has(token)) return { user: guests.get(token), token };
  const data = getData();
  const entry = data.tokens[token];
  if (!entry) return { error: 'Session expired.' };
  if (Date.now() - entry.at > TOKEN_TTL) {
    delete data.tokens[token];
    touch();
    return { error: 'Session expired.' };
  }
  const user = data.users[entry.userId];
  if (!user) return { error: 'Session expired.' };
  return { user, token };
}

export function revoke(token) {
  guests.delete(token);
  const data = getData();
  if (data.tokens[token]) { delete data.tokens[token]; touch(); }
}

export function recordResult(userId, gameId, won) {
  const user = getData().users[userId];
  if (!user) return;
  const stats = (user.stats[gameId] ??= { played: 0, won: 0 });
  stats.played += 1;
  if (won) stats.won += 1;
  touch();
}

export function publicUser(user) {
  return { id: user.id, name: user.display, guest: !!user.guest, stats: user.stats ?? {} };
}
