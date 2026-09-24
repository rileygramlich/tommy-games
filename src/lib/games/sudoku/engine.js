// Sudoku — one grid, one person, no lives. A wrong number costs nothing but the
// time it takes to notice; the grid simply waits until every square is right.
// Pure state machine, like every other game here.
import { makeRng, shuffle } from '../rng.js';

export const meta = {
  id: 'sudoku',
  name: 'Sudoku',
  tagline: 'Nine by nine, no lives. It waits until you get it.',
  minPlayers: 1,
  maxPlayers: 1,
  defaultPlayers: 1
};

export const DIFFICULTIES = {
  easy: { key: 'easy', name: 'Easy', givens: 44 },
  medium: { key: 'medium', name: 'Medium', givens: 34 },
  hard: { key: 'hard', name: 'Hard', givens: 27 }
};

const rowOf = (i) => Math.floor(i / 9);
const colOf = (i) => i % 9;
const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** Every index that shares a row, column or box with this one. */
function peersOf(i) {
  const out = [];
  for (let j = 0; j < 81; j++) {
    if (j === i) continue;
    if (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i)) out.push(j);
  }
  return out;
}
const PEERS = Array.from({ length: 81 }, (_, i) => peersOf(i));

function fits(grid, i, value) {
  for (const j of PEERS[i]) if (grid[j] === value) return false;
  return true;
}

// ---------------------------------------------------------------- generation

// A finished grid, built from the shifted-row pattern and then shuffled about
// so the pattern itself is not recognisable.
function solvedGrid(rng) {
  const pattern = Array.from({ length: 81 }, (_, i) => {
    const r = rowOf(i);
    const c = colOf(i);
    return ((3 * (r % 3)) + Math.floor(r / 3) + c) % 9;
  });
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);

  const rowOrder = [];
  for (const band of shuffle([0, 1, 2], rng)) {
    for (const r of shuffle([0, 1, 2], rng)) rowOrder.push(band * 3 + r);
  }
  const colOrder = [];
  for (const stack of shuffle([0, 1, 2], rng)) {
    for (const c of shuffle([0, 1, 2], rng)) colOrder.push(stack * 3 + c);
  }

  const out = new Array(81);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      out[r * 9 + c] = digits[pattern[rowOrder[r] * 9 + colOrder[c]]];
    }
  }
  return out;
}

/** Counts solutions, stopping once `limit` have been found. */
export function countSolutions(puzzle, limit = 2) {
  const grid = puzzle.slice();
  let found = 0;

  const step = () => {
    // Fewest candidates first, or a 27-given grid takes all afternoon.
    let target = -1;
    let best = 10;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      let options = 0;
      for (let v = 1; v <= 9; v++) if (fits(grid, i, v)) options++;
      if (options < best) { best = options; target = i; }
      if (options === 0) return;
      if (options === 1) break;
    }
    if (target === -1) { found++; return; }
    for (let v = 1; v <= 9; v++) {
      if (!fits(grid, target, v)) continue;
      grid[target] = v;
      step();
      grid[target] = 0;
      if (found >= limit) return;
    }
  };

  step();
  return found;
}

// Take numbers away for as long as exactly one solution survives.
function dig(solution, givens, rng) {
  const puzzle = solution.slice();
  const order = shuffle(Array.from({ length: 81 }, (_, i) => i), rng);
  let remaining = 81;
  for (const i of order) {
    if (remaining <= givens) break;
    const kept = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle, 2) === 1) remaining--;
    else puzzle[i] = kept;
  }
  return puzzle;
}

// ---------------------------------------------------------------- game

export function createGame({ players, options = {}, seed = 1 }) {
  if (players.length !== 1) throw new Error('Sudoku is a one-player grid');
  const level = DIFFICULTIES[options.difficulty] ?? DIFFICULTIES.easy;
  const rng = makeRng(seed);
  const solution = solvedGrid(rng);
  const puzzle = dig(solution, level.givens, rng);

  const state = {
    game: 'sudoku',
    seed,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, userId: p.userId ?? null })),
    options: { difficulty: level.key },
    solution,
    puzzle,
    grid: puzzle.slice(),
    notes: Array.from({ length: 81 }, () => []),
    phase: 'playing',
    placed: 0,
    erased: 0,
    log: [],
    winners: null
  };
  log(state, `${level.name} grid — ${puzzle.filter(Boolean).length} numbers to start.`);
  return state;
}

