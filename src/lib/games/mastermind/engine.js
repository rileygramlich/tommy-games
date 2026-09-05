// Mastermind — one player hides a row of coloured pegs, the other has ten tries
// to work it out. The board never lies: the marks are scored by the engine.
import { makeRng } from '../rng.js';

export const meta = {
  id: 'mastermind',
  name: 'Mastermind',
  tagline: 'Four pegs, six colours, ten guesses. Deduction, not luck.',
  minPlayers: 2,
  maxPlayers: 2,
  defaultPlayers: 2
};

export const COLOURS = [
  { key: 'r', name: 'Red', hex: '#b8433a', letter: 'A' },
  { key: 'o', name: 'Amber', hex: '#c98a2b', letter: 'B' },
  { key: 'y', name: 'Straw', hex: '#d9c25a', letter: 'C' },
  { key: 'g', name: 'Green', hex: '#3f8a55', letter: 'D' },
  { key: 'b', name: 'Blue', hex: '#3a6f9f', letter: 'E' },
  { key: 'p', name: 'Plum', hex: '#6b4a8c', letter: 'F' },
  { key: 'c', name: 'Cocoa', hex: '#7a5230', letter: 'G' },
  { key: 'w', name: 'Bone', hex: '#e6dcc6', letter: 'H' }
];

export function palette(count) {
  return COLOURS.slice(0, count);
}

/** Black marks for right colour in the right hole, white for right colour elsewhere. */
export function markGuess(secret, guess) {
  const exact = secret.reduce((n, peg, i) => n + (guess[i] === peg ? 1 : 0), 0);
  const tally = (list) => {
    const counts = new Map();
    list.forEach((peg, i) => {
      if (secret[i] === guess[i]) return; // already counted as exact
      counts.set(peg, (counts.get(peg) ?? 0) + 1);
    });
    return counts;
  };
  const left = tally(secret);
  const right = tally(guess);
  let colour = 0;
  for (const [peg, n] of right) colour += Math.min(n, left.get(peg) ?? 0);
  return { exact, colour };
}

export function createGame({ players, options = {}, seed = 1 }) {
  if (players.length !== 2) throw new Error('Mastermind seats two players');
  const state = {
    game: 'mastermind',
    seed,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, userId: p.userId ?? null })),
    options: {
      pegs: options.pegs ?? 4,
      colours: options.colours ?? 6,
      repeats: options.repeats !== false,
      maxGuesses: options.maxGuesses ?? 10,
      rounds: options.rounds ?? 4
    },
    round: 0,
    codemaker: seed % 2,
    phase: 'idle',
    secret: null,
    guesses: [],
    solved: false,
    scores: [0, 0],
    roundSummary: null,
    log: [],
    winners: null
  };
  startRound(state);
  return state;
}

function log(state, text) {
  state.log.push({ text });
  if (state.log.length > 200) state.log.shift();
}

export const breakerOf = (state) => 1 - state.codemaker;

function startRound(state) {
  state.round += 1;
  // Roles swap every round, so an even number of rounds is an even contest.
  state.codemaker = (state.seed + state.round) % 2;
  state.secret = null;
  state.guesses = [];
  state.solved = false;
  state.roundSummary = null;
  state.phase = 'setCode';
  log(state, `Round ${state.round}: ${state.players[state.codemaker].name} sets the code.`);
}

export function validCode(state, code) {
  const { pegs, colours, repeats } = state.options;
  if (!Array.isArray(code) || code.length !== pegs) return `Use exactly ${pegs} pegs.`;
  const allowed = palette(colours).map((c) => c.key);
  if (code.some((peg) => !allowed.includes(peg))) return 'That colour is not in play.';
  if (!repeats && new Set(code).size !== code.length) return 'No repeated colours this game.';
  return null;
}

export function legalMoves(state, seat) {
  if (state.phase === 'setCode' && seat === state.codemaker) return [{ type: 'setCode' }];
  if (state.phase === 'guessing' && seat === breakerOf(state)) return [{ type: 'guess' }];
  if (state.phase === 'roundEnd') return [{ type: 'continue' }];
  return [];
}

