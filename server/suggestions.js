// Suggestions from the shelf's "Something else" card.
//
// The site is static on GitHub Pages, so a suggestion has nowhere to go on its
// own. Rather than hand the job to a third-party form service and ship a key in
// the bundle, it posts here — the process that already exists to make online
// play work — and lands in the same JSON file as everything else.
//
// It is a public, unauthenticated write, so it is treated as hostile input:
// bounded body, bounded fields, a honeypot, and a per-address rate limit.
import { getData, touch } from './store.js';

/** Longest suggestion accepted. Comfortably more than anyone types in earnest. */
export const MAX_TEXT = 1000;
export const MAX_NAME = 80;
/** Bytes read from the socket before the request is abandoned. */
export const MAX_BODY = 8 * 1024;
export const RATE_LIMIT = Number(process.env.SUGGEST_LIMIT ?? 5);
export const RATE_WINDOW = Number(process.env.SUGGEST_WINDOW ?? 10 * 60_000);
/** Suggestions retained. Old ones fall off rather than growing the file forever. */
export const KEEP = 500;

const posts = new Map(); // address -> { count, until }

export function tooMany(address, now = Date.now()) {
  const entry = posts.get(address);
  if (!entry || now > entry.until) {
    posts.set(address, { count: 1, until: now + RATE_WINDOW });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

export function resetRateLimit() {
  posts.clear();
}

/**
 * Validate one submission.
 *
 * `website` is a honeypot: the form renders it hidden and a person never fills
 * it in, so anything there is a bot. It is accepted with a cheerful `ok` rather
 * than an error, because telling a bot it failed only teaches it to try again.
 *
 * @param {object} body - Parsed JSON body.
 * @returns {{ok: true, drop?: true, entry?: object} | {ok: false, error: string}}
 */
export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Expected a suggestion.' };
  }
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return { ok: true, drop: true };
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return { ok: false, error: 'Write a suggestion first.' };
  if (text.length > MAX_TEXT) return { ok: false, error: 'That is longer than the box allows.' };
  const from = typeof body.from === 'string' ? body.from.trim().slice(0, MAX_NAME) : '';
  return { ok: true, entry: { text, from: from || null, at: new Date().toISOString() } };
}

/** Append a validated suggestion to the store. */
export function record(entry) {
  const data = getData();
  data.suggestions ??= [];
  data.suggestions.push(entry);
  if (data.suggestions.length > KEEP) {
    data.suggestions.splice(0, data.suggestions.length - KEEP);
  }
  touch();
  return data.suggestions.length;
}

/** Read a bounded JSON body. Resolves null when it is too big or not JSON. */
export function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}
