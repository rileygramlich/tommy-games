// Sign in with Google, the redirect way (the same flow as Glossa Galore):
//
//   site  →  GET /auth/google?return=<page>   this server remembers the page
//         →  Google's sign-in page             you pick an account
//         →  GET /auth/google/callback         this server checks it with Google
//         →  <page>#…?login=<one-time code>    the site trades the code for a
//                                              session over the WebSocket
//
// The code is single-use and lasts two minutes, so the session token itself
// never appears in a URL. Only pages on ALLOWED_ORIGINS can be returned to:
// otherwise anyone could start a sign-in that hands the code to their own site.
import { randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { getData } from './store.js';
import { googleAccount, issueToken } from './auth.js';

const CLIENT_ID = (process.env.GOOGLE_CLIENT_ID ?? '').trim();
const CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET ?? '').trim();
// This server's own public address. Render provides RENDER_EXTERNAL_URL itself.
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/+$/, '');

export const googleEnabled = Boolean(CLIENT_ID && CLIENT_SECRET && PUBLIC_URL);
export const callbackUrl = `${PUBLIC_URL}/auth/google/callback`;
const client = googleEnabled ? new OAuth2Client(CLIENT_ID, CLIENT_SECRET, callbackUrl) : null;

const STATE_TTL = 10 * 60 * 1000;
const CODE_TTL = 2 * 60 * 1000;
const LIMIT = 1000;
const states = new Map(); // state -> { returnTo, at }
const codes = new Map();  // one-time code -> { userId, at }

function remember(map, key, value) {
  if (map.size >= LIMIT) map.delete(map.keys().next().value); // oldest first
  map.set(key, { ...value, at: Date.now() });
}

function take(map, key, ttl) {
  const entry = map.get(key);
  map.delete(key);
  return entry && Date.now() - entry.at <= ttl ? entry : null;
}

/** The page to come back to, if it is on an allowed site. Locally, any localhost. */
export function allowedReturn(url, allowed) {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return null;
  const ok = allowed.length
    ? allowed.includes(parsed.origin)
    : ['localhost', '127.0.0.1'].includes(parsed.hostname);
  return ok ? parsed.href : null;
}

// The site routes on the hash (#/online?table=AB12), so the parameter goes there.
function withParam(returnTo, key, value) {
  const url = new URL(returnTo);
  const hash = url.hash || '#/online';
  url.hash = `${hash}${hash.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}`;
  return url.href;
}

/** Where to send the browser to start signing in. */
export function startGoogle(returnTo) {
  const state = randomBytes(16).toString('hex');
  remember(states, state, { returnTo });
  return client.generateAuthUrl({ scope: ['openid', 'profile'], state, prompt: 'select_account' });
}

/** Google came back. Returns { location } to redirect to, or { status, message }. */
export async function finishGoogle(params) {
  const saved = take(states, params.get('state') ?? '', STATE_TTL);
  if (!saved) return { status: 400, message: 'That sign-in link has expired. Go back to Tommy Games and try again.' };
  if (params.get('error') || !params.get('code')) {
    return { location: withParam(saved.returnTo, 'login_error', 'Google sign-in was cancelled.') };
  }
  try {
    const { tokens } = await client.getToken(params.get('code'));
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: CLIENT_ID });
    const user = googleAccount(ticket.getPayload());
    const code = randomBytes(24).toString('hex');
    remember(codes, code, { userId: user.id });
    return { location: withParam(saved.returnTo, 'login', code) };
  } catch (err) {
    console.warn('Google sign-in failed:', err.message);
    return { location: withParam(saved.returnTo, 'login_error', "Google sign-in didn't work. Try again.") };
  }
}

/** The site hands back its one-time code; it gets a normal session. */
export function redeemLoginCode(code) {
  const entry = take(codes, String(code ?? ''), CODE_TTL);
  const user = entry && getData().users[entry.userId];
  if (!user) return { error: 'That sign-in has expired. Try again.' };
  return { user, token: issueToken(user.id) };
}