export function applyMove(state, seat, move) {
  const fail = (error) => ({ ok: false, error });
  if (state.phase === 'gameOver') return fail('The game is over.');

  if (move.type === 'setCode') {
    if (state.phase !== 'setCode') return fail('The code is already set.');
    if (seat !== state.codemaker) return fail('Not your code to set.');
    const problem = validCode(state, move.code);
    if (problem) return fail(problem);
    state.secret = [...move.code];
    state.phase = 'guessing';
    log(state, `${state.players[breakerOf(state)].name} starts guessing.`);
    return { ok: true };
  }

  if (move.type === 'guess') {
    if (state.phase !== 'guessing') return fail('Not the guessing phase.');
    if (seat !== breakerOf(state)) return fail('You are hiding the code, not breaking it.');
    const problem = validCode(state, move.code);
    if (problem) return fail(problem);
    const marks = markGuess(state.secret, move.code);
    state.guesses.push({ code: [...move.code], ...marks });
    log(state, `Guess ${state.guesses.length}: ${marks.exact} black, ${marks.colour} white.`);

    if (marks.exact === state.options.pegs) {
      state.solved = true;
      scoreRound(state);
    } else if (state.guesses.length >= state.options.maxGuesses) {
      state.solved = false;
      scoreRound(state);
    }
    return { ok: true };
  }

  if (move.type === 'continue') {
    if (state.phase !== 'roundEnd') return fail('Nothing to continue.');
    if (state.round >= state.options.rounds) {
      state.phase = 'gameOver';
      const best = Math.max(...state.scores);
      state.winners = state.scores.map((s, i) => (s === best ? i : -1)).filter((i) => i >= 0);
      log(state, `Game over — ${state.winners.map((i) => state.players[i].name).join(' & ')} wins.`);
    } else {
      startRound(state);
    }
    return { ok: true };
  }

  return fail('Unknown move.');
}

// The codemaker scores a point for every guess it took, and one more if the
// code was never broken. Hard codes pay.
function scoreRound(state) {
  const used = state.guesses.length;
  const points = used + (state.solved ? 0 : 1);
  state.scores[state.codemaker] += points;
  state.roundSummary = {
    round: state.round,
    codemaker: state.codemaker,
    breaker: breakerOf(state),
    secret: [...state.secret],
    guesses: used,
    solved: state.solved,
    points
  };
  state.phase = 'roundEnd';
  log(state, state.solved
    ? `Cracked in ${used} — ${state.players[state.codemaker].name} takes ${points}.`
    : `Never cracked — ${state.players[state.codemaker].name} takes ${points}.`);
}

export function view(state, seat) {
  const revealed = state.phase === 'roundEnd' || state.phase === 'gameOver';
  const amCodemaker = seat === state.codemaker;
  return {
    game: 'mastermind',
    seat,
    phase: state.phase,
    round: state.round,
    rounds: state.options.rounds,
    pegs: state.options.pegs,
    colours: palette(state.options.colours),
    repeats: state.options.repeats,
    maxGuesses: state.options.maxGuesses,
    codemaker: state.codemaker,
    breaker: breakerOf(state),
    amCodemaker,
    // The breaker must not see the code until the round is over.
    secret: revealed || amCodemaker ? state.secret : null,
    guesses: state.guesses.map((g) => ({ ...g, code: [...g.code] })),
    left: state.options.maxGuesses - state.guesses.length,
    solved: state.solved,
    players: state.players.map((p, i) => ({
      seat: i, name: p.name, isBot: p.isBot, score: state.scores[i],
      role: i === state.codemaker ? 'codemaker' : 'codebreaker'
    })),
    roundSummary: state.roundSummary,
    log: state.log.slice(-30),
    winners: state.winners
  };
}

export function isOver(state) { return state.phase === 'gameOver'; }

export function activeSeats(state) {
  if (state.phase === 'setCode') return [state.codemaker];
  if (state.phase === 'guessing') return [breakerOf(state)];
  if (state.phase === 'roundEnd') return [state.codemaker];
  return [];
}

/** Every code that could still be the answer, given the marks so far. */
export function consistentCodes({ pegs, colours, repeats }, guesses) {
  const keys = palette(colours).map((c) => c.key);
  const out = [];
  const build = (prefix) => {
    if (prefix.length === pegs) {
      for (const g of guesses) {
        const marks = markGuess(prefix, g.code);
        if (marks.exact !== g.exact || marks.colour !== g.colour) return;
      }
      out.push(prefix.slice());
      return;
    }
    for (const key of keys) {
      if (!repeats && prefix.includes(key)) continue;
      prefix.push(key);
      build(prefix);
      prefix.pop();
    }
  };
  build([]);
  return out;
}
