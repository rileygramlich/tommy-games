// Coup — two influences, a pile of coins, and no obligation to tell the truth.
//
// Responses are taken in turn order rather than as a free-for-all race: when an
// action needs answering, each other player is asked in turn whether they
// challenge, block or allow it. Everything else follows the printed game.
import { makeRng, shuffle } from '../rng.js';
import { CHARACTERS, ACTIONS, SETS, blockersFor, blockIsPublic } from './characters.js';

export const meta = {
  id: 'coup',
  name: 'Coup',
  tagline: 'Two cards, ten coins, and whatever you can get away with saying.',
  minPlayers: 2,
  maxPlayers: 6,
  defaultPlayers: 4
};

export const FACTIONS = ['Loyalists', 'Reformers'];

export function createGame({ players, options = {}, seed = 1 }) {
  const n = players.length;
  if (n < 2 || n > 6) throw new Error('Coup seats two to six players');

  const set = SETS[options.set ?? 'classic'] ?? SETS.classic;
  const characters = options.characters?.length === 5 ? options.characters : set.characters;
  // Three of each is the printed deck; more players need a deeper one.
  const copies = Math.max(3, Math.ceil((n * 2 + 3) / characters.length));

  const rng = makeRng(seed);
  const deck = [];
  let id = 0;
  for (const key of characters) {
    for (let c = 0; c < copies; c++) deck.push({ id: `c${id++}`, character: key });
  }
  shuffle(deck, rng);

  const state = {
    game: 'coup',
    seed,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, userId: p.userId ?? null })),
    options: {
      set: set.key,
      characters,
      factions: !!options.factions,
      // Seconds a player gets to call a bluff before the table moves on without
      // them. The clock itself is drawn by the table; the engine only carries
      // the setting so every seat agrees on the length. Zero means no clock.
      challengeSeconds: options.challengeSeconds == null ? 10 : Math.max(0, Number(options.challengeSeconds) || 0),
      copies
    },
    deck,
    hands: Array.from({ length: n }, () => deck.splice(0, 2)),
    revealed: Array.from({ length: n }, () => []),
    // Two coins each; heads-up, the player who starts gets one, as printed.
    coins: Array.from({ length: n }, (_, i) => (n === 2 && i === seed % n ? 1 : 2)),
    reserve: 0,
    allegiance: Array.from({ length: n }, (_, i) => i % 2),
    turn: seed % n,
    phase: 'action',
    pending: null,
    losing: null,
    exchange: null,
    interrogation: null,
    log: [],
    winners: null
  };
  log(state, `${state.players[state.turn].name} starts.`);
  return state;
}

function log(state, text) {
  state.log.push({ text });
  if (state.log.length > 300) state.log.shift();
}

// ---------------------------------------------------------------- helpers

export const isOut = (state, seat) => state.revealed[seat].length >= 2;
export const living = (state) => state.players.map((p, i) => i).filter((i) => !isOut(state, i));

function livingAfter(state, seat) {
  const n = state.players.length;
  const out = [];
  for (let step = 1; step < n; step++) {
    const s = (seat + step) % n;
    if (!isOut(state, s)) out.push(s);
  }
  return out;
}

export function holds(state, seat, character) {
  return state.hands[seat].some((card) => card.character === character);
}

function drawCard(state) {
  if (!state.deck.length) return null;
  return state.deck.pop();
}

/** Reveal the named card, shuffle it back, and take a fresh one. */
function swapCard(state, seat, character) {
  const index = state.hands[seat].findIndex((card) => card.character === character);
  if (index === -1) return;
  const [card] = state.hands[seat].splice(index, 1);
  state.deck.push(card);
  const rng = makeRng(state.seed + state.deck.length * 31 + state.log.length);
  shuffle(state.deck, rng);
  const fresh = drawCard(state);
  if (fresh) state.hands[seat].push(fresh);
  log(state, `${state.players[seat].name} shows the ${CHARACTERS[character].name} and takes a new card.`);
}

/** True when this player is the only one left flying their colours. */
export function lastOfFaction(state, seat) {
  if (!state.options.factions) return false;
  const mine = state.allegiance[seat];
  return living(state).filter((s) => state.allegiance[s] === mine).length <= 1;
}

export function sameFaction(state, a, b) {
  return state.options.factions && state.allegiance[a] === state.allegiance[b];
}

// ---------------------------------------------------------------- turn flow

function endTurn(state) {
  state.pending = null;
  state.losing = null;
  state.exchange = null;
  state.interrogation = null;
  if (checkWin(state)) return;
  const next = livingAfter(state, state.turn)[0];
  state.turn = next;
  state.phase = 'action';
}

