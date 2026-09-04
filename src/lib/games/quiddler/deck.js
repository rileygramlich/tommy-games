// The 118-card Quiddler deck. Ten faces carry two letters ("cl", "er", "in",
// "qu", "th") and count as a single card.
export const LETTERS = [
  { letters: 'a', value: 2, count: 10 },  { letters: 'b', value: 8, count: 2 },
  { letters: 'c', value: 8, count: 2 },   { letters: 'd', value: 5, count: 4 },
  { letters: 'e', value: 2, count: 12 },  { letters: 'f', value: 6, count: 2 },
  { letters: 'g', value: 6, count: 4 },   { letters: 'h', value: 7, count: 2 },
  { letters: 'i', value: 2, count: 8 },   { letters: 'j', value: 13, count: 2 },
  { letters: 'k', value: 8, count: 2 },   { letters: 'l', value: 3, count: 4 },
  { letters: 'm', value: 5, count: 2 },   { letters: 'n', value: 5, count: 6 },
  { letters: 'o', value: 2, count: 8 },   { letters: 'p', value: 6, count: 2 },
  { letters: 'q', value: 15, count: 2 },  { letters: 'r', value: 5, count: 6 },
  { letters: 's', value: 3, count: 4 },   { letters: 't', value: 3, count: 6 },
  { letters: 'u', value: 4, count: 6 },   { letters: 'v', value: 11, count: 2 },
  { letters: 'w', value: 10, count: 2 },  { letters: 'x', value: 12, count: 2 },
  { letters: 'y', value: 4, count: 4 },   { letters: 'z', value: 14, count: 2 },
  { letters: 'cl', value: 10, count: 2 }, { letters: 'er', value: 7, count: 2 },
  { letters: 'in', value: 7, count: 2 },  { letters: 'qu', value: 9, count: 2 },
  { letters: 'th', value: 9, count: 2 }
];

export function buildDeck() {
  const cards = [];
  for (const spec of LETTERS) {
    for (let i = 0; i < spec.count; i++) {
      cards.push({ id: `${spec.letters}${i}`, letters: spec.letters, value: spec.value });
    }
  }
  return cards;
}

// Round n deals n + 2 cards, so round 1 is three cards and round 8 is ten.
export const ROUNDS = 8;
export function handSize(round) {
  return round + 2;
}
