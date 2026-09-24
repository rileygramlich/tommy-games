// Tommy Games online server: WebSocket lobby + authoritative game tables.
// GitHub Pages serves the client; this process is what makes online play work.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { loadStore, flush } from './store.js';
import { register, login, resume, revoke, publicUser } from './auth.js';
import { createDictionary } from '../src/lib/games/quiddler/dictionary.js';
import * as quiddlerEngine from '../src/lib/games/quiddler/engine.js';
import {
  rooms, listRooms, createRoom, joinRoom, leaveRoom, closeRoom, addBot, removeSeat,
  startGame, applyMove, seatView, roomView, setDictionary, ENGINES
} from './rooms.js';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const ALLOWED = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
// Facing the open internet, three things need a ceiling: how hard one address
// may guess at passwords, how many tables may exist at once, and how large a
// single message may be.
const AUTH_ATTEMPTS = Number(process.env.AUTH_ATTEMPTS ?? 20);
const AUTH_WINDOW = Number(process.env.AUTH_WINDOW ?? 60000);
const MAX_ROOMS = Number(process.env.MAX_ROOMS ?? 200);
const MAX_PAYLOAD = Number(process.env.MAX_PAYLOAD ?? 64 * 1024);

const attempts = new Map(); // address -> { count, until }

function tooManyAttempts(address) {
  const now = Date.now();
  const entry = attempts.get(address);
  if (!entry || now > entry.until) {
    attempts.set(address, { count: 1, until: now + AUTH_WINDOW });
    return false;
  }
  entry.count += 1;
  return entry.count > AUTH_ATTEMPTS;
}

// Keep the table from growing without bound on a long-lived server.
setInterval(() => {
  const now = Date.now();
  for (const [address, entry] of attempts) if (now > entry.until) attempts.delete(address);
}, AUTH_WINDOW).unref();

loadStore();
try {
  const dict = createDictionary(readFileSync(join(here, '../public/data/quiddler-words.txt'), 'utf8'));
  quiddlerEngine.setDictionary(dict);
  setDictionary(dict);
  console.log(`word list loaded: ${dict.size} words`);
} catch (err) {
  console.warn('Quiddler word list missing — run `npm run dict`. Wizard still works.', err.message);
}

const http = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, games: Object.keys(ENGINES) }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('Tommy Games server. Connect a WebSocket client.\n');
});

const wss = new WebSocketServer({
  server: http,
  maxPayload: MAX_PAYLOAD,
  verifyClient: ({ origin }) => !ALLOWED.length || !origin || ALLOWED.includes(origin)
});

const clients = new Set();

function send(ws, message) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}
function fail(ws, message) { send(ws, { type: 'error', message }); }

function lobbyBroadcast() {
  const payload = { type: 'lobby', rooms: listRooms() };
  for (const ws of clients) if (ws.user && !ws.roomId) send(ws, payload);
}

function roomBroadcast(room) {
  if (!room || room.closed) return lobbyBroadcast();
  for (const ws of clients) {
    if (ws.roomId !== room.id) continue;
    send(ws, { type: 'room', room: roomView(room) });
    if (room.state) send(ws, { type: 'view', game: room.game, view: seatView(room, ws.user.id) });
  }
  lobbyBroadcast();
}

function currentRoom(ws) {
  return ws.roomId ? rooms.get(ws.roomId) : null;
}

function enterSession(ws, { user, token }) {
  ws.user = user;
  ws.token = token;
  send(ws, { type: 'session', user: publicUser(user), token });
  send(ws, { type: 'lobby', rooms: listRooms() });
}

