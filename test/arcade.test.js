// The arcade games, run without a screen: a stand-in cabinet steps each game
// at 60 Hz with scripted input, and the tests check the rules hold.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Input, Sheet } from '../src/lib/arcade/runtime.js';
import skyswarm from '../src/lib/arcade/games/skyswarm.js';
import invaders from '../src/lib/arcade/games/invaders.js';
import roadhopper from '../src/lib/arcade/games/roadhopper.js';
import mazemuncher, { MAZE } from '../src/lib/arcade/games/mazemuncher.js';
import barrelclimb from '../src/lib/arcade/games/barrelclimb.js';

// Just enough canvas for games that paint into their own (the bunkers).
const ctxStub = new Proxy({}, {
  get: (_, key) => key === 'getImageData'
    ? (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255) })
    : () => {}
});
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctxStub }) };

function cabinet(def) {
  const input = new Input();
  const img = { width: 512, height: 512 };
  const images = Object.fromEntries(Object.keys(def.sprites).map((k) => [k, { width: 33, height: 14 }]));
  const rt = {
    images, input, width: def.width, height: def.height, hi: 0, frame: 0,
    sheet: (name, size, h) => new Sheet(img, size, h),
    sound: { play() {}, loop() {}, stop() {}, stopAll() {} },
    text() {}
  };
  const game = def.create(rt);
  game.reset();
  return {
    game, input, rt,
    get s() { return game.state; },
    /** Run n frames, holding `hold` and pressing `press` on the first. */
    run(n, { hold = [], press = [], each } = {}) {
      for (let i = 0; i < n; i++) {
        for (const a of hold) input.press(a);
        if (i === 0) for (const a of press) input.tap(a);
        rt.frame++;
        game.update();
        input.endFrame();
        for (const a of hold) input.release(a);
        each?.(i);
        if (game.over) return;
      }
    }
  };
}

test('maze: every coin and potion can be reached from the start', () => {
  const seen = new Set(['10,15']);
  const queue = [[10, 15]];
  const open = (c, r) => MAZE[r]?.[c] != null && !'# -H'.includes(MAZE[r][c]);
  while (queue.length) {
    const [c, r] = queue.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let nc = c + dc;
      if (r === 9 && nc < 0) nc = 20;
      if (r === 9 && nc > 20) nc = 0;
      if (!open(nc, r + dr) || seen.has(`${nc},${r + dr}`)) continue;
      seen.add(`${nc},${r + dr}`);
      queue.push([nc, r + dr]);
    }
  }
  MAZE.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === '.' || ch === 'o') assert.ok(seen.has(`${c},${r}`), `coin at ${c},${r} is walled off`);
  }));
  assert.ok(MAZE.every((row) => row.length === 21));
});

test('maze: monsters leave the house and hunt; a potion turns them', () => {
  const c = cabinet(mazemuncher);
  c.run(130); // READY!
  c.run(600, { hold: ['left'] });
  const active = c.s.mons.filter((m) => m.mode === 'active').length;
  assert.ok(active >= 3, `only ${active} monsters out after 10 s`);
  // Put the knight next to a potion and walk into it.
  const s = c.s;
  if (!s.dying) {
    s.p.x = 2; s.p.y = 15; s.p.dir = 'left'; s.p.want = 'left';
    c.run(30, { hold: ['left'] });
    if (!s.dying) assert.ok(s.mons.some((m) => m.scared > 0), 'potion did not scare anyone');
  }
});

test('maze: eating the last coin starts the next level', () => {
  const c = cabinet(mazemuncher);
  c.run(130);
  const s = c.s;
  s.dots.clear();
  s.potions.clear();
  c.run(1);
  assert.ok(s.flash > 0);
  c.run(130);
  assert.equal(s.level, 2);
  assert.ok(s.dots.size > 100);
});

test('barrels: every one thrown reaches the bottom and rolls away', () => {
  const c = cabinet(barrelclimb);
  const s = c.s;
  s.p.x = 230; s.p.y = 284; // stand out of the way at the far right
  let thrown = 0;
  c.run(60 * 40, {
    each: () => {
      s.bonus = 5000; s.dying = 0; s.p.hammer = 999; // keep the run going
      thrown = Math.max(thrown, s.barrels.length);
    }
  });
  assert.ok(thrown > 0, 'nothing was thrown');
  for (const b of s.barrels) assert.ok(b.y < 330 && b.x > -30 && b.x < 280, 'a barrel left the level without being removed');
});

