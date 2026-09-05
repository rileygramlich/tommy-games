// One entry per game. Everything else on the site reads this file: the shelf,
// the setup screen, the rules pages and the router all stay generic.
import * as wizardEngine from './wizard/engine.js';
import * as wizardBot from './wizard/bot.js';
import WizardTable from './wizard/WizardTable.svelte';

import * as quiddlerEngine from './quiddler/engine.js';
import * as quiddlerBot from './quiddler/bot.js';
import QuiddlerTable from './quiddler/QuiddlerTable.svelte';
import { loadDictionary } from './quiddler/dictionary.js';

import * as reversiEngine from './reversi/engine.js';
import * as reversiBot from './reversi/bot.js';
import ReversiTable from './reversi/ReversiTable.svelte';

import * as yahtzeeEngine from './yahtzee/engine.js';
import * as yahtzeeBot from './yahtzee/bot.js';
import YahtzeeTable from './yahtzee/YahtzeeTable.svelte';

import * as euchreEngine from './euchre/engine.js';
import * as euchreBot from './euchre/bot.js';
import EuchreTable from './euchre/EuchreTable.svelte';

import * as cribbageEngine from './cribbage/engine.js';
import * as cribbageBot from './cribbage/bot.js';
import CribbageTable from './cribbage/CribbageTable.svelte';

import * as sequenceEngine from './sequence/engine.js';
import * as sequenceBot from './sequence/bot.js';
import SequenceTable from './sequence/SequenceTable.svelte';

import * as mastermindEngine from './mastermind/engine.js';
import * as mastermindBot from './mastermind/bot.js';
import MastermindTable from './mastermind/MastermindTable.svelte';

import * as backgammonEngine from './backgammon/engine.js';
import * as backgammonBot from './backgammon/bot.js';
import BackgammonTable from './backgammon/BackgammonTable.svelte';

const noop = async () => {};

