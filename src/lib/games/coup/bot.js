// Coup bot. It counts the cards it can see, calls bluffs that cannot be true,
// tells a few of its own, and always blocks an assassination when the
// alternative is dying honestly.
import { CHARACTERS, ACTIONS, blockersFor, blockIsPublic } from './characters.js';

const WORTH = { duke: 5, assassin: 4.6, contessa: 4, captain: 3.6, inquisitor: 3.5, ambassador: 3.2, embezzler: 2.4 };

/** Copies of a character this seat can account for: face-up ones plus its own. */
function seen(v, character) {
  let n = v.hand.filter((c) => c.character === character).length;
  for (const p of v.players) n += p.revealed.filter((c) => c === character).length;
  return n;
}
const holds = (v, character) => v.hand.some((c) => c.character === character);

function threatOrder(v) {
  // Whoever is closest to couping you is the problem.
  return v.players
    .filter((p) => !p.out && p.seat !== v.seat)
    .sort((a, b) => (b.coins + b.influence * 3) - (a.coins + a.influence * 3));
}

function pick(actions, key, target) {
  return actions.find((a) => a.action === key && (target == null || a.target === target));
}

export function chooseMove(v, rng = Math.random) {
  if (v.losing) return chooseReveal(v, rng);
  if (v.exchange) return chooseKeep(v);
  if (v.interrogation) {
    const strong = WORTH[v.interrogation.character] >= 4;
    return { type: 'interrogation', swap: strong };
  }
  if (v.myResponses.length) return chooseResponse(v, rng);
  if (v.actions.length) return chooseAction(v, rng);
  return { type: 'allow' };
}

function chooseAction(v, rng) {
  const actions = v.actions;
  const me = v.players[v.seat];
  const threats = threatOrder(v);
  const strike = threats.find((p) => actions.some((a) => a.action === 'coup' && a.target === p.seat));

  if (me.coins >= 10) {
    return pick(actions, 'coup', strike?.seat) ?? actions[0];
  }

  if (v.factions) {
    const convert = factionPlay(v, actions, me, threats, rng);
    if (convert) return convert;
  }

  // A real assassin, three coins and a target is the best deal in the game.
  if (holds(v, 'assassin')) {
    const soft = threats.find((p) => p.influence === 1) ?? threats[0];
    const shot = pick(actions, 'assassinate', soft?.seat);
    if (shot) return shot;
  }
  if (me.coins >= 7 && strike) return pick(actions, 'coup', strike.seat);

  if (holds(v, 'duke') && pick(actions, 'tax')) return pick(actions, 'tax');
  if (holds(v, 'captain')) {
    const rich = threats.filter((p) => p.coins > 0).sort((a, b) => b.coins - a.coins)[0];
    const theft = pick(actions, 'steal', rich?.seat);
    if (theft) return theft;
  }
  if (v.factions && holds(v, 'embezzler') && v.reserve >= 2 && pick(actions, 'embezzle')) {
    return pick(actions, 'embezzle');
  }
  if (holds(v, 'ambassador') || holds(v, 'inquisitor')) {
    const weak = v.hand.every((c) => WORTH[c.character] < 4);
    if (weak && pick(actions, 'exchange')) return pick(actions, 'exchange');
    if (weak && holds(v, 'inquisitor')) {
      const look = pick(actions, 'interrogate', threats[0]?.seat);
      if (look) return look;
    }
  }

  // Nothing honest to do: bluff something, or take the safe coin.
  const bluffable = ['tax', 'steal', 'assassinate'].filter((key) => {
    const move = actions.find((a) => a.action === key);
    if (!move) return false;
    const character = ACTIONS[key].character;
    return character && seen(v, character) < v.copies - 1;
  });
  if (bluffable.length && rng() < 0.38) {
    const key = bluffable[Math.floor(rng() * bluffable.length)];
    const targeted = actions.filter((a) => a.action === key && a.target != null);
    if (targeted.length) {
      const best = threats.find((p) => targeted.some((a) => a.target === p.seat));
      return pick(actions, key, best?.seat) ?? targeted[0];
    }
    return pick(actions, key);
  }
  if (pick(actions, 'foreignAid') && rng() < 0.5) return pick(actions, 'foreignAid');
  return pick(actions, 'income') ?? actions[0];
}

