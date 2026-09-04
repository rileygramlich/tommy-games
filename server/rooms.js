// Rooms, seats, and the authoritative game loop for online tables.
import { randomBytes } from 'node:crypto';
import * as wizardEngine from '../src/lib/games/wizard/engine.js';
import * as wizardBot from '../src/lib/games/wizard/bot.js';
import * as quiddlerEngine from '../src/lib/games/quiddler/engine.js';
import * as quiddlerBot from '../src/lib/games/quiddler/bot.js';
import { randomSeed } from '../src/lib/games/rng.js';
import { recordResult } from './auth.js';

const ENGINES = {
  wizard: { engine: wizardEngine, bot: wizardBot, ...wizardEngine.meta },
  quiddler: { engine: quiddlerEngine, bot: quiddlerBot, ...quiddlerEngine.meta }
};

const BOT_NAMES = ['Marigold', 'Bishop', 'Juniper', 'Vex', 'Clementine', 'Sable', 'Orrin'];
// Pacing, in milliseconds. Tests turn these down to zero.
const BOT_DELAY = Number(process.env.BOT_DELAY ?? 900);
const TRICK_PAUSE = Number(process.env.TRICK_PAUSE ?? 1600);
const ABSENT_GRACE = Number(process.env.ABSENT_GRACE ?? 8000); // then a bot plays for them

export const rooms = new Map();
let dictionary = null;
export function setDictionary(dict) { dictionary = dict; }

function code() {
  return randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
}

export function listRooms() {
  return [...rooms.values()]
    .filter((room) => !room.closed)
    .map((room) => ({
      id: room.id,
      name: room.name,
      game: room.game,
      host: room.seats.find((s) => s.userId === room.hostId)?.name ?? '—',
      players: room.seats.filter((s) => !s.isBot).length,
      seats: room.seats.length,
      started: !!room.state,
      maxSeats: ENGINES[room.game].maxPlayers
    }));
}

export function createRoom({ game, name, user, options = {} }) {
  if (!ENGINES[game]) throw new Error('Unknown game.');
  const id = code();
  const room = {
    id,
    game,
    name: name?.trim() || `${ENGINES[game].name} table`,
    hostId: user.id,
    options,
    seats: [{ userId: user.id, name: user.display, isBot: false, connected: true }],
    state: null,
    timer: null,
    closed: false,
    chat: []
  };
  rooms.set(id, room);
  return room;
}

export function roomView(room) {
  return {
    id: room.id,
    name: room.name,
    game: room.game,
    gameName: ENGINES[room.game].name,
    hostId: room.hostId,
    options: room.options,
    started: !!room.state,
    minSeats: ENGINES[room.game].minPlayers,
    maxSeats: ENGINES[room.game].maxPlayers,
    seats: room.seats.map((s) => ({
      userId: s.userId, name: s.name, isBot: s.isBot, connected: s.connected
    })),
    chat: room.chat.slice(-30)
  };
}

export function joinRoom(room, user) {
  if (room.state) throw new Error('That game has already started.');
  if (room.seats.some((s) => s.userId === user.id)) return room;
  if (room.seats.length >= ENGINES[room.game].maxPlayers) throw new Error('That table is full.');
  room.seats.push({ userId: user.id, name: user.display, isBot: false, connected: true });
  return room;
}

