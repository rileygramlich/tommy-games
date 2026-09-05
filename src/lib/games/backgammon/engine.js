// Backgammon. Points are indexed 0-23 from seat 1's side of the board:
// seat 0 runs 23 -> 0 and bears off past 0, seat 1 runs 0 -> 23 and bears off
// past 23. Checkers are stored signed: positive is seat 0, negative is seat 1.
//
// No doubling cube — a game is worth one point, two for a gammon, three for a
// backgammon, and a match runs to a target score.
import { makeRng } from '../rng.js';

export const meta = {
  id: 'backgammon',
  name: 'Backgammon',
  tagline: 'Race, block, hit. The dice decide, the board decides better.',
  minPlayers: 2,
  maxPlayers: 2,
  defaultPlayers: 2
};

export const POINTS = 24;
export const dirOf = (seat) => (seat === 0 ? -1 : 1);
export const homeRange = (seat) => (seat === 0 ? [0, 5] : [18, 23]);
export const entryIndex = (seat, die) => (seat === 0 ? 24 - die : die - 1);
/** Pips this checker still needs to come off. */
export const pipsToOff = (seat, index) => (seat === 0 ? index + 1 : 24 - index);

export const countAt = (points, index, seat) =>
  seat === 0 ? Math.max(0, points[index]) : Math.max(0, -points[index]);
export const ownerAt = (points) => (v) => (v > 0 ? 0 : v < 0 ? 1 : null);

export function startingPoints() {
  const points = new Array(POINTS).fill(0);
  points[23] = 2; points[12] = 5; points[7] = 3; points[5] = 5;      // seat 0
  points[0] = -2; points[11] = -5; points[16] = -3; points[18] = -5; // seat 1
  return points;
}

export function createGame({ players, options = {}, seed = 1 }) {
  if (players.length !== 2) throw new Error('Backgammon seats two players');
  const state = {
    game: 'backgammon',
    seed,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, userId: p.userId ?? null })),
    options: { target: options.target ?? 5 },
    gameNo: 1,
    points: startingPoints(),
    bar: [0, 0],
    off: [0, 0],
    turn: seed % 2,
    phase: 'roll',
    dice: [],
    diceLeft: [],
    rollCount: 0,
    playedThisTurn: [],
    lastResult: null,
    scores: [0, 0],
    log: [],
    winners: null
  };
  log(state, `${state.players[state.turn].name} goes first.`);
  return state;
}

function log(state, text) {
  state.log.push({ text });
  if (state.log.length > 200) state.log.shift();
}

// ---------------------------------------------------------------- movement

export function allHome(points, bar, seat) {
  if (bar[seat] > 0) return false;
  const [lo, hi] = homeRange(seat);
  for (let i = 0; i < POINTS; i++) {
    if (i >= lo && i <= hi) continue;
    if (countAt(points, i, seat) > 0) return false;
  }
  return true;
}

function canLand(points, index, seat) {
  const opposing = countAt(points, index, 1 - seat);
  return opposing <= 1;
}

/** Every single-checker move available with one die value. */
export function movesForDie(points, bar, seat, die) {
  const out = [];
  if (bar[seat] > 0) {
    const entry = entryIndex(seat, die);
    if (canLand(points, entry, seat)) out.push({ from: 'bar', to: entry, die });
    return out;
  }
  const home = allHome(points, bar, seat);
  const [lo, hi] = homeRange(seat);
  for (let i = 0; i < POINTS; i++) {
    if (countAt(points, i, seat) === 0) continue;
    const to = i + dirOf(seat) * die;
    if (to >= 0 && to < POINTS) {
      if (canLand(points, to, seat)) out.push({ from: i, to, die });
      continue;
    }
    if (!home) continue;
    const pips = pipsToOff(seat, i);
    if (die === pips) { out.push({ from: i, to: 'off', die }); continue; }
    if (die > pips) {
      // Only from the back-most point in the home board.
      let higher = false;
      for (let j = lo; j <= hi; j++) {
        if (pipsToOff(seat, j) > pips && countAt(points, j, seat) > 0) { higher = true; break; }
      }
      if (!higher) out.push({ from: i, to: 'off', die });
    }
  }
  return out;
}

