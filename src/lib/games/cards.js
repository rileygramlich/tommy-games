// Standard playing cards, shared by every game that uses a normal deck.
// The shape matches what PlayingCard.svelte draws: { id, kind, suit, rank }.
export const SUITS = ['C', 'D', 'H', 'S'];
export const SUIT_NAMES = { C: 'Clubs', D: 'Diamonds', H: 'Hearts', S: 'Spades' };
export const SUIT_SYMBOLS = { C: '♣', D: '♦', H: '♥', S: '♠' };
export const RED = new Set(['D', 'H']);
export const RANK_LABELS = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
};

export function makeCard(suit, rank, copy = 0) {
  return { id: `${suit}${rank}${copy ? `#${copy}` : ''}`, kind: 'suit', suit, rank };
}

/** A deck of the given ranks in every suit; `copies` deals more than one deck. */
export function buildDeck({ ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], copies = 1 } = {}) {
  const cards = [];
  for (let copy = 0; copy < copies; copy++) {
    for (const suit of SUITS) {
      for (const rank of ranks) cards.push(makeCard(suit, rank, copy));
    }
  }
  return cards;
}

export function cardLabel(card) {
  return card ? `${RANK_LABELS[card.rank]}${SUIT_SYMBOLS[card.suit]}` : '';
}

export function sameColour(a, b) {
  return RED.has(a) === RED.has(b);
}