// Conversion cannot end the game here, so it is a shield: nobody may coup,
// steal from or assassinate someone flying their own colours.
function factionPlay(v, actions, me, threats, rng) {
  const alive = v.players.filter((p) => !p.out);
  const others = alive.filter((p) => p.seat !== v.seat);
  if (!others.length) return null;

  const dangerous = threats.filter((p) => p.allegiance !== me.allegiance && (p.coins >= 6 || p.influence === 2));
  // Someone across the table is one turn from couping me: get behind their lines.
  if (dangerous.length && me.coins >= 1 && rng() < 0.3) {
    const move = pick(actions, 'convert', v.seat);
    if (move && dangerous.length >= others.length / 2) return move;
  }
  // Or drag the worst of them onto my side, where they cannot touch me.
  if (me.coins >= 4 && dangerous.length && rng() < 0.28) {
    const move = pick(actions, 'convert', dangerous[0].seat);
    if (move) return move;
  }
  return null;
}

function chooseResponse(v, rng) {
  const p = v.pending;
  const responses = v.myResponses;
  const blocks = responses.filter((r) => r.type === 'block');
  const canChallenge = responses.some((r) => r.type === 'challenge');
  const claim = p.stage === 'blockChallenge' ? p.blockClaim : p.claim;
  const me = v.players[v.seat];
  const targetsMe = p.target === v.seat;

  // Blocking is usually better than challenging when it is available.
  if (blocks.length) {
    const honest = blocks.find((b) => holds(v, b.claim));
    if (honest) return honest;
    const deadly = p.action === 'assassinate' && targetsMe;
    if (deadly && me.influence === 1) return blocks[0];          // nothing to lose
    const bluffable = blocks.filter((b) => seen(v, b.claim) < v.copies - 1);
    if (bluffable.length) {
      const odds = deadly ? 0.75 : p.action === 'steal' ? 0.3 : 0.12;
      if (rng() < odds) return bluffable[Math.floor(rng() * bluffable.length)];
    }
  }

  if (canChallenge && claim) {
    const accounted = seen(v, claim);
    if (accounted >= v.copies) return { type: 'challenge' };     // it cannot be true
    let odds = 0.1;
    if (accounted === v.copies - 1) odds += 0.4;
    if (targetsMe) odds += 0.18;
    if (p.action === 'assassinate' && targetsMe && me.influence === 1) odds += 0.3;
    if (me.influence === 1) odds -= 0.12;
    if (rng() < odds) return { type: 'challenge' };
  }
  return { type: 'allow' };
}

function chooseReveal(v, rng) {
  const sorted = [...v.hand].sort((a, b) => (WORTH[a.character] ?? 3) - (WORTH[b.character] ?? 3));
  return { type: 'reveal', cardId: sorted[0].id };
}

function chooseKeep(v) {
  const ranked = [...v.exchange.cards].sort((a, b) => (WORTH[b.character] ?? 3) - (WORTH[a.character] ?? 3));
  const keep = [];
  const taken = new Set();
  for (const card of ranked) {
    if (keep.length >= v.exchange.keep) break;
    // A pair of the same face is worth less than two different ones.
    if (taken.has(card.character) && ranked.length > v.exchange.keep + 1) continue;
    keep.push(card.id);
    taken.add(card.character);
  }
  for (const card of ranked) {
    if (keep.length >= v.exchange.keep) break;
    if (!keep.includes(card.id)) keep.push(card.id);
  }
  return { type: 'keep', cardIds: keep };
}