export function applySingle(points, bar, off, seat, move) {
  const other = 1 - seat;
  const sign = seat === 0 ? 1 : -1;
  if (move.from === 'bar') bar[seat] -= 1;
  else points[move.from] -= sign;
  if (move.to === 'off') {
    off[seat] += 1;
    return;
  }
  if (countAt(points, move.to, other) === 1) {
    points[move.to] = 0;
    bar[other] += 1;
  }
  points[move.to] += sign;
}

function clone(state) {
  return {
    points: state.points.slice(),
    bar: state.bar.slice(),
    off: state.off.slice()
  };
}

/** How many of the remaining dice can still be played, and with which first moves. */
export function playableDepth(points, bar, off, seat, dice) {
  let best = 0;
  const firsts = new Map();
  const walk = (p, b, o, remaining, depth, firstKey, firstMove) => {
    if (depth > best) best = depth;
    if (depth >= 1) {
      const entry = firsts.get(firstKey);
      if (!entry || depth > entry.depth) firsts.set(firstKey, { depth, move: firstMove });
    }
    if (!remaining.length) return;
    const tried = new Set();
    for (let d = 0; d < remaining.length; d++) {
      const die = remaining[d];
      if (tried.has(die)) continue;
      tried.add(die);
      const rest = remaining.slice(0, d).concat(remaining.slice(d + 1));
      for (const move of movesForDie(p, b, seat, die)) {
        const np = p.slice(), nb = b.slice(), no = o.slice();
        applySingle(np, nb, no, seat, move);
        const key = depth === 0 ? `${move.from}:${move.to}:${move.die}` : firstKey;
        walk(np, nb, no, rest, depth + 1, key, depth === 0 ? move : firstMove);
      }
    }
  };
  walk(points, bar, off, dice, 0, null, null);
  return { best, firsts };
}

export function legalMoves(state, seat) {
  if (state.turn !== seat) return [];
  if (state.phase === 'roll') return [{ type: 'roll' }];
  if (state.phase === 'turnEnd' || state.phase === 'gameEnd') return [{ type: 'continue' }];
  if (state.phase !== 'move') return [];
  const { best, firsts } = playableDepth(state.points, state.bar, state.off, seat, state.diceLeft);
  if (best === 0) return [{ type: 'continue' }];
  const out = [];
  for (const { depth, move } of firsts.values()) {
    if (depth < best) continue;
    out.push({ type: 'move', from: move.from, to: move.to, die: move.die });
  }
  // With only one die playable, the rules say it must be the larger one.
  if (best === 1 && state.diceLeft.length > 1) {
    const largest = Math.max(...out.map((m) => m.die));
    return out.filter((m) => m.die === largest);
  }
  return out;
}

// ---------------------------------------------------------------- moves

export function applyMove(state, seat, move) {
  const fail = (error) => ({ ok: false, error });
  if (state.phase === 'gameOver') return fail('The match is over.');
  if (state.turn !== seat && move.type !== 'continue') return fail('Not your turn.');

  if (move.type === 'roll') {
    if (state.phase !== 'roll') return fail('You have already rolled.');
    state.rollCount += 1;
    const rng = makeRng(state.seed + state.rollCount * 4517 + state.gameNo * 131);
    const a = 1 + Math.floor(rng() * 6);
    const b = 1 + Math.floor(rng() * 6);
    state.dice = [a, b];
    state.diceLeft = a === b ? [a, a, a, a] : [a, b];
    state.playedThisTurn = [];
    state.phase = 'move';
    log(state, `${state.players[seat].name} rolls ${a} and ${b}${a === b ? ' — doubles' : ''}.`);
    if (!legalMoves(state, seat).some((m) => m.type === 'move')) {
      state.phase = 'turnEnd';
      log(state, `${state.players[seat].name} is stuck and cannot move.`);
    }
    return { ok: true };
  }

  if (move.type === 'move') {
    if (state.phase !== 'move') return fail('Roll first.');
    const legal = legalMoves(state, seat).filter((m) => m.type === 'move');
    const from = move.from === 'bar' ? 'bar' : Number(move.from);
    const to = move.to === 'off' ? 'off' : Number(move.to);
    const match = legal.find((m) => m.from === from && m.to === to && (move.die == null || m.die === move.die));
    if (!match) return fail('That is not a legal move with these dice.');

    const hit = to !== 'off' && countAt(state.points, to, 1 - seat) === 1;
    applySingle(state.points, state.bar, state.off, seat, match);
    state.diceLeft.splice(state.diceLeft.indexOf(match.die), 1);
    state.playedThisTurn.push({ ...match, hit });
    log(state, `${state.players[seat].name} plays ${describe(match, seat)}${hit ? ' and hits' : ''}.`);

    if (state.off[seat] === 15) { finishGame(state, seat); return { ok: true }; }
    if (!state.diceLeft.length || !legalMoves(state, seat).some((m) => m.type === 'move')) {
      state.phase = 'turnEnd';
    }
    return { ok: true };
  }

  if (move.type === 'continue') {
    if (state.phase === 'turnEnd') {
      state.turn = 1 - state.turn;
      state.phase = 'roll';
      state.dice = [];
      state.diceLeft = [];
      return { ok: true };
    }
    if (state.phase === 'gameEnd') {
      const target = state.options.target;
      if (state.scores.some((s) => s >= target)) {
        state.phase = 'gameOver';
        state.winners = [state.scores[0] >= target ? 0 : 1];
        log(state, `${state.players[state.winners[0]].name} takes the match.`);
      } else {
        newGame(state);
      }
      return { ok: true };
    }
    if (state.phase === 'move') {
      // Nothing legal left to do with the remaining dice.
      if (legalMoves(state, seat).some((m) => m.type === 'move')) return fail('You still have a move.');
      state.phase = 'turnEnd';
      return { ok: true };
    }
    return fail('Nothing to continue.');
  }

  return fail('Unknown move.');
}

