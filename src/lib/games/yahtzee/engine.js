// Yahtzee — thirteen turns, three rolls each, and a scorecard with no mercy.
import { makeRng } from '../rng.js';

export const meta = {
  id: 'yahtzee',
  name: 'Yahtzee',
  tagline: 'Five dice, thirteen boxes, no way to fill them all well.',
  minPlayers: 1,
  maxPlayers: 6,
  defaultPlayers: 2
};

export const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const LOWER = ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'];
export const CATEGORIES = [...UPPER, ...LOWER];

export const CATEGORY_LABELS = {
  ones: 'Ones', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes',
  threeKind: 'Three of a kind', fourKind: 'Four of a kind', fullHouse: 'Full house',
  smallStraight: 'Small straight', largeStraight: 'Large straight', yahtzee: 'Yahtzee', chance: 'Chance'
};

const ROUNDS = 13;

export function createGame({ players, options = {}, seed = 1 }) {
  return {
    game: 'yahtzee',
    seed,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, userId: p.userId ?? null })),
    options: { bonusYahtzee: options.bonusYahtzee !== false },
    round: 1,
    turn: 0,
    phase: 'rolling',
    dice: [0, 0, 0, 0, 0],
    held: [false, false, false, false, false],
    rollsLeft: 3,
    rollCount: 0,
    cards: players.map(() => Object.fromEntries(CATEGORIES.map((c) => [c, null]))),
    yahtzeeBonus: players.map(() => 0),
    log: [],
    winners: null
  };
}

function counts(dice) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d] += 1;
  return c;
}

export function scoreFor(category, dice, joker = false) {
  const c = counts(dice);
  const sum = dice.reduce((a, b) => a + b, 0);
  const ofAKind = Math.max(...c.slice(1));
  const runLength = () => {
    let best = 0, run = 0;
    for (let face = 1; face <= 6; face++) {
      run = c[face] ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return best;
  };
  switch (category) {
    case 'ones': case 'twos': case 'threes': case 'fours': case 'fives': case 'sixes': {
      const face = UPPER.indexOf(category) + 1;
      return c[face] * face;
    }
    case 'threeKind': return ofAKind >= 3 ? sum : 0;
    case 'fourKind': return ofAKind >= 4 ? sum : 0;
    // A joker Yahtzee fills the lower boxes at face value.
    case 'fullHouse': return joker || (c.includes(3) && c.includes(2)) || ofAKind === 5 ? 25 : 0;
    case 'smallStraight': return joker || runLength() >= 4 ? 30 : 0;
    case 'largeStraight': return joker || runLength() >= 5 ? 40 : 0;
    case 'yahtzee': return ofAKind === 5 ? 50 : 0;
    case 'chance': return sum;
    default: return 0;
  }
}

// An extra five-of-a-kind after the Yahtzee box is filled with 50.
export function isJoker(state, seat, dice) {
  if (!state.options.bonusYahtzee) return false;
  const five = Math.max(...counts(dice).slice(1)) === 5;
  return five && state.cards[seat].yahtzee === 50;
}

export function upperTotal(card) {
  return UPPER.reduce((sum, c) => sum + (card[c] ?? 0), 0);
}
export function upperBonus(card) {
  return upperTotal(card) >= 63 ? 35 : 0;
}
export function totalFor(card, bonus = 0) {
  const all = CATEGORIES.reduce((sum, c) => sum + (card[c] ?? 0), 0);
  return all + upperBonus(card) + bonus;
}

export function legalMoves(state, seat) {
  if (state.phase !== 'rolling' || state.turn !== seat) return [];
  const moves = [];
  if (state.rollsLeft > 0) moves.push({ type: 'roll' });
  if (state.rollsLeft < 3) {
    for (let i = 0; i < 5; i++) moves.push({ type: 'hold', index: i });
    for (const c of CATEGORIES) {
      if (state.cards[seat][c] === null) moves.push({ type: 'score', category: c });
    }
  }
  return moves;
}

export function applyMove(state, seat, move) {
  const fail = (error) => ({ ok: false, error });
  if (state.phase === 'gameOver') return fail('The game is over.');
  if (state.turn !== seat) return fail('Not your turn.');

  if (move.type === 'roll') {
    if (state.rollsLeft <= 0) return fail('No rolls left — pick a box.');
    state.rollCount += 1;
    const rng = makeRng(state.seed + state.rollCount * 6151);
    for (let i = 0; i < 5; i++) {
      if (state.rollsLeft === 3 || !state.held[i]) state.dice[i] = 1 + Math.floor(rng() * 6);
    }
    if (state.rollsLeft === 3) state.held = [false, false, false, false, false];
    state.rollsLeft -= 1;
    return { ok: true };
  }

  if (move.type === 'hold') {
    if (state.rollsLeft === 3) return fail('Roll first.');
    const i = Number(move.index);
    if (!Number.isInteger(i) || i < 0 || i > 4) return fail('No such die.');
    state.held[i] = !state.held[i];
    return { ok: true };
  }

  if (move.type === 'score') {
    if (state.rollsLeft === 3) return fail('Roll before you score.');
    const card = state.cards[seat];
    if (!CATEGORIES.includes(move.category)) return fail('No such box.');
    if (card[move.category] !== null) return fail('That box is already filled.');

    const joker = isJoker(state, seat, state.dice);
    const value = scoreFor(move.category, state.dice, joker && !UPPER.includes(move.category));
    card[move.category] = value;
    if (joker) state.yahtzeeBonus[seat] += 100;
    state.log.push({
      text: `${state.players[seat].name} takes ${CATEGORY_LABELS[move.category]} for ${value}${joker ? ' (+100 bonus Yahtzee)' : ''}.`
    });
    if (state.log.length > 200) state.log.shift();

    // Next player, and a new round once it comes back around.
    state.dice = [0, 0, 0, 0, 0];
    state.held = [false, false, false, false, false];
    state.rollsLeft = 3;
    const next = (seat + 1) % state.players.length;
    if (next === 0) state.round += 1;
    if (state.round > ROUNDS) {
      state.phase = 'gameOver';
      const totals = state.cards.map((c, i) => totalFor(c, state.yahtzeeBonus[i]));
      const best = Math.max(...totals);
      state.winners = totals.map((t, i) => (t === best ? i : -1)).filter((i) => i >= 0);
      state.log.push({ text: `Final: ${totals.map((t, i) => `${state.players[i].name} ${t}`).join(', ')}.` });
    } else {
      state.turn = next;
    }
    return { ok: true };
  }

  return fail('Unknown move.');
}

export function view(state, seat) {
  return {
    game: 'yahtzee',
    seat,
    phase: state.phase,
    round: state.round,
    rounds: ROUNDS,
    turn: state.turn,
    dice: state.dice.slice(),
    held: state.held.slice(),
    rollsLeft: state.rollsLeft,
    joker: seat != null && state.rollsLeft < 3 && isJoker(state, state.turn, state.dice),
    players: state.players.map((p, i) => ({
      seat: i,
      name: p.name,
      isBot: p.isBot,
      card: { ...state.cards[i] },
      upper: upperTotal(state.cards[i]),
      bonus: upperBonus(state.cards[i]),
      yahtzeeBonus: state.yahtzeeBonus[i],
      total: totalFor(state.cards[i], state.yahtzeeBonus[i])
    })),
    log: state.log.slice(-30),
    winners: state.winners
  };
}

export function isOver(state) { return state.phase === 'gameOver'; }
export function activeSeats(state) { return state.phase === 'rolling' ? [state.turn] : []; }
