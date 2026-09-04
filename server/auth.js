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
  if (!user) return { error: 'No account with that name.' };
  const attempt = Buffer.from(hash(password, user.salt), 'hex');
  const stored = Buffer.from(user.hash, 'hex');
  if (attempt.length !== stored.length || !timingSafeEqual(attempt, stored)) {
    return { error: 'Wrong password.' };
  }
  return { user, token: issueToken(user.id) };
}

export function issueToken(userId) {
  const data = getData();
  const token = randomBytes(24).toString('hex');
  data.tokens[token] = { userId, at: Date.now() };
  touch();
  return token;
}

export function resume(token) {
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
  return { id: user.id, name: user.display, stats: user.stats ?? {} };
}