function describe(move, seat) {
  const label = (spot) => {
    if (spot === 'bar') return 'bar';
    if (spot === 'off') return 'off';
    return String(seat === 0 ? spot + 1 : 24 - spot);
  };
  return `${label(move.from)}/${label(move.to)}`;
}

function finishGame(state, seat) {
  const loser = 1 - seat;
  const [lo, hi] = homeRange(seat);
  let points = 1;
  let kind = 'a single game';
  if (state.off[loser] === 0) {
    const stragglers = state.bar[loser] > 0
      || Array.from({ length: hi - lo + 1 }, (_, k) => lo + k).some((i) => countAt(state.points, i, loser) > 0);
    points = stragglers ? 3 : 2;
    kind = stragglers ? 'a backgammon' : 'a gammon';
  }
  state.scores[seat] += points;
  state.lastResult = { winner: seat, points, kind };
  state.phase = 'gameEnd';
  log(state, `${state.players[seat].name} wins ${kind} for ${points}.`);
}

function newGame(state) {
  state.gameNo += 1;
  state.points = startingPoints();
  state.bar = [0, 0];
  state.off = [0, 0];
  state.dice = [];
  state.diceLeft = [];
  state.playedThisTurn = [];
  state.lastResult = null;
  state.turn = (state.seed + state.gameNo) % 2;
  state.phase = 'roll';
  log(state, `Game ${state.gameNo}: ${state.players[state.turn].name} to roll.`);
}

export function pipCount(points, bar, seat) {
  let total = bar[seat] * 25;
  for (let i = 0; i < POINTS; i++) total += countAt(points, i, seat) * pipsToOff(seat, i);
  return total;
}

export function view(state, seat) {
  const moves = seat != null && state.turn === seat && state.phase === 'move'
    ? legalMoves(state, seat).filter((m) => m.type === 'move')
    : [];
  return {
    game: 'backgammon',
    seat,
    phase: state.phase,
    gameNo: state.gameNo,
    target: state.options.target,
    turn: state.turn,
    points: state.points.slice(),
    bar: state.bar.slice(),
    off: state.off.slice(),
    dice: state.dice.slice(),
    diceLeft: state.diceLeft.slice(),
    moves,
    playedThisTurn: state.playedThisTurn.slice(),
    lastResult: state.lastResult,
    players: state.players.map((p, i) => ({
      seat: i, name: p.name, isBot: p.isBot,
      score: state.scores[i], off: state.off[i], bar: state.bar[i],
      pips: pipCount(state.points, state.bar, i)
    })),
    log: state.log.slice(-30),
    winners: state.winners
  };
}

export function isOver(state) { return state.phase === 'gameOver'; }
export function activeSeats(state) {
  if (state.phase === 'gameOver') return [];
  return [state.turn];
}