test('barrels: the ladders lead all the way to the top', () => {
  const c = cabinet(barrelclimb);
  const s = c.s;
  const route = [196, 60, 196, 40, 204, 150]; // a full ladder from each floor
  for (const ladderX of route) {
    for (let i = 0; i < 400 && Math.abs(s.p.x + 12 - (ladderX + 8)) > 2; i++) {
      s.barrels = []; s.throwIn = 9999;
      c.run(1, { hold: [s.p.x + 12 < ladderX + 8 ? 'right' : 'left'] });
    }
    const floor = s.p.on;
    for (let i = 0; i < 300 && s.p.on === floor; i++) { s.barrels = []; c.run(1, { hold: ['up'] }); }
    assert.equal(s.p.on, floor + 1, `stuck on floor ${floor} at x ${s.p.x}`);
  }
  c.run(2);
  assert.ok(s.won > 0, 'reaching the top did not win');
});

test('road: hopping a clear road reaches the median, and logs carry you', () => {
  const c = cabinet(roadhopper);
  const s = c.s;
  for (const lane of s.lanes.road) lane.items = [];
  for (let i = 0; i < 6; i++) c.run(10, { press: ['up'] });
  assert.equal(s.p.row, 6);
  assert.ok(!s.p.dead);
  // A log under the first river lane: hop on and drift.
  const lane = s.lanes.river[0];
  lane.items = [{ x: s.p.x - 10, w: 120, dives: false, phase: 0 }];
  c.run(10, { press: ['up'] });
  const x = s.p.x;
  c.run(30);
  assert.ok(!s.p.dead, 'drowned on a log');
  assert.ok(Math.abs(s.p.x - x) > 5, 'the log did not carry the traveller');
  // Open water drowns.
  lane.items = [];
  c.run(5);
  assert.ok(s.p.dead);
});

test('road: getting home scores and fills a door', () => {
  const c = cabinet(roadhopper);
  const s = c.s;
  s.p.row = 11; s.p.x = 8 + 4;
  s.lanes.river[4].items = [{ x: 0, w: 200, dives: false, phase: 0 }];
  const before = s.score;
  c.run(10, { press: ['up'] });
  assert.ok(s.homes[0], 'home not filled');
  assert.ok(s.score > before + 50);
  assert.equal(s.p.row, 0);
});

test('sky: squadrons arrive, settle into formation, and a cleared stage moves on', () => {
  const c = cabinet(skyswarm);
  const s = c.s;
  c.run(60 * 14);
  const settled = s.enemies.filter((e) => e.state === 'formation' || e.state === 'diving' || e.state === 'returning').length;
  assert.ok(settled > 20, `only ${settled} in the sky`);
  for (const e of s.enemies) e.state = 'dead';
  c.run(100);
  assert.equal(s.stage, 2);
});

test('sky: firing scores, and the game ends when the last ship is lost', () => {
  const c = cabinet(skyswarm);
  const s = c.s;
  c.run(60 * 12, { each: (i) => { if (i % 8 === 0) c.input.tap('a'); } });
  assert.ok(s.score > 0, 'never hit anything');
  s.lives = 0;
  s.player.safe = 0;
  s.bombs.push({ x: s.player.x + 8, y: 270, vx: 0, vy: 2 });
  c.run(300);
  assert.ok(c.game.over);
});

test('invaders: the march reaches an edge and steps down', () => {
  const c = cabinet(invaders);
  const s = c.s;
  const top = Math.min(...s.invaders.map((i) => i.y));
  c.run(60 * 25, { each: () => { s.bombs = []; } });
  assert.ok(Math.min(...s.invaders.filter((i) => i.alive).map((i) => i.y)) > top, 'never stepped down');
});

test('invaders: clearing a wave brings the next, a row lower', () => {
  const c = cabinet(invaders);
  const s = c.s;
  const firstTop = Math.min(...s.invaders.map((i) => i.y));
  for (const inv of s.invaders) inv.alive = false;
  c.run(100);
  assert.equal(s.wave, 2);
  assert.ok(Math.min(...s.invaders.map((i) => i.y)) > firstTop);
});