function checkWin(state) {
  const alive = living(state);
  if (alive.length <= 1) {
    state.phase = 'gameOver';
    state.winners = alive;
    log(state, alive.length ? `${state.players[alive[0]].name} is the last one standing.` : 'Nobody is left.');
    return true;
  }
  if (state.options.factions) {
    const faction = state.allegiance[alive[0]];
    if (alive.every((s) => state.allegiance[s] === faction)) {
      state.phase = 'gameOver';
      state.winners = alive;
      log(state, `Only ${FACTIONS[faction]} remain — they win together.`);
      return true;
    }
  }
  return false;
}

function loseInfluence(state, seat, after, reason = '') {
  if (isOut(state, seat)) return dispatch(state, after);
  const hand = state.hands[seat];
  if (hand.length === 1) {
    revealCard(state, seat, hand[0].id, reason);
    return dispatch(state, after);
  }
  state.losing = { seat, after, reason };
  state.phase = 'lose';
}

function revealCard(state, seat, cardId, reason = '') {
  const index = state.hands[seat].findIndex((card) => card.id === cardId);
  if (index === -1) return false;
  const [card] = state.hands[seat].splice(index, 1);
  state.revealed[seat].push(card);
  log(state, `${state.players[seat].name} turns over the ${CHARACTERS[card.character].name}${reason ? ` — ${reason}` : ''}.`);
  if (isOut(state, seat)) log(state, `${state.players[seat].name} is out.`);
  return true;
}

// The one place that knows what happens after somebody loses a card.
function dispatch(state, after) {
  if (state.phase === 'gameOver') return;
  switch (after) {
    case 'endTurn': return endTurn(state);
    case 'actionFails':
      log(state, 'The action fails.');
      return endTurn(state);
    case 'afterActorDefends': return afterActorDefends(state);
    case 'blockStands':
      log(state, 'The block stands.');
      return endTurn(state);
    case 'resolveAction': return resolveAction(state);
    default: return endTurn(state);
  }
}

// ---------------------------------------------------------------- actions

function actionCost(state, actionKey, move) {
  if (actionKey === 'convert') return move.target === state.turn || move.target == null ? 1 : 2;
  return ACTIONS[actionKey].cost ?? 0;
}

export function legalActions(state, seat) {
  if (state.phase !== 'action' || state.turn !== seat) return [];
  const coins = state.coins[seat];
  const others = living(state).filter((s) => s !== seat);
  const strikeTargets = others.filter((s) => !sameFaction(state, seat, s));
  const out = [];

  // Ten coins in hand and a coup is the only thing on the table.
  if (coins >= 10) {
    for (const target of strikeTargets) out.push({ type: 'action', action: 'coup', target });
    return out;
  }

  out.push({ type: 'action', action: 'income' });
  out.push({ type: 'action', action: 'foreignAid' });
  if (coins >= 7) for (const target of strikeTargets) out.push({ type: 'action', action: 'coup', target });

  for (const key of state.options.characters) {
    const character = CHARACTERS[key];
    if (!character.action) continue;
    const action = ACTIONS[character.action];
    if (action.cost && coins < action.cost) continue;
    if (character.action === 'embezzle' && !state.options.factions) continue;
    if (action.target) {
      const targets = character.action === 'assassinate' ? strikeTargets
        : character.action === 'steal' ? strikeTargets.filter((s) => state.coins[s] > 0)
        : others;
      for (const target of targets) out.push({ type: 'action', action: character.action, target });
    } else {
      out.push({ type: 'action', action: character.action });
    }
  }

  if (state.options.factions) {
    // Converting flips a player to the other side, and it may not be used to
    // empty a faction: the game has to be won, not tidied away for a coin.
    if (coins >= 1 && !lastOfFaction(state, seat)) out.push({ type: 'action', action: 'convert', target: seat });
    if (coins >= 2) {
      for (const target of others) {
        if (!lastOfFaction(state, target)) out.push({ type: 'action', action: 'convert', target });
      }
    }
  }
  return out;
}

