// The Sequence board: ten by ten, free corners, every non-jack card printed twice.
//
// This is not a photograph of the retail board — that layout is a specific
// printed arrangement. It is built the same way in spirit: the 48 non-jack
// cards are laid twice along a spiral, in suit runs, so lines of one suit
// snake around the board the way they do on the real thing.
import { SUITS, RANK_LABELS } from '../cards.js';

export const SIZE = 10;
export const CORNERS = [0, SIZE - 1, SIZE * (SIZE - 1), SIZE * SIZE - 1];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14]; // no jacks: they are wild

function spiralOrder() {
  const order = [];
  let top = 0, bottom = SIZE - 1, left = 0, right = SIZE - 1;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) order.push(top * SIZE + c);
    for (let r = top + 1; r <= bottom; r++) order.push(r * SIZE + right);
    if (top < bottom) for (let c = right - 1; c >= left; c--) order.push(bottom * SIZE + c);
    if (left < right) for (let r = bottom - 1; r > top; r--) order.push(r * SIZE + left);
    top++; bottom--; left++; right--;
  }
  return order;
}

function buildBoard() {
  const cells = new Array(SIZE * SIZE).fill(null);
  const runs = [];
  for (let pass = 0; pass < 2; pass++) {
    for (const suit of SUITS) {
      const ranks = pass === 0 ? RANKS : [...RANKS].reverse();
      for (const rank of ranks) runs.push({ suit, rank });
    }
  }
  const path = spiralOrder().filter((i) => !CORNERS.includes(i));
  path.forEach((cell, n) => { cells[cell] = runs[n % runs.length]; });
  return cells;
}

export const BOARD = buildBoard();

export function isCorner(index) { return CORNERS.includes(index); }

export function cellLabel(index) {
  if (isCorner(index)) return 'Free';
  const cell = BOARD[index];
  return `${RANK_LABELS[cell.rank]}${cell.suit}`;
}

/** Board squares a given card can be played on. */
export function squaresFor(card) {
  const out = [];
  for (let i = 0; i < BOARD.length; i++) {
    const cell = BOARD[i];
    if (cell && cell.suit === card.suit && cell.rank === card.rank) out.push(i);
  }
  return out;
}

export const TWO_EYED = new Set(['D', 'C']);   // wild jacks: play anywhere
export const ONE_EYED = new Set(['H', 'S']);   // hunting jacks: remove a chip
export const isJack = (card) => card.rank === 11;
export const isWildJack = (card) => isJack(card) && TWO_EYED.has(card.suit);
export const isRemoveJack = (card) => isJack(card) && ONE_EYED.has(card.suit);
