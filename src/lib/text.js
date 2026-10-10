// In a solo game the human seat is called "You", and messages are written for
// any name: "<name> takes the trick". This turns "You takes" into "You take",
// "You is" into "You are" and "You's" into "Your", wherever a message is shown.
const IRREGULAR = { is: 'are', has: 'have', was: 'were', does: 'do', goes: 'go' };

export function youGrammar(text) {
  return String(text ?? '')
    .replace(/\bYou's\b/g, 'Your')
    .replace(/\bYou ([a-z]+)\b/g, (whole, verb) => {
      if (IRREGULAR[verb]) return `You ${IRREGULAR[verb]}`;
      if (/(ss|sh|ch|x|z)es$/.test(verb)) return `You ${verb.slice(0, -2)}`; // passes, catches
      if (/[^aeiou]ies$/.test(verb)) return `You ${verb.slice(0, -3)}y`;    // empties
      if (/[^su]s$/.test(verb)) return `You ${verb.slice(0, -1)}`;          // takes, wins, bids
      return whole;
    });
}

/** "1 trick", "2 tricks". */
export function plural(count, word, many = `${word}s`) {
  return `${count} ${count === 1 ? word : many}`;
}