export function legalMoves(state, seat) {
  if (state.phase === 'action') return legalActions(state, seat);
  if (state.phase === 'lose' && state.losing?.seat === seat) {
    return state.hands[seat].map((card) => ({ type: 'reveal', cardId: card.id }));
  }
  if (state.phase === 'exchange' && state.exchange?.seat === seat) return [{ type: 'keep' }];
  if (state.phase === 'interrogate' && state.interrogation?.actor === seat) {
    return [{ type: 'interrogation', swap: false }, { type: 'interrogation', swap: true }];
  }
  if (state.phase === 'respond' && state.pending?.queue[0] === seat) {
    const p = state.pending;
    const out = [{ type: 'allow' }];
    if (p.stage === 'challenge' && p.claim) out.push({ type: 'challenge' });
    if (p.stage === 'blockChallenge') out.push({ type: 'challenge' });
    if (p.stage === 'challenge' || p.stage === 'block') {
      for (const claim of blockOptions(state, seat)) out.push({ type: 'block', claim });
    }
    return out;
  }
  return [];
}

/** Characters this seat could claim to block the pending action with. */
export function blockOptions(state, seat) {
  const p = state.pending;
  if (!p || p.blocker != null) return [];
  const blockers = blockersFor(p.action, state.options.characters);
  if (!blockers.length) return [];
  if (!blockIsPublic(p.action) && seat !== p.target) return [];
  return blockers;
}

export function applyMove(state, seat, move) {
  const fail = (error) => ({ ok: false, error });
  if (state.phase === 'gameOver') return fail('The game is over.');
  if (isOut(state, seat)) return fail('You are out of the game.');

  if (move.type === 'action') return takeAction(state, seat, move);

  if (move.type === 'reveal') {
    if (state.phase !== 'lose' || state.losing.seat !== seat) return fail('Not yours to give up.');
    if (!revealCard(state, seat, move.cardId, state.losing.reason)) return fail('You do not hold that card.');
    const after = state.losing.after;
    state.losing = null;
    dispatch(state, after);
    return { ok: true };
  }

  if (['allow', 'challenge', 'block'].includes(move.type)) {
    if (state.phase !== 'respond') return fail('Nothing to answer.');
    const p = state.pending;
    if (p.queue[0] !== seat) return fail('It is not your turn to answer.');
    if (move.type === 'allow') {
      p.queue.shift();
      log(state, `${state.players[seat].name} lets it go.`);
      if (!p.queue.length) return closeWindow(state), { ok: true };
      return { ok: true };
    }
    if (move.type === 'challenge') {
      if (p.stage === 'blockChallenge') return challengeBlock(state, seat), { ok: true };
      if (!p.claim) return fail('There is nothing to challenge.');
      return challengeAction(state, seat), { ok: true };
    }
    if (move.type === 'block') {
      if (!blockOptions(state, seat).includes(move.claim)) return fail('You cannot block that.');
      p.blocker = seat;
      p.blockClaim = move.claim;
      log(state, `${state.players[seat].name} blocks with the ${CHARACTERS[move.claim].name}.`);
      p.stage = 'blockChallenge';
      p.queue = livingAfter(state, seat).filter((s) => s !== seat);
      if (!p.queue.length) return dispatch(state, 'blockStands'), { ok: true };
      state.phase = 'respond';
      return { ok: true };
    }
  }

  if (move.type === 'keep') {
    if (state.phase !== 'exchange' || state.exchange.seat !== seat) return fail('Not your exchange.');
    const pool = state.exchange.cards;
    const keep = move.cardIds ?? [];
    if (keep.length !== state.exchange.keep) return fail(`Keep exactly ${state.exchange.keep}.`);
    if (keep.some((id) => !pool.some((card) => card.id === id))) return fail('That card is not in front of you.');
    state.hands[seat] = pool.filter((card) => keep.includes(card.id));
    const back = pool.filter((card) => !keep.includes(card.id));
    state.deck.push(...back);
    shuffle(state.deck, makeRng(state.seed + state.deck.length * 17 + state.log.length));
    state.exchange = null;
    log(state, `${state.players[seat].name} puts two cards back.`);
    endTurn(state);
    return { ok: true };
  }

  if (move.type === 'interrogation') {
    if (state.phase !== 'interrogate' || state.interrogation.actor !== seat) return fail('Not your interrogation.');
    const { target, cardId } = state.interrogation;
    if (move.swap) {
      const index = state.hands[target].findIndex((card) => card.id === cardId);
      if (index !== -1) {
        const [card] = state.hands[target].splice(index, 1);
        state.deck.push(card);
        shuffle(state.deck, makeRng(state.seed + state.deck.length * 19 + state.log.length));
        const fresh = drawCard(state);
        if (fresh) state.hands[target].push(fresh);
      }
      log(state, `${state.players[seat].name} makes ${state.players[target].name} take a new card.`);
    } else {
      log(state, `${state.players[seat].name} lets ${state.players[target].name} keep it.`);
    }
    state.interrogation = null;
    endTurn(state);
    return { ok: true };
  }

  return fail('Unknown move.');
}