export function addBot(room) {
  if (room.state) throw new Error('That game has already started.');
  if (room.seats.length >= ENGINES[room.game].maxPlayers) throw new Error('That table is full.');
  const used = new Set(room.seats.map((s) => s.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${room.seats.length + 1}`;
  room.seats.push({ userId: `bot:${name}:${room.id}`, name, isBot: true, connected: true });
}

export function removeSeat(room, userId) {
  if (room.state) return;
  room.seats = room.seats.filter((s) => s.userId !== userId);
}

export function leaveRoom(room, userId) {
  if (!room.state) {
    removeSeat(room, userId);
    if (!room.seats.some((s) => !s.isBot)) closeRoom(room);
    else if (room.hostId === userId) room.hostId = room.seats.find((s) => !s.isBot).userId;
  } else {
    const seat = room.seats.find((s) => s.userId === userId);
    if (seat) seat.connected = false;
  }
}

export function closeRoom(room) {
  clearTimeout(room.timer);
  room.closed = true;
  rooms.delete(room.id);
}

export function startGame(room, broadcast) {
  const spec = ENGINES[room.game];
  if (room.seats.length < spec.minPlayers) throw new Error(`${spec.name} needs at least ${spec.minPlayers} players.`);
  if (room.game === 'quiddler' && !dictionary) throw new Error('The word list is not loaded on this server.');
  room.state = spec.engine.createGame({
    players: room.seats.map((s) => ({ name: s.name, isBot: s.isBot, userId: s.userId })),
    options: room.options,
    seed: randomSeed()
  });
  schedule(room, broadcast);
}

export function applyMove(room, userId, move, broadcast) {
  const spec = ENGINES[room.game];
  if (!room.state) throw new Error('That game has not started.');
  const seat = room.seats.findIndex((s) => s.userId === userId);
  if (seat === -1) throw new Error('You are not seated at this table.');
  // Pauses between tricks and rounds can be cleared by anyone at the table;
  // every other move has to come from the seat the engine is waiting on.
  const active = spec.engine.activeSeats(room.state)[0];
  const actor = move.type === 'continue' ? active : seat;
  const result = spec.engine.applyMove(room.state, actor, move);
  if (!result.ok) throw new Error(result.error);
  schedule(room, broadcast);
}

export function seatView(room, userId) {
  const spec = ENGINES[room.game];
  if (!room.state) return null;
  const seat = room.seats.findIndex((s) => s.userId === userId);
  const view = spec.engine.view(room.state, seat === -1 ? null : seat);
  view.activeSeat = spec.engine.activeSeats(room.state)[0] ?? null;
  return view;
}

// The server drives bots, absent players, and the pause after each trick.
function schedule(room, broadcast) {
  clearTimeout(room.timer);
  broadcast(room);
  const spec = ENGINES[room.game];
  if (!room.state || spec.engine.isOver(room.state)) {
    if (room.state && spec.engine.isOver(room.state) && !room.recorded) {
      room.recorded = true;
      const winners = new Set(room.state.winners ?? []);
      room.seats.forEach((s, i) => {
        if (!s.isBot) recordResult(s.userId, room.game, winners.has(i));
      });
    }
    return;
  }
  const active = spec.engine.activeSeats(room.state)[0];
  if (active == null) return;
  const phase = room.state.phase;

  if (phase === 'trickEnd') {
    room.timer = setTimeout(() => step(room, active, { type: 'continue' }, broadcast), TRICK_PAUSE);
    return;
  }
  const seat = room.seats[active];
  if (phase === 'roundEnd') {
    // Humans read the scoreboard at their own pace; an all-bot table moves on.
    if (room.seats.every((s) => s.isBot || !s.connected)) {
      room.timer = setTimeout(() => step(room, active, { type: 'continue' }, broadcast), TRICK_PAUSE);
    }
    return;
  }
  if (seat.isBot) {
    room.timer = setTimeout(() => botMove(room, active, broadcast), BOT_DELAY);
  } else if (!seat.connected) {
    room.timer = setTimeout(() => botMove(room, active, broadcast), ABSENT_GRACE);
  }
}

function botMove(room, seat, broadcast) {
  const spec = ENGINES[room.game];
  try {
    const view = spec.engine.view(room.state, seat);
    const move = spec.bot.chooseMove(view, Math.random, dictionary);
    const result = spec.engine.applyMove(room.state, seat, move);
    if (!result.ok) {
      const fallback = spec.engine.legalMoves(room.state, seat)[0];
      if (fallback) spec.engine.applyMove(room.state, seat, fallback);
    }
  } catch (err) {
    console.error('bot failure', err);
  }
  schedule(room, broadcast);
}

function step(room, seat, move, broadcast) {
  const spec = ENGINES[room.game];
  spec.engine.applyMove(room.state, seat, move);
  schedule(room, broadcast);
}

export { ENGINES };
