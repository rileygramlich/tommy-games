// The characters and the actions they back. A game uses five of them; which
// five is a setup choice, which is the idea the Rebellion expansion is built on.
export const CHARACTERS = {
  duke: {
    key: 'duke', name: 'Duke', colour: '#6b4a8c', glyph: '♜',
    action: 'tax', blocks: ['foreignAid'],
    text: 'Tax — take three coins. Blocks foreign aid.'
  },
  assassin: {
    key: 'assassin', name: 'Assassin', colour: '#2c2a26', glyph: '†',
    action: 'assassinate', blocks: [],
    text: 'Assassinate — pay three coins to make a player lose an influence.'
  },
  captain: {
    key: 'captain', name: 'Captain', colour: '#2f6f9f', glyph: '⚓',
    action: 'steal', blocks: ['steal'],
    text: 'Steal — take two coins from another player. Blocks stealing.'
  },
  ambassador: {
    key: 'ambassador', name: 'Ambassador', colour: '#3f8a55', glyph: '✉',
    action: 'exchange', blocks: ['steal'],
    text: 'Exchange — draw two from the deck and keep whichever you like. Blocks stealing.'
  },
  contessa: {
    key: 'contessa', name: 'Contessa', colour: '#a8433a', glyph: '❦',
    action: null, blocks: ['assassinate'],
    text: 'Blocks assassination. Nothing else — but nothing else is needed.'
  },
  inquisitor: {
    key: 'inquisitor', name: 'Inquisitor', colour: '#7a5230', glyph: '☩',
    action: 'interrogate', blocks: ['steal'],
    text: 'Interrogate — look at one card of another player, and make them swap it if you like. Blocks stealing.'
  },
  embezzler: {
    key: 'embezzler', name: 'Embezzler', colour: '#b8862c', glyph: '⚖',
    action: 'embezzle', blocks: [],
    text: 'Embezzle — take every coin sitting in the treasury reserve.'
  }
};

export const CHARACTER_LIST = Object.values(CHARACTERS);

export const SETS = {
  classic: {
    key: 'classic', name: 'The classic five',
    characters: ['duke', 'assassin', 'captain', 'ambassador', 'contessa'],
    note: 'The base game, exactly as printed.'
  },
  inquisition: {
    key: 'inquisition', name: 'Inquisition',
    characters: ['duke', 'assassin', 'captain', 'inquisitor', 'contessa'],
    note: 'The Inquisitor takes the Ambassador’s chair: no free exchange, but you can look at what a rival is holding.'
  },
  treasury: {
    key: 'treasury', name: 'Treasury',
    characters: ['duke', 'assassin', 'captain', 'contessa', 'embezzler'],
    note: 'Best with factions on, where converting keeps filling the reserve for the Embezzler to empty.'
  }
};

export const ACTIONS = {
  income: { key: 'income', label: 'Income', gain: 1, target: false, character: null, blockedBy: [] },
  foreignAid: { key: 'foreignAid', label: 'Foreign aid', gain: 2, target: false, character: null, blockedBy: ['foreignAid'] },
  coup: { key: 'coup', label: 'Coup', cost: 7, target: true, character: null, blockedBy: [] },
  tax: { key: 'tax', label: 'Tax', gain: 3, target: false, character: 'duke', blockedBy: [] },
  assassinate: { key: 'assassinate', label: 'Assassinate', cost: 3, target: true, character: 'assassin', blockedBy: ['assassinate'] },
  steal: { key: 'steal', label: 'Steal', target: true, character: 'captain', blockedBy: ['steal'] },
  exchange: { key: 'exchange', label: 'Exchange', target: false, character: 'ambassador', blockedBy: [] },
  interrogate: { key: 'interrogate', label: 'Interrogate', target: true, character: 'inquisitor', blockedBy: [] },
  embezzle: { key: 'embezzle', label: 'Embezzle', target: false, character: 'embezzler', blockedBy: [] },
  convert: { key: 'convert', label: 'Convert', target: 'optional', character: null, blockedBy: [] }
};

/** Which characters in this game can block a given action. */
export function blockersFor(actionKey, characters) {
  const action = ACTIONS[actionKey];
  if (!action || !action.blockedBy.length) return [];
  return characters.filter((key) => {
    const character = CHARACTERS[key];
    return action.blockedBy.some((what) => character.blocks.includes(what));
  });
}

/** Only the target may block a strike; anyone may stand in the way of foreign aid. */
export function blockIsPublic(actionKey) {
  return actionKey === 'foreignAid';
}
