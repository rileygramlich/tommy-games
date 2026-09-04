// End-to-end check of the online path: two accounts, a shared table, a bot in
// the third seat, and a full game of Wizard played over WebSockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import * as wizardBot from '../src/lib/games/wizard/bot.js';

const PORT = 8900 + (process.pid % 400);
const dataDir = mkdtempSync(join(tmpdir(), 'tommy-games-test-'));

function startServer() {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, BOT_DELAY: '0', TRICK_PAUSE: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return new Promise((resolve, reject) => {
    child.stdout.on('data', (buf) => {
      if (buf.toString().includes('server on')) resolve(child);
    });
    child.stderr.on('data', (buf) => reject(new Error(buf.toString())));
    setTimeout(() => reject(new Error('server did not start')), 8000).unref();
  });
}

class Client {
  constructor(name) {
    this.name = name;
    this.handlers = [];
    this.seat = null;
    this.view = null;
    this.room = null;
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    this.ready = new Promise((resolve) => this.ws.once('open', resolve));
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'room') this.room = msg.room;
      if (msg.type === 'view') { this.view = msg.view; this.seat = msg.view.seat; }
      if (msg.type === 'error') this.lastError = msg.message;
      this.handlers = this.handlers.filter((h) => !h(msg));
    });
  }
  send(msg) { this.ws.send(JSON.stringify(msg)); }
  await_(predicate, label = 'message', timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), timeout);
      this.handlers.push((msg) => {
        if (!predicate(msg)) return false;
        clearTimeout(timer);
        resolve(msg);
        return true;
      });
    });
  }
  close() { this.ws.close(); }
}

test('two players and a bot finish a game of Wizard online', async (t) => {
  const server = await startServer();
  t.after(() => { server.kill(); rmSync(dataDir, { recursive: true, force: true }); });

  const alice = new Client('alice');
  const bob = new Client('bob');
  await Promise.all([alice.ready, bob.ready]);

  const aliceSession = alice.await_((m) => m.type === 'session', 'alice session');
  alice.send({ type: 'register', username: 'alice', password: 'felt-table' });
  assert.equal((await aliceSession).user.name, 'alice');

  const bobSession = bob.await_((m) => m.type === 'session', 'bob session');
  bob.send({ type: 'register', username: 'bob', password: 'felt-table' });
  await bobSession;

  // A name cannot be taken twice.
  const dupe = bob.await_((m) => m.type === 'error', 'duplicate name error');
  bob.send({ type: 'register', username: 'alice', password: 'another' });
  assert.match((await dupe).message, /taken/);

  const roomMsg = alice.await_((m) => m.type === 'room', 'room created');
  alice.send({ type: 'createRoom', game: 'wizard', name: 'Test table' });
  const code = (await roomMsg).room.id;

  const joined = bob.await_((m) => m.type === 'room', 'bob joined');
  bob.send({ type: 'joinRoom', roomId: code });
  assert.equal((await joined).room.seats.length, 2);

  const botAdded = alice.await_((m) => m.type === 'room' && m.room.seats.length === 3, 'bot seat');
  alice.send({ type: 'addBot' });
  await botAdded;

  // Only the host may deal.
  const denied = bob.await_((m) => m.type === 'error', 'non-host start rejected');
  bob.send({ type: 'start' });
  assert.match((await denied).message, /host/);

  // Register the play handlers before dealing: with the bot delay at zero the
  // server can run several turns before the next line of this test executes.
  const finished = Promise.all([alice, bob].map((client) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${client.name} never saw the game end`)), 60000);
      client.handlers.push((msg) => {
        if (msg.type !== 'view') return false;
        const v = msg.view;
        if (v.phase === 'gameOver') { clearTimeout(timer); resolve(v); return true; }
        if (v.phase === 'roundEnd') { client.send({ type: 'move', move: { type: 'continue' } }); return false; }
        if (v.turn === v.seat && ['bidding', 'playing', 'chooseTrump'].includes(v.phase)) {
          client.send({ type: 'move', move: wizardBot.chooseMove(v) });
        }
        return false;
      });
    })
  ));

  alice.send({ type: 'start' });
  const [aliceEnd, bobEnd] = await finished;
  assert.equal(aliceEnd.round, aliceEnd.rounds);
  assert.deepEqual(aliceEnd.players.map((p) => p.score), bobEnd.players.map((p) => p.score));
  assert.ok(aliceEnd.winners.length >= 1);

  // Nobody ever saw anyone else's cards.
  assert.equal(aliceEnd.hand.length, 0);
  assert.ok(aliceEnd.players.every((p) => p.cards === 0));

  alice.close();
  bob.close();
  await new Promise((r) => setTimeout(r, 300));

  const users = JSON.parse(readFileSync(join(dataDir, 'users.json'), 'utf8')).users;
  assert.equal(users.alice.stats.wizard.played, 1);
  assert.equal(users.alice.stats.wizard.won + users.bob.stats.wizard.won <= 2, true);
  assert.equal(users.alice.hash.length, 64, 'passwords are stored hashed, never in the clear');
  assert.equal(JSON.stringify(users).includes('felt-table'), false);
});
