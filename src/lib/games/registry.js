import * as wizardEngine from './wizard/engine.js';
import * as wizardBot from './wizard/bot.js';
import * as quiddlerEngine from './quiddler/engine.js';
import * as quiddlerBot from './quiddler/bot.js';
import { loadDictionary } from './quiddler/dictionary.js';

export const GAMES = {
  wizard: {
    ...wizardEngine.meta,
    engine: wizardEngine,
    bot: wizardBot,
    blurb: 'Every round deals one more card. Predict exactly how many tricks you will take — being right pays, being close does not.',
    accent: '#5b3a86',
    ready: async () => {}
  },
  quiddler: {
    ...quiddlerEngine.meta,
    engine: quiddlerEngine,
    bot: quiddlerBot,
    blurb: 'A hand of letter cards, eight growing rounds, and one goal: spell every card you hold into words before anyone else does.',
    accent: '#a8433a',
    ready: async () => {
      const dict = await loadDictionary(`${import.meta.env.BASE_URL}data/quiddler-words.txt`);
      quiddlerEngine.setDictionary(dict);
      return dict;
    }
  }
};

export const GAME_LIST = Object.values(GAMES);

export function getGame(id) {
  return GAMES[id] ?? null;
}
