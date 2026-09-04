// A JSON file is plenty of database for a hobby game server.
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ?? join(here, 'data');
const FILE = join(DATA_DIR, 'users.json');

let data = { users: {}, tokens: {} };
let dirty = false;
let pending = null;

export function loadStore() {
  mkdirSync(DATA_DIR, { recursive: true });
  try {
    data = JSON.parse(readFileSync(FILE, 'utf8'));
    data.users ??= {};
    data.tokens ??= {};
  } catch {
    data = { users: {}, tokens: {} };
  }
  process.on('exit', flush);
  return data;
}

export function flush() {
  if (!dirty) return;
  dirty = false;
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, FILE);
}

// Writes are rare (an account, a token, a finished game) but should not block a
// game loop, so they coalesce into one write a moment later.
export function touch() {
  dirty = true;
  if (pending) return;
  pending = setTimeout(() => { pending = null; flush(); }, 50);
  pending.unref?.();
}
export function getData() { return data; }
