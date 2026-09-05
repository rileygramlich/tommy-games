// Sequence bot: values every square by the lines it opens and the lines it shuts.
import { SIZE, isCorner, isWildJack, isRemoveJack } from './board.js';

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

/** Every five-in-a-row window that passes through this square. */
function windowsThrough(index) {
  const row = Math.floor(index / SIZE);
  const col = index % SIZE;
  const out = [];
  for (const [dr, dc] of DIRS) {
    for (let offset = -4; offset <= 0; offset++) {
      const cells = [];
      for (let k = 0; k < 5; k++) {
        const r = row + dr * (offset + k);
        const c = col + dc * (offset + k);
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) { cells.length = 0; break; }
        cells.push(r * SIZE + c);
      }
      if (cells.length === 5) out.push(cells);
    }
  }
  return out;
}

function placementValue(v, index, seat) {
  let value = 0;
  for (const cells of windowsThrough(index)) {
    let mine = 0, theirs = 0;
    for (const cell of cells) {
      if (isCorner(cell)) { mine += 1; continue; }
      const owner = v.chips[cell];
      if (owner === seat) mine += 1;
      else if (owner != null) theirs += 1;
    }
    if (theirs === 0) value += (mine + 1) ** 2;          // room to grow
    if (mine === 0 && theirs >= 3) value += theirs * 9;  // and worth blocking
    if (theirs === 0 && mine >= 3) value += 22;          // one away from five
  }
  // The middle of the board sits on more lines than the edge.
  const row = Math.floor(index / SIZE), col = index % SIZE;
  value += 4 - (Math.abs(4.5 - row) + Math.abs(4.5 - col)) / 2;
  return value;
}

function removalValue(v, index, seat) {
  let value = 0;
  const victim = v.chips[index];
  for (const cells of windowsThrough(index)) {
    let theirs = 0, others = 0;
    for (const cell of cells) {
      if (isCorner(cell)) { theirs += 1; continue; }
      const owner = v.chips[cell];
      if (owner === victim) theirs += 1;
      else if (owner != null) others += 1;
    }
    if (others === 0) value += theirs ** 2;
  }
  return value;
}

export function chooseMove(v, rng = Math.random) {
  const moves = [];
  const seat = v.seat;

  // Swapping a dead card is free, so always do it first.
  const dead = v.hand.find((c) => v.dead.includes(c.id));
  if (dead && !v.exchanged) return { type: 'exchange', cardId: dead.id };

  for (const card of v.hand) {
    if (isRemoveJack(card)) {
      for (let i = 0; i < v.chips.length; i++) {
        if (v.chips[i] == null || v.chips[i] === seat || v.locked.includes(i)) continue;
        const value = removalValue(v, i, seat);
        // Only worth a jack if it is really breaking something up.
        moves.push({ move: { type: 'remove', cardId: card.id, index: i }, value: value - 14 });
      }
    } else if (isWildJack(card)) {
      for (let i = 0; i < v.chips.length; i++) {
        if (isCorner(i) || v.chips[i] != null) continue;
        moves.push({ move: { type: 'play', cardId: card.id, index: i }, value: placementValue(v, i, seat) - 10 });
      }
    } else {
      for (let i = 0; i < v.chips.length; i++) {
        const cell = v.board[i];
        if (!cell || v.chips[i] != null) continue;
        if (cell.suit !== card.suit || cell.rank !== card.rank) continue;
        moves.push({ move: { type: 'play', cardId: card.id, index: i }, value: placementValue(v, i, seat) });
      }
    }
  }

  if (!moves.length) return { type: 'pass' };
  let best = null;
  for (const option of moves) {
    const score = option.value + rng() * 0.8;
    if (!best || score > best.score) best = { score, move: option.move };
  }
  return best.move;
}