export const GAMES = {
  wizard: {
    ...wizardEngine.meta,
    engine: wizardEngine, bot: wizardBot, component: WizardTable, ready: noop,
    accent: '#5b3a86',
    length: '30–45 min',
    blurb: 'Every round deals one more card. Predict exactly how many tricks you will take — being right pays, being close does not.',
    options: [
      { key: 'hookRule', type: 'toggle', default: false, label: 'Screw the dealer',
        help: 'The dealer may not make the bids add up to the tricks available.' }
    ],
    rules: [
      { title: 'The deck', text: 'Sixty cards: a standard fifty-two, plus four Wizards and four Jesters. A Wizard beats everything; a Jester loses to everything.' },
      { title: 'The rounds', text: 'Round one deals one card each, round two deals two, and so on until the deck runs out — twenty rounds with three players, ten with six. After the deal, the next card is turned up to set trump. A Jester means no trump; a Wizard means the dealer calls it.' },
      { title: 'Bidding', text: 'Starting left of the dealer, everyone announces exactly how many tricks they will take. The bids do not have to add up — that is the whole game.' },
      { title: 'Playing', text: 'Follow the suit that was led if you can. Wizards and Jesters are always legal. The first Wizard played wins the trick; otherwise the highest trump wins, or the highest card of the led suit. If a Jester leads, the next real card sets the suit.' },
      { title: 'Scoring', text: 'Hit your bid exactly: 20 points, plus 10 per trick taken. Miss it by any amount: 10 points off for every trick over or under. Highest score after the last round wins.' }
    ]
  },

  quiddler: {
    ...quiddlerEngine.meta,
    engine: quiddlerEngine, bot: quiddlerBot, component: QuiddlerTable,
    accent: '#a8433a',
    length: '25–40 min',
    blurb: 'A hand of letter cards, eight growing rounds, and one goal: spell every card you hold into words before anyone else does.',
    ready: async () => {
      const dict = await loadDictionary(`${import.meta.env.BASE_URL}data/quiddler-words.txt`);
      quiddlerEngine.setDictionary(dict);
      return dict;
    },
    options: [
      { key: 'bonuses', type: 'toggle', default: true, label: 'Round bonuses',
        help: '10 points each for the longest word and the most words.' },
      { key: 'rounds', type: 'select', default: 8, label: 'Rounds',
        choices: [{ value: 4, label: '4 (up to 6 cards)' }, { value: 6, label: '6 (up to 8 cards)' }, { value: 8, label: '8 (up to 10 cards)' }] }
    ],
    rules: [
      { title: 'The deck', text: '118 letter cards. Ten of them carry two letters — cl, er, in, qu, th — and still count as one card. Every card is worth points.' },
      { title: 'The rounds', text: 'Eight rounds. The first deals three cards each, the last deals ten. On your turn, draw one card — from the deck or the top of the discard pile — then discard one.' },
      { title: 'Going out', text: 'When every card left in your hand after discarding can be arranged into words of two letters or more, lay them all down and go out. Everyone else gets one final turn, then lays down whatever they can.' },
      { title: 'Scoring', text: 'Add up the cards in the words you laid down, then subtract the cards you were left holding. Two bonuses of 10 points each round: the longest word, and the most words.' },
      { title: 'The word list', text: 'This table judges words against a 52,000-word list of ordinary English — no proper nouns, no abbreviations. Two-letter words come from the standard tournament set, so qi, za and xu all play.' }
    ]
  },

  euchre: {
    ...euchreEngine.meta,
    engine: euchreEngine, bot: euchreBot, component: EuchreTable, ready: noop,
    accent: '#2f6f9f',
    length: '20–30 min',
    blurb: 'Four players, two teams, twenty-four cards. Name the trump and take three of the five tricks, or hand the other side two points.',
    options: [
      { key: 'target', type: 'select', default: 10, label: 'Game to',
        choices: [{ value: 10, label: '10 points' }, { value: 7, label: '7 points' }, { value: 5, label: '5 points' }] },
      { key: 'stickTheDealer', type: 'toggle', default: false, label: 'Stick the dealer',
        help: 'If everyone passes twice, the dealer has to name a suit.' },
      { key: 'allowAlone', type: 'toggle', default: true, label: 'Allow going alone',
        help: 'Send your partner out and take all five for four points.' }
    ],
    rules: [
      { title: 'The deck', text: 'Twenty-four cards: nine, ten, jack, queen, king and ace in each suit. Seats across from each other are partners.' },
      { title: 'The bowers', text: 'The jack of the trump suit is the right bower and the highest card in the game. The other jack of the same colour is the left bower, second highest — and it counts as a trump, not as its printed suit. After those come ace, king, queen, ten, nine.' },
      { title: 'Naming trump', text: 'One card is turned up. Starting left of the dealer, each player may order it up — making that suit trump and giving the dealer the card — or pass. If all four pass, the card is turned down and each player may name any other suit, or pass again.' },
      { title: 'Playing', text: 'Five tricks. Follow suit if you can, remembering that the left bower belongs to the trump suit. Highest trump takes it, otherwise the highest card of the suit led.' },
      { title: 'Scoring', text: 'The side that named trump scores 1 point for three or four tricks and 2 for all five. Going alone and taking all five is worth 4. If they fail to take three, the other side is euchred them and takes 2.' }
    ]
  },

  cribbage: {
    ...cribbageEngine.meta,
    engine: cribbageEngine, bot: cribbageBot, component: CribbageTable, ready: noop,
    accent: '#7a5230',
    length: '20–30 min',
    blurb: 'Two hands, one crib, and a board to peg up. Fifteens, pairs and runs, counted twice: once as you play and once as you show.',
    options: [
      { key: 'target', type: 'select', default: 121, label: 'Game to',
        choices: [{ value: 121, label: '121 — the long game' }, { value: 61, label: '61 — once around' }] }
    ],
    rules: [
      { title: 'The deal', text: 'Six cards each. Both players lay two away into the crib, which belongs to the dealer and is counted last. Then the deck is cut for a starter card — if it is a jack, the dealer takes 2 straight away.' },
      { title: 'The play', text: 'Take turns laying cards down, calling the running total, which may not pass 31. Score 2 for making the count fifteen or thirty-one, 2 for a pair, 6 for three of a kind, 12 for four, and the length of any run of three or more.' },
      { title: 'Go', text: 'If you cannot play without going over 31, say go and your opponent keeps playing. The last player able to play takes a point, the count goes back to nothing, and the play carries on.' },
      { title: 'The show', text: 'Count the non-dealer’s hand, then the dealer’s, then the crib — each with the starter card. Every combination adding to fifteen is 2, every pair is 2, every run scores its length, four to a flush (five in the crib), and the jack matching the starter’s suit is one for his nobs.' },
      { title: 'Winning', text: 'First to 121 wins the moment they get there, mid-count if that is how it falls.' }
    ]
  },

  sequence: {
    ...sequenceEngine.meta,
    engine: sequenceEngine, bot: sequenceBot, component: SequenceTable, ready: noop,
    accent: '#3f8a55',
    length: '20–30 min',
    blurb: 'Play a card, cover its square on the board, and build five in a row. Two-eyed jacks go anywhere; one-eyed jacks take a chip off.',
    options: [],
    rules: [
      { title: 'The board', text: 'A hundred squares. The four corners are free spaces that count for everyone, and every other card in the deck is printed twice — so each card in your hand has two squares it could cover.' },
      { title: 'Your turn', text: 'Play one card, put a chip on a matching empty square, and draw a replacement. If both squares for a card are already covered, the card is dead: you may swap it for a new one once a turn.' },
      { title: 'The jacks', text: 'Two-eyed jacks — diamonds and clubs — are wild: put a chip on any empty square. One-eyed jacks — hearts and spades — remove one of an opponent’s chips, unless that chip is already part of a finished sequence.' },
      { title: 'Winning', text: 'A sequence is five chips in a row, up, across or diagonally, and corners count towards it. Two players need two sequences, three players need one. Two sequences may share a single chip, but no more.' },
      { title: 'About this board', text: 'The retail game has one printed layout. This board is built the same way in spirit — every non-jack card twice, free corners, suits running in a spiral — but it is not a copy of that arrangement.' }
    ]
  },

  backgammon: {
    ...backgammonEngine.meta,
    engine: backgammonEngine, bot: backgammonBot, component: BackgammonTable, ready: noop,
    accent: '#8a5a2b',
    length: '15–30 min a game',
    blurb: 'The oldest race there is. Run your checkers home and bear them off, and hit anything your opponent leaves alone on the way.',
    options: [
      { key: 'target', type: 'select', default: 5, label: 'Match to',
        choices: [{ value: 1, label: '1 point — one game' }, { value: 3, label: '3 points' }, { value: 5, label: '5 points' }, { value: 7, label: '7 points' }] }
    ],
    rules: [
      { title: 'The race', text: 'Fifteen checkers each, running in opposite directions around twenty-four points. Roll two dice and move one checker for each die, or one checker twice. Doubles are played four times.' },
      { title: 'Points and blots', text: 'You may land on any point that does not hold two or more enemy checkers. A lone checker is a blot: land on it and it goes to the bar, and it has to re-enter in your opponent’s home board before that side can do anything else.' },
      { title: 'Bearing off', text: 'Once all fifteen of your checkers are home, you can start bearing them off. A die takes a checker off the matching point, or off a lower point if nothing is further back. First side to bear off all fifteen wins.' },
      { title: 'Scoring', text: 'A game is worth 1 point, 2 for a gammon — the loser bore nothing off — and 3 for a backgammon, where the loser still has a checker on the bar or in the winner’s home board. Matches run to the target score.' },
      { title: 'No cube', text: 'This table plays without the doubling cube.' }
    ]
  },

  mastermind: {
    ...mastermindEngine.meta,
    engine: mastermindEngine, bot: mastermindBot, component: MastermindTable, ready: noop,
    accent: '#6b4a8c',
    length: '10–15 min',
    blurb: 'One of you hides four coloured pegs; the other has ten guesses and nothing but the marks beside each row to go on. Then you swap.',
    options: [
      { key: 'colours', type: 'select', default: 6, label: 'Colours',
        choices: [{ value: 6, label: '6 — standard' }, { value: 7, label: '7 — harder' }, { value: 8, label: '8 — cruel' }] },
      { key: 'pegs', type: 'select', default: 4, label: 'Pegs in the code',
        choices: [{ value: 4, label: '4' }, { value: 5, label: '5' }] },
      { key: 'rounds', type: 'select', default: 4, label: 'Rounds',
        choices: [{ value: 2, label: '2 — one each' }, { value: 4, label: '4' }, { value: 6, label: '6' }] },
      { key: 'repeats', type: 'toggle', default: true, label: 'Allow repeated colours',
        help: 'Turn this off and no colour appears twice in the code.' }
    ],
    rules: [
      { title: 'The code', text: 'One player hides a row of four pegs, chosen from six colours, repeats allowed. The other player cannot see it.' },
      { title: 'Guessing', text: 'The codebreaker lays down a row of four and is marked at once: a black mark for every peg that is the right colour in the right hole, a white mark for every peg that is the right colour somewhere else. Which mark belongs to which peg is never revealed.' },
      { title: 'Ten tries', text: 'Crack it inside ten guesses or the code stands. The board does the marking, so nobody can miscount — deliberately or otherwise.' },
      { title: 'Scoring', text: 'The codemaker scores one point for every guess it took, and one more if the code was never broken. Roles swap each round, so a hard code is worth as much as a sharp deduction.' }
    ]
  },

  reversi: {
    ...reversiEngine.meta,
    engine: reversiEngine, bot: reversiBot, component: ReversiTable, ready: noop,
    accent: '#4a4f55',
    length: '10–15 min',
    blurb: 'Trap a line of your opponent’s discs between two of yours and the whole line turns. Simple to hold in your head, hard to hold onto.',
    options: [
      { key: 'showHints', type: 'toggle', default: true, label: 'Show legal squares',
        help: 'Mark the squares you are allowed to play on.' }
    ],
    rules: [
      { title: 'The board', text: 'Eight by eight, four discs in the middle to start. Dark plays first.' },
      { title: 'Your move', text: 'Place a disc so that one or more straight lines of your opponent’s discs sit between it and another of yours. Every disc in those lines flips to your colour. If you cannot flip anything, you must pass.' },
      { title: 'The corners', text: 'A disc in a corner can never be flipped, which is why the squares beside a corner are the most dangerous ones on the board.' },
      { title: 'Winning', text: 'The game ends when neither side can move — usually when the board is full. Most discs wins.' }
    ]
  },

  yahtzee: {
    ...yahtzeeEngine.meta,
    engine: yahtzeeEngine, bot: yahtzeeBot, component: YahtzeeTable, ready: noop,
    accent: '#b8862c',
    length: '15–20 min',
    blurb: 'Five dice, three rolls a turn, and thirteen boxes to fill. Every box you take is one you can never use again.',
    options: [
      { key: 'bonusYahtzee', type: 'toggle', default: true, label: 'Bonus Yahtzees',
        help: 'A second five-of-a-kind is worth 100 extra and plays as a joker.' }
    ],
    rules: [
      { title: 'A turn', text: 'Roll all five dice, then re-roll any of them up to twice more, holding whatever you want to keep. When you stop, write the dice into one of the thirteen boxes on your card.' },
      { title: 'The upper half', text: 'Ones through sixes score the total of the matching dice. Reach 63 across those six boxes — three of each — and take a 35-point bonus.' },
      { title: 'The lower half', text: 'Three and four of a kind score the total of all five dice. A full house is 25, a small straight of four is 30, a large straight of five is 40, five of a kind is 50, and chance is whatever the dice add up to.' },
      { title: 'The catch', text: 'Every box must be filled by the end, so a bad turn means writing a zero somewhere. Choosing where is the whole game.' }
    ]
  }
};

export const GAME_LIST = Object.values(GAMES);
export function getGame(id) { return GAMES[id] ?? null; }

/** Default options object for a game, from its option descriptors. */
export function defaultOptions(game) {
  return Object.fromEntries((game.options ?? []).map((o) => [o.key, o.default]));
}