wss.on('connection', (ws, request) => {
  clients.add(ws);
  ws.address = request?.headers['x-forwarded-for']?.split(',')[0].trim()
    ?? request?.socket?.remoteAddress
    ?? 'unknown';
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  send(ws, { type: 'welcome', server: 'tommy-games', games: Object.keys(ENGINES) });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return fail(ws, 'Malformed message.'); }

    try {
      if (['register', 'login', 'auth'].includes(msg.type) && tooManyAttempts(ws.address)) {
        return fail(ws, 'Too many attempts. Wait a minute and try again.');
      }

      switch (msg.type) {
        case 'register': {
          const result = register(msg.username, msg.password);
          if (result.error) return fail(ws, result.error);
          return enterSession(ws, result);
        }
        case 'login': {
          const result = login(msg.username, msg.password);
          if (result.error) return fail(ws, result.error);
          return enterSession(ws, result);
        }
        case 'auth': {
          const result = resume(msg.token);
          if (result.error) return fail(ws, result.error);
          return enterSession(ws, result);
        }
        case 'logout': {
          if (ws.token) revoke(ws.token);
          const room = currentRoom(ws);
          if (room && ws.user) { leaveRoom(room, ws.user.id); roomBroadcast(room); }
          ws.user = null; ws.roomId = null;
          return send(ws, { type: 'session', user: null, token: null });
        }
      }

      if (!ws.user) return fail(ws, 'Sign in first.');

      switch (msg.type) {
        case 'lobby':
          return send(ws, { type: 'lobby', rooms: listRooms() });

        case 'createRoom': {
          if (rooms.size >= MAX_ROOMS) return fail(ws, 'This server is full. Try again shortly.');
          const room = createRoom({ game: msg.game, name: msg.name, user: ws.user, options: msg.options });
          ws.roomId = room.id;
          return roomBroadcast(room);
        }
        case 'joinRoom': {
          const room = rooms.get(String(msg.roomId ?? '').toUpperCase());
          if (!room) return fail(ws, 'No table with that code.');
          const seat = room.seats.find((s) => s.userId === ws.user.id);
          if (seat) seat.connected = true; // rejoining a game in progress
          else joinRoom(room, ws.user);
          ws.roomId = room.id;
          return roomBroadcast(room);
        }
        case 'leaveRoom': {
          const room = currentRoom(ws);
          ws.roomId = null;
          if (room) { leaveRoom(room, ws.user.id); roomBroadcast(room); }
          return send(ws, { type: 'lobby', rooms: listRooms() });
        }
        case 'addBot': {
          const room = currentRoom(ws);
          if (!room) return fail(ws, 'You are not at a table.');
          if (room.hostId !== ws.user.id) return fail(ws, 'Only the host can add bots.');
          addBot(room);
          return roomBroadcast(room);
        }
        case 'removeSeat': {
          const room = currentRoom(ws);
          if (!room) return fail(ws, 'You are not at a table.');
          if (room.hostId !== ws.user.id) return fail(ws, 'Only the host can remove seats.');
          removeSeat(room, msg.userId);
          return roomBroadcast(room);
        }
        case 'setOptions': {
          const room = currentRoom(ws);
          if (!room || room.hostId !== ws.user.id || room.state) return fail(ws, 'Cannot change the rules now.');
          room.options = { ...room.options, ...msg.options };
          return roomBroadcast(room);
        }
        case 'start': {
          const room = currentRoom(ws);
          if (!room) return fail(ws, 'You are not at a table.');
          if (room.hostId !== ws.user.id) return fail(ws, 'Only the host can deal.');
          startGame(room, roomBroadcast);
          return;
        }
        case 'move': {
          const room = currentRoom(ws);
          if (!room) return fail(ws, 'You are not at a table.');
          applyMove(room, ws.user.id, msg.move, roomBroadcast);
          return;
        }
        case 'chat': {
          const room = currentRoom(ws);
          if (!room) return;
          const text = String(msg.text ?? '').slice(0, 240).trim();
          if (!text) return;
          room.chat.push({ from: ws.user.display, text, at: Date.now() });
          return roomBroadcast(room);
        }
        default:
          return fail(ws, `Unknown message: ${msg.type}`);
      }
    } catch (err) {
      return fail(ws, err.message ?? 'Something went wrong.');
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    const room = currentRoom(ws);
    if (room && ws.user) {
      leaveRoom(room, ws.user.id);
      roomBroadcast(room);
    }
  });
});

// Drop connections that stop answering, so seats do not sit "connected" forever.
setInterval(() => {
  for (const ws of clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000).unref();

// Sweep empty rooms once a minute.
setInterval(() => {
  for (const room of rooms.values()) {
    const live = room.seats.some((s) => !s.isBot && s.connected);
    if (!live) closeRoom(room);
  }
}, 60000).unref();

http.listen(PORT, () => {
  console.log(`Tommy Games server on :${PORT}`);
  if (ALLOWED.length) console.log(`allowed origins: ${ALLOWED.join(', ')}`);
});

// Hosts stop a container by asking politely first. Write the accounts out and
// close the sockets rather than being killed mid-write.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} — closing down.`);
    flush();
    for (const ws of clients) ws.close(1001, 'Server restarting');
    http.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
