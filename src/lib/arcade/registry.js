// The arcade shelf. Each game's code loads only when someone opens it.
export const ARCADE = [
  {
    id: 'skyswarm',
    icons: [{ src: 'sprites/shmup-ships.png', size: 32, n: 4 }, { src: 'sprites/shmup-ships.png', size: 32, n: 13, flip: true }, { src: 'sprites/shmup-ships.png', size: 32, n: 9, flip: true }],
    name: 'Sky Swarm',
    short: 'HOLD THE SKY',
    color: '#4fc3ff',
    blurb: 'Squadrons fly in, line up, then peel off and dive at you. Clear the formation before it clears you.',
    keys: '◀ ▶ MOVE · SPACE FIRE · P PAUSE',
    load: () => import('./games/skyswarm.js'),
    controls: { dpad: 'lr', buttons: [{ action: 'a', label: 'FIRE' }] }
  },
  {
    id: 'invaders',
    icons: [{ src: 'sprites/platformer-chars.png', size: 24, n: 24 }, { src: 'sprites/platformer-chars.png', size: 24, n: 15 }, { src: 'sprites/platformer-chars.png', size: 24, n: 18 }],
    name: 'Invaders from Above',
    short: 'THEY KEEP COMING',
    color: '#7dff8a',
    blurb: 'Row after row marches down, faster with every one you hit. Hide behind the bunkers while they last.',
    keys: '◀ ▶ MOVE · SPACE FIRE · P PAUSE',
    load: () => import('./games/invaders.js'),
    controls: { dpad: 'lr', buttons: [{ action: 'a', label: 'FIRE' }] }
  },
  {
    id: 'roadhopper',
    icons: [{ src: 'sprites/urban.png', size: 16, n: 23 }, { src: 'sprites/cars/taxi.png', w: 33, h: 14 }],
    name: 'Road Hopper',
    short: 'MIND THE TRAFFIC',
    color: '#ffb84a',
    blurb: 'Five lanes of traffic, then a river of drifting logs. Get all five travellers home before the clock runs out.',
    keys: 'ARROWS HOP · P PAUSE · SWIPE ON A PHONE',
    load: () => import('./games/roadhopper.js'),
    controls: { dpad: '4way', buttons: [], swipe: true }
  },
  {
    id: 'mazemuncher',
    icons: [{ src: 'sprites/dungeon.png', size: 16, n: 97 }, { src: 'sprites/dungeon.png', size: 16, n: 121 }, { src: 'sprites/dungeon.png', size: 16, n: 108 }],
    name: 'Maze Muncher',
    short: 'GRAB EVERY COIN',
    color: '#ffd84a',
    blurb: 'A dungeon maze full of coins and four monsters who want you gone. Drink a potion and the hunt turns around.',
    keys: 'ARROWS MOVE · P PAUSE · SWIPE ON A PHONE',
    load: () => import('./games/mazemuncher.js'),
    controls: { dpad: '4way', buttons: [], swipe: true }
  },
  {
    id: 'barrelclimb',
    icons: [{ src: 'sprites/platformer-chars.png', size: 24, n: 9 }, { src: 'sprites/dungeon.png', size: 16, n: 82 }, { src: 'sprites/platformer-chars.png', size: 24, n: 21 }],
    name: 'Barrel Climb',
    short: 'UP THE GIRDERS',
    color: '#ff7a5c',
    blurb: 'A robot at the top is rolling barrels down the girders. Climb, jump them, and reach your friend at the top.',
    keys: 'ARROWS MOVE · LADDERS UP/DOWN · SPACE JUMP',
    load: () => import('./games/barrelclimb.js'),
    controls: { dpad: '4way', buttons: [{ action: 'a', label: 'JUMP' }] }
  }
];

export const getArcadeGame = (id) => ARCADE.find((g) => g.id === id) ?? null;