function log(state, text) {
  state.log.push({ text });
  if (state.log.length > 200) state.log.shift();
}

const isGiven = (state, i) => state.puzzle[i] !== 0;

export function legalMoves(state, seat) {
  if (state.phase !== 'playing' || seat !== 0) return [];
  const out = [];
  for (let i = 0; i < 81; i++) {
    if (!state.grid[i]) out.push({ type: 'place', index: i, value: state.solution[i] });
  }
  return out;
}

function complete(state) {
  return state.grid.every((value, i) => value === state.solution[i]);
}

export function applyMove(state, seat, move) {
  const fail = (error) => ({ ok: false, error });
  if (state.phase === 'gameOver') return fail('The grid is finished.');
  if (seat !== 0) return fail('Sudoku seats one player.');

  const index = Number(move.index);
  if (move.type !== 'continue') {
    if (!Number.isInteger(index) || index < 0 || index > 80) return fail('That square is not on the grid.');
    if (isGiven(state, index)) return fail('That number came with the grid.');
  }

  if (move.type === 'place') {
    const value = Number(move.value);
    if (!Number.isInteger(value) || value < 1 || value > 9) return fail('Numbers run one to nine.');
    state.grid[index] = value;
    state.notes[index] = [];
    state.placed++;
    if (complete(state)) {
      state.phase = 'gameOver';
      state.winners = [0];
      log(state, 'Solved.');
    }
    return { ok: true };
  }

  if (move.type === 'erase') {
    if (!state.grid[index] && !state.notes[index].length) return fail('That square is already empty.');
    state.grid[index] = 0;
    state.notes[index] = [];
    state.erased++;
    return { ok: true };
  }

  if (move.type === 'note') {
    const value = Number(move.value);
    if (!Number.isInteger(value) || value < 1 || value > 9) return fail('Numbers run one to nine.');
    if (state.grid[index]) return fail('Clear the square before pencilling in.');
    const notes = state.notes[index];
    state.notes[index] = notes.includes(value)
      ? notes.filter((n) => n !== value)
      : [...notes, value].sort((a, b) => a - b);
    return { ok: true };
  }

  return fail('Unknown move.');
}

// ---------------------------------------------------------------- seat view

/** Squares holding a number that already appears in their row, column or box. */
function conflicts(grid) {
  const out = new Set();
  for (let i = 0; i < 81; i++) {
    const value = grid[i];
    if (!value) continue;
    for (const j of PEERS[i]) {
      if (grid[j] === value) { out.add(i); out.add(j); }
    }
  }
  return out;
}

export function view(state, seat) {
  const clashing = conflicts(state.grid);
  const left = Array.from({ length: 10 }, () => 9);
  for (const value of state.grid) if (value) left[value]--;

  return {
    game: 'sudoku',
    seat,
    phase: state.phase,
    difficulty: state.options.difficulty,
    difficultyName: DIFFICULTIES[state.options.difficulty].name,
    players: state.players.map((p, i) => ({ seat: i, name: p.name, isBot: p.isBot })),
    cells: state.grid.map((value, i) => ({
      index: i,
      value,
      given: isGiven(state, i),
      conflict: clashing.has(i),
      notes: state.notes[i].slice()
    })),
    // How many of each number are still to be placed, for the keypad.
    remaining: left.slice(1),
    empty: state.grid.filter((v) => !v).length,
    placed: state.placed,
    solved: state.phase === 'gameOver',
    log: state.log.slice(-20),
    winners: state.winners
  };
}

export function isOver(state) {
  return state.phase === 'gameOver';
}

export function activeSeats(state) {
  return state.phase === 'playing' ? [0] : [];
}