function takeAction(state, seat, move) {
  const fail = (error) => ({ ok: false, error });
  if (state.phase !== 'action' || state.turn !== seat) return fail('Not your turn.');
  const legal = legalActions(state, seat);
  const match = legal.find((m) => m.action === move.action && (m.target ?? null) === (move.target ?? null));
  if (!match) return fail('You cannot do that right now.');

  const actionKey = move.action;
  const action = ACTIONS[actionKey];
  const cost = actionCost(state, actionKey, move);
  if (cost) state.coins[seat] -= cost;

  const name = state.players[seat].name;
  const targetName = move.target != null ? state.players[move.target].name : null;

  // Nothing to argue about: these happen at once.
  if (actionKey === 'income') {
    state.coins[seat] += 1;
    log(state, `${name} takes income.`);
    return endTurn(state), { ok: true };
  }
  if (actionKey === 'coup') {
    log(state, `${name} launches a coup against ${targetName}.`);
    loseInfluence(state, move.target, 'endTurn', 'couped');
    return { ok: true };
  }
  if (actionKey === 'convert') {
    state.reserve += cost;
    state.allegiance[move.target] = 1 - state.allegiance[move.target];
    log(state, move.target === seat
      ? `${name} converts, and is now with the ${FACTIONS[state.allegiance[seat]]}.`
      : `${name} converts ${targetName} to the ${FACTIONS[state.allegiance[move.target]]}.`);
    return endTurn(state), { ok: true };
  }

  // Everything else can be argued with.
  state.pending = {
    actor: seat,
    action: actionKey,
    target: move.target ?? null,
    claim: action.character ?? null,
    stage: 'challenge',
    queue: livingAfter(state, seat),
    blocker: null,
    blockClaim: null
  };
  log(state, action.character
    ? `${name} claims the ${CHARACTERS[action.character].name} — ${action.label}${targetName ? ` on ${targetName}` : ''}.`
    : `${name} asks for ${action.label}.`);

  if (!state.pending.queue.length) return resolveAction(state), { ok: true };
  state.phase = 'respond';
  return { ok: true };
}

// Everyone in the window has spoken.
function closeWindow(state) {
  const p = state.pending;
  if (p.stage === 'blockChallenge') return dispatch(state, 'blockStands');
  return resolveAction(state);
}

function challengeAction(state, challenger) {
  const p = state.pending;
  p.challenger = challenger;
  const claimant = p.actor;
  log(state, `${state.players[challenger].name} calls ${state.players[claimant].name} on the ${CHARACTERS[p.claim].name}.`);
  if (holds(state, claimant, p.claim)) {
    swapCard(state, claimant, p.claim);
    loseInfluence(state, challenger, 'afterActorDefends', 'a bad call');
  } else {
    log(state, `${state.players[claimant].name} was bluffing.`);
    loseInfluence(state, claimant, 'actionFails', 'caught bluffing');
  }
}

function challengeBlock(state, challenger) {
  const p = state.pending;
  const blocker = p.blocker;
  log(state, `${state.players[challenger].name} calls ${state.players[blocker].name} on the ${CHARACTERS[p.blockClaim].name}.`);
  if (holds(state, blocker, p.blockClaim)) {
    swapCard(state, blocker, p.blockClaim);
    loseInfluence(state, challenger, 'blockStands', 'a bad call');
  } else {
    log(state, `${state.players[blocker].name} was bluffing the block.`);
    loseInfluence(state, blocker, 'resolveAction', 'caught bluffing');
  }
}

// The actor survived a challenge; anyone entitled to block still may.
function afterActorDefends(state) {
  const p = state.pending;
  if (!p) return;
  const blockers = blockersFor(p.action, state.options.characters);
  if (!blockers.length) return resolveAction(state);
  const eligible = blockIsPublic(p.action)
    ? livingAfter(state, p.actor)
    : (p.target != null && !isOut(state, p.target) ? [p.target] : []);
  if (!eligible.length) return resolveAction(state);
  p.stage = 'block';
  p.queue = eligible;
  state.phase = 'respond';
  log(state, 'The block window is still open.');
}

