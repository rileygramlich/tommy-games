// Backgammon bot: enumerates every legal way to play the dice, then keeps the
// resulting position it likes best. One ply, but it understands blots, points
// and primes, which is most of what one ply needs.
import {
  POINTS, movesForDie, applySingle, countAt, pipsToOff, homeRange, dirOf, pipCount
} from './engine.js';

const GOLDEN = { 0: [5, 4, 7], 1: [18, 19, 16] }; // five point, four point, bar point

function key(points, bar, off) {
  return `${points.join(',')}|${bar.join(',')}|${off.join(',')}`;
}

/** All positions reachable by playing as many dice as the rules require. */
function sequences(points, bar, off, seat, dice) {
  const results = [];
  let best = 0;
  const seen = new Set();
  const walk = (p, b, o, remaining, played) => {
    if (played.length > best) { best = played.length; }
    results.push({ p, b, o, played });
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
        // Never fold together two different opening moves: bearing off from the
        // same point with a 1 or a 2 lands in the same place but only one of
        // them may be legal.
        if (played.length > 0) {
          const k = `${played.length}:${key(np, nb, no)}`;
          if (seen.has(k)) continue;
          seen.add(k);
        }
        walk(np, nb, no, rest, [...played, move]);
      }
    }
  };
  walk(points, bar, off, dice, []);
  return results.filter((r) => r.played.length === best);
}

// Rough chance of being hit: direct shots (1-6 pips away) are the dangerous ones.
function blotDanger(points, bar, seat, index) {
  const other = 1 - seat;
  let shots = 0;
  if (bar[other] > 0) {
    const entry = other === 0 ? 24 - index : index + 1;
    if (entry >= 1 && entry <= 6) shots += 11;
  }
  for (let d = 1; d <= 6; d++) {
    const from = index - dirOf(other) * d;
    if (from < 0 || from >= POINTS) continue;
    if (countAt(points, from, other) > 0) shots += d <= 6 ? 11 - Math.max(0, d - 4) : 0;
  }
  return shots;
}

export function evaluate(points, bar, off, seat) {
  const other = 1 - seat;
  let score = 0;

  score += (pipCount(points, bar, other) - pipCount(points, bar, seat)) * 1.0;
  score += off[seat] * 14 - off[other] * 14;
  score -= bar[seat] * 28;
  score += bar[other] * 22;

  const [lo, hi] = homeRange(seat);
  let primeRun = 0, bestPrime = 0;
  for (let i = 0; i < POINTS; i++) {
    const mine = countAt(points, i, seat);
    const theirs = countAt(points, i, other);
    if (mine >= 2) {
      score += 6;
      if (i >= lo && i <= hi) score += 6;
      if (GOLDEN[seat].includes(i)) score += 7;
      if (mine > 3) score -= (mine - 3) * 2.5;   // stacked checkers do nothing
      primeRun += 1;
      bestPrime = Math.max(bestPrime, primeRun);
    } else {
      primeRun = 0;
      if (mine === 1) score -= blotDanger(points, bar, seat, i) * 0.7;
    }
    if (theirs >= 2 && i >= lo && i <= hi) score -= 8; // an anchor in my home board
  }
  score += bestPrime >= 4 ? (bestPrime - 3) * 9 : 0;
  return score;
}

export function chooseMove(v, rng = Math.random) {
  if (v.phase === 'roll') return { type: 'roll' };
  if (v.phase === 'turnEnd' || v.phase === 'gameEnd') return { type: 'continue' };
  if (v.phase !== 'move') return { type: 'continue' };
  if (!v.moves.length) return { type: 'continue' };

  const options = sequences(v.points, v.bar, v.off, v.seat, v.diceLeft);
  // The view already knows which opening moves the rules allow — including the
  // "play the larger die" rule when only one of them fits.
  const allowed = new Set(v.moves.map((m) => `${m.from}:${m.to}:${m.die}`));
  let best = null;
  for (const option of options) {
    if (!option.played.length) continue;
    const first = option.played[0];
    if (!allowed.has(`${first.from}:${first.to}:${first.die}`)) continue;
    const score = evaluate(option.p, option.b, option.o, v.seat) + rng() * 0.4;
    if (!best || score > best.score) best = { score, move: option.played[0] };
  }
  // Should not happen, but never stall the table over it.
  if (!best) return { type: 'move', ...v.moves[0] };
  return { type: 'move', from: best.move.from, to: best.move.to, die: best.move.die };
}
