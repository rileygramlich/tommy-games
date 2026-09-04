export const SUITS = ['C', 'D', 'H', 'S'];
export const SUIT_NAMES = { C: 'Clubs', D: 'Diamonds', H: 'Hearts', S: 'Spades' };
export const SUIT_SYMBOLS = { C: '♣', D: '♦', H: '♥', S: '♠' };
export const RANK_LABELS = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
};

// 60 cards: a standard 52 plus 4 Wizards and 4 Jesters.
export function buildDeck() {
  const cards = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      cards.push({ id: `${suit}${rank}`, kind: 'suit', suit, rank });
    }
  }
  for (let i = 1; i <= 4; i++) cards.push({ id: `W${i}`, kind: 'wizard', suit: null, rank: 15 });
  for (let i = 1; i <= 4; i++) cards.push({ id: `J${i}`, kind: 'jester', suit: null, rank: 0 });
  return cards;
}

export function cardLabel(card) {
  if (!card) return '';
  if (card.kind === 'wizard') return 'Wizard';
  if (card.kind === 'jester') return 'Jester';
  return `${RANK_LABELS[card.rank]}${SUIT_SYMBOLS[card.suit]}`;
}