function resolveAction(state) {
  const p = state.pending;
  if (!p) return endTurn(state);
  const { actor, action, target } = p;
  const name = state.players[actor].name;

  if (isOut(state, actor)) return endTurn(state);

  switch (action) {
    case 'foreignAid':
      state.coins[actor] += 2;
      log(state, `${name} takes two in foreign aid.`);
      return endTurn(state);
    case 'tax':
      state.coins[actor] += 3;
      log(state, `${name} taxes three.`);
      return endTurn(state);
    case 'steal': {
      if (target == null || isOut(state, target)) return endTurn(state);
      const taken = Math.min(2, state.coins[target]);
      state.coins[target] -= taken;
      state.coins[actor] += taken;
      log(state, `${name} takes ${taken} from ${state.players[target].name}.`);
      return endTurn(state);
    }
    case 'assassinate':
      if (target == null || isOut(state, target)) return endTurn(state);
      log(state, `The assassination goes through.`);
      return loseInfluence(state, target, 'endTurn', 'assassinated');
    case 'embezzle': {
      const pot = state.reserve;
      state.coins[actor] += pot;
      state.reserve = 0;
      log(state, `${name} empties the reserve of ${pot}.`);
      return endTurn(state);
    }
    case 'exchange': {
      const drawn = [drawCard(state), drawCard(state)].filter(Boolean);
      state.exchange = {
        seat: actor,
        cards: [...state.hands[actor], ...drawn],
        keep: state.hands[actor].length
      };
      state.hands[actor] = [];
      state.phase = 'exchange';
      log(state, `${name} draws two to exchange.`);
      return;
    }
    case 'interrogate': {
      if (target == null || isOut(state, target)) return endTurn(state);
      const card = state.hands[target][Math.floor(state.hands[target].length / 2)] ?? state.hands[target][0];
      if (!card) return endTurn(state);
      state.interrogation = { actor, target, cardId: card.id, character: card.character };
      state.phase = 'interrogate';
      log(state, `${name} looks at one of ${state.players[target].name}'s cards.`);
      return;
    }
    default:
      return endTurn(state);
  }
}

// ---------------------------------------------------------------- seat view

export function view(state, seat) {
  const p = state.pending;
  const me = seat != null && !isOut(state, seat) ? seat : null;
  return {
    game: 'coup',
    seat,
    phase: state.phase,
    turn: state.turn,
    characters: state.options.characters,
    copies: state.options.copies,
    factions: state.options.factions,
    factionNames: FACTIONS,
    challengeSeconds: state.options.challengeSeconds,
    reserve: state.reserve,
    deckSize: state.deck.length,
    players: state.players.map((pl, i) => ({
      seat: i,
      name: pl.name,
      isBot: pl.isBot,
      coins: state.coins[i],
      influence: state.hands[i].length,
      revealed: state.revealed[i].map((card) => card.character),
      out: isOut(state, i),
      allegiance: state.options.factions ? state.allegiance[i] : null
    })),
    // Your own cards, and nobody else's.
    hand: seat == null ? [] : state.hands[seat].map((card) => ({ id: card.id, character: card.character })),
    actions: me != null ? legalActions(state, me) : [],
    pending: p ? {
      actor: p.actor,
      action: p.action,
      label: ACTIONS[p.action].label,
      target: p.target,
      claim: p.claim,
      stage: p.stage,
      blocker: p.blocker,
      blockClaim: p.blockClaim,
      waitingOn: p.queue[0] ?? null,
      queue: p.queue.slice()
    } : null,
    myResponses: seat != null && state.phase === 'respond' && p?.queue[0] === seat
      ? legalMoves(state, seat)
      : [],
    losing: state.losing && state.losing.seat === seat ? { reason: state.losing.reason } : null,
    losingSeat: state.losing?.seat ?? null,
    exchange: state.exchange && state.exchange.seat === seat
      ? { cards: state.exchange.cards.map((c) => ({ id: c.id, character: c.character })), keep: state.exchange.keep }
      : null,
    exchangeSeat: state.exchange?.seat ?? null,
    interrogation: state.interrogation && state.interrogation.actor === seat
      ? { target: state.interrogation.target, character: state.interrogation.character }
      : null,
    interrogationSeat: state.interrogation?.actor ?? null,
    log: state.log.slice(-40),
    winners: state.winners
  };
}

export function isOver(state) { return state.phase === 'gameOver'; }

export function activeSeats(state) {
  switch (state.phase) {
    case 'action': return [state.turn];
    case 'respond': return state.pending?.queue.length ? [state.pending.queue[0]] : [];
    case 'lose': return state.losing ? [state.losing.seat] : [];
    case 'exchange': return state.exchange ? [state.exchange.seat] : [];
    case 'interrogate': return state.interrogation ? [state.interrogation.actor] : [];
    default: return [];
  }
}
