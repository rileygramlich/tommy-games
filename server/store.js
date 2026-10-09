// Accounts, sign-in tokens and shelf suggestions, kept in memory and saved
// as one small document. A JSON file is plenty of database for a hobby game
// server; MongoDB is there for hosts whose disk is wiped on every restart
// (Render's free plan), so accounts outlive the server falling asleep.
//
//   MONGODB_URI set   → one document in that database (default name tommy-games)
//   otherwise         → DATA_DIR/users.json
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ?? join(here, 'data');
const FILE = join(DATA_DIR, 'users.json');
const MONGODB_URI = process.env.MONGODB_URI ?? '';

let data = { users: {}, tokens: {} };
let dirty = false;
let pending = null;
let collection = null; // set when saving to MongoDB
let saving = Promise.resolve();

function normalise(loaded) {
  return { ...loaded, users: loaded?.users ?? {}, tokens: loaded?.tokens ?? {} };
}

/** Where the store lives, for the startup log. Never includes credentials. */
export function storeLabel() {
  return collection ? `MongoDB (${collection.dbName})` : FILE;
}

export async function loadStore() {
  if (MONGODB_URI) {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await client.connect();
    // The database named in the URI, else tommy-games rather than the driver's "test".
    const named = new URL(MONGODB_URI.replace(/^mongodb(\+srv)?:/, 'http:')).pathname.slice(1);
    collection = client.db(named || 'tommy-games').collection('store');
    const { _id, ...loaded } = (await collection.findOne({ _id: 'store' })) ?? {};
    data = normalise(loaded);
  } else {
    mkdirSync(DATA_DIR, { recursive: true });
    try {
      data = normalise(JSON.parse(readFileSync(FILE, 'utf8')));
    } catch {
      data = { users: {}, tokens: {} };
    }
    process.on('exit', flush);
  }
  return data;
}

export function flush() {
  if (!dirty) return saving;
  dirty = false;
  if (collection) {
    // One write at a time, in order, so an older snapshot never lands last.
    const snapshot = structuredClone(data);
    saving = saving
      .then(() => collection.replaceOne({ _id: 'store' }, snapshot, { upsert: true }))
      .catch((err) => { console.error('saving to MongoDB failed:', err.message); dirty = true; });
    return saving;
  }
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, FILE);
  return saving;
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
