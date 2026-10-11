// Maze Muncher: a knight in a dungeon maze grabs every coin while four monsters
// hunt for them, each in its own way. A potion turns the hunt around for a while.
// The maze is drawn fresh for this game. Art: Kenney's Tiny Dungeon (CC0).
import { pad, pick } from '../runtime.js';

// Left half of each row plus the centre column; the right half is the mirror.
// # wall · . coin · o potion · - monster door · H inside the house · T tunnel · space: solid rock
const HALF = [
  '###########',
  '#.........#',
  '#o##.####.#',
  '#..........',
  '#.##.#.####',
  '#....#....#',
  '####.####.#',
  '   #.#.....',
  '####.#.###-',
  'T....#.#HHH',
  '####.#.####',
  '   #.#.....',
  '####.#.####',
  '#.........#',
  '#.##.###...',
  '#o.#.......',
  '##.#.#.####',
  '#....#....#',
  '#.#######.#',
  '#..........',
  '###########'
];
export const MAZE = HALF.map((h) => h + [...h.slice(0, 10)].reverse().join(''));
const COLS = 21, ROWS = MAZE.length, TILE = 16, TOP = 24;
const W = COLS * TILE, H = TOP + ROWS * TILE + 20;
const TUNNEL = 9, DOOR = { c: 10, r: 8 }, OUTSIDE = { c: 10, r: 7 }, HOUSE = { c: 10, r: 9 };
const START = { c: 10, r: 15 };

// Tiny Dungeon (16 px).
const KNIGHT = 97, CHEST = 89, POTION = 115, WALL = 40, FLOOR = 0;
const MONSTERS = [
  { name: 'ghost', sprite: 121, corner: { c: COLS - 2, r: -3 }, home: { c: 10, r: 7 }, release: 0 },
  { name: 'bat', sprite: 120, corner: { c: 1, r: -3 }, home: { c: 10, r: 9 }, release: 60 },
  { name: 'slime', sprite: 108, corner: { c: COLS - 1, r: ROWS + 1 }, home: { c: 9, r: 9 }, release: 240 },
  { name: 'spider', sprite: 122, corner: { c: 0, r: ROWS + 1 }, home: { c: 11, r: 9 }, release: 420 }
];
const DIRS = { up: [0, -1], left: [-1, 0], down: [0, 1], right: [1, 0] };
const ORDER = ['up', 'left', 'down', 'right'];
const REVERSE = { up: 'down', down: 'up', left: 'right', right: 'left' };
// Scatter, chase, scatter, chase… in seconds; the last chase lasts.
const SCHEDULE = [7, 20, 7, 20, 5, Infinity];

const cell = (c, r) => {
  if (r === TUNNEL && (c < 0 || c >= COLS)) return 'T';
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return ' ';
  return MAZE[r][c];
};
const open = (c, r) => !'# -'.includes(cell(c, r)) && cell(c, r) !== 'H';

export default {
  width: W,
  height: H,
  sprites: { dungeon: 'sprites/dungeon.png' },
  sounds: ['start', 'chomp', 'power-pellet', 'eat-monster', 'bonus', 'die', 'clear', 'extra', 'gameover'],

  create(rt) {
    const sheet = rt.sheet('dungeon', 16);
    const { input, sound } = rt;
    let g;
    let board = null;

    // Walls and floor never change within a level: draw them once.
    function paintBoard(flash = false) {
      const c = document.createElement('canvas');
      c.width = W; c.height = ROWS * TILE;
      const b = c.getContext('2d');
      b.imageSmoothingEnabled = false;
      b.fillStyle = '#120d14';
      b.fillRect(0, 0, c.width, c.height);
      for (let r = 0; r < ROWS; r++) {
        for (let col = 0; col < COLS; col++) {
          const ch = MAZE[r][col];
          if (ch === '#') sheet.draw(b, WALL, col * TILE, r * TILE, flash ? { tint: '#ffffff' } : {});
          else if (ch !== ' ') sheet.draw(b, FLOOR, col * TILE, r * TILE, { alpha: 0.55 });
        }
      }
      b.fillStyle = '#e8a0ff';
      b.fillRect(DOOR.c * TILE, DOOR.r * TILE + 6, TILE, 4);
      return c;
    }

    function newLevel() {
      g.level++;
      g.dots = new Set();
      g.potions = new Set();
      MAZE.forEach((row, r) => [...row].forEach((ch, c) => {
        if (ch === '.') g.dots.add(`${c},${r}`);
        if (ch === 'o') g.potions.add(`${c},${r}`);
      }));
      g.dots.delete(`${START.c},${START.r}`);
      g.total = g.dots.size + g.potions.size;
      g.eaten = 0;
      g.fruit = null;
      g.fruitsShown = 0;
      board = paintBoard();
      startRound();
    }

    function startRound() {
      g.p = { x: START.c, y: START.r, dir: 'left', want: 'left', mouth: 0 };
      g.mons = MONSTERS.map((m, i) => ({
        ...m, x: m.home.c, y: m.home.r, dir: i === 0 ? 'left' : 'up',
        mode: i === 0 ? 'active' : 'house', wait: m.release, scared: 0
      }));
      g.phase = 0;
      g.phaseT = SCHEDULE[0] * 60;
      g.scared = 0;
      g.chain = 0;
      g.ready = 120;
      g.dying = 0;
    }

    function reset() {
      g = { score: 0, lives: 2, level: 0, over: false, extraAt: 10000, flash: 0 };
      newLevel();
    }

    const speedFor = (who, m) => {
      const lvl = Math.min(g.level - 1, 6) * 0.004;
      if (who === 'p') return 0.085 + lvl;
      if (m.mode === 'eaten') return 0.17;
      if (cell(Math.round(m.x), Math.round(m.y)) === 'T' || (Math.round(m.y) === TUNNEL && (m.x < 4 || m.x > COLS - 5))) return 0.045;
      if (m.scared) return 0.05;
      return 0.078 + lvl;
    };

    /**
     * Walk an actor along the grid at `speed` tiles a frame. At each tile
     * centre `decide` may change its direction; it stops if walled in.
     */
    function walk(a, speed, decide) {
      let rem = speed;
      for (let guard = 0; guard < 4 && rem > 1e-6; guard++) {
        const atCentre = Math.abs(a.x - Math.round(a.x)) < 1e-6 && Math.abs(a.y - Math.round(a.y)) < 1e-6;
        if (atCentre) {
          a.x = Math.round(a.x); a.y = Math.round(a.y);
          decide(a);
          const [dx, dy] = DIRS[a.dir];
          if (!open(a.x + dx, a.y + dy)) return false;
        }
        const [dx, dy] = DIRS[a.dir];
        const along = dx ? a.x : a.y;
        const sign = dx || dy;
        const next = sign > 0 ? Math.floor(along + 1e-6) + 1 : Math.ceil(along - 1e-6) - 1;
        const step = Math.min(rem, Math.abs(next - along));
        if (dx) a.x += dx * step; else a.y += dy * step;
        rem -= step;
        if (a.y === TUNNEL || Math.round(a.y) === TUNNEL) {
          if (a.x < -0.5) a.x += COLS;
          if (a.x > COLS - 0.5) a.x -= COLS;
        }
      }
      return true;
    }

    function chaseTarget(m) {
      const p = g.p;
      const [dx, dy] = DIRS[p.dir];
      if (m.name === 'ghost') return { c: p.x, r: p.y };
      if (m.name === 'bat') return { c: p.x + dx * 4, r: p.y + dy * 4 };
      if (m.name === 'slime') {
        const ghost = g.mons[0];
        const ax = p.x + dx * 2, ay = p.y + dy * 2;
        return { c: ax * 2 - ghost.x, r: ay * 2 - ghost.y };
      }
      return Math.hypot(m.x - p.x, m.y - p.y) > 8 ? { c: p.x, r: p.y } : m.corner;
    }

    function steer(m, target) {
      const options = ORDER.filter((d) => d !== REVERSE[m.dir] && open(m.x + DIRS[d][0], m.y + DIRS[d][1]));
      if (!options.length) { m.dir = REVERSE[m.dir]; return; }
      if (m.scared && m.mode === 'active') { m.dir = pick(options); return; }
      let best = options[0], bestD = Infinity;
      for (const d of options) {
        const dist = (m.x + DIRS[d][0] - target.c) ** 2 + (m.y + DIRS[d][1] - target.r) ** 2;
        if (dist < bestD) { bestD = dist; best = d; }
      }
      m.dir = best;
    }

    /** Scripted moves in and out of the house: straight lines, through the door. */
    function glide(m, to, speed) {
      const dx = to.c - m.x, dy = to.r - m.y;
      if (Math.abs(dx) > 1e-6) { m.x += Math.sign(dx) * Math.min(speed, Math.abs(dx)); m.dir = dx > 0 ? 'right' : 'left'; return false; }
      if (Math.abs(dy) > 1e-6) { m.y += Math.sign(dy) * Math.min(speed, Math.abs(dy)); m.dir = dy > 0 ? 'down' : 'up'; return false; }
      return true;
    }

    function updateMonster(m) {
      if (m.scared) m.scared--;
      if (m.mode === 'house') {
        m.y = m.home.r + Math.sin(rt.frame / 12) * 0.2;
        if (--m.wait <= 0) m.mode = 'leaving';
        return;
      }
      if (m.mode === 'leaving') {
        const target = Math.abs(m.x - HOUSE.c) > 1e-6 ? { c: HOUSE.c, r: m.home.r } : OUTSIDE;
        if (Math.abs(m.x - HOUSE.c) > 1e-6) m.y = m.home.r;
        if (glide(m, target, 0.06) && target === OUTSIDE) { m.mode = 'active'; m.dir = 'left'; }
        return;
      }
      if (m.mode === 'entering') {
        if (glide(m, HOUSE, 0.12)) { m.mode = 'leaving'; m.scared = 0; }
        return;
      }
      if (m.mode === 'eaten') {
        if (Math.round(m.x) === OUTSIDE.c && Math.round(m.y) === OUTSIDE.r && Math.abs(m.x - OUTSIDE.c) < 0.2 && Math.abs(m.y - OUTSIDE.r) < 0.2) {
          m.x = OUTSIDE.c; m.y = OUTSIDE.r; m.mode = 'entering';
          return;
        }
        walk(m, speedFor('m', m), (a) => steer(a, OUTSIDE));
        return;
      }
      const chase = g.phase % 2 === 1;
      walk(m, speedFor('m', m), (a) => steer(a, chase ? chaseTarget(a) : a.corner));
    }

    function eatAt(c, r) {
      const key = `${((c % COLS) + COLS) % COLS},${r}`;
      if (g.dots.delete(key)) {
        g.score += 10;
        g.eaten++;
        sound.play('chomp', { volume: 0.25, rate: g.eaten % 2 ? 1 : 1.2 });
      } else if (g.potions.delete(key)) {
        g.score += 50;
        g.eaten++;
        g.chain = 0;
        g.scared = Math.max(120, 420 - g.level * 40);
        for (const m of g.mons) {
          if (m.mode === 'active') { m.scared = g.scared; m.dir = REVERSE[m.dir]; }
        }
        sound.play('power-pellet', { volume: 0.6 });
      } else return;
      if (g.eaten === 60 || g.eaten === 130) g.fruit = { t: 600 };
    }

    function update() {
      if (g.overTimer != null) { if (--g.overTimer <= 0) g.over = true; return; }
      if (g.flash > 0) {
        if (--g.flash % 15 === 0) board = paintBoard(Math.floor(g.flash / 15) % 2 === 1);
        if (g.flash === 0) newLevel();
        return;
      }
      if (g.ready > 0) { g.ready--; return; }
      if (g.dying > 0) {
        if (--g.dying === 0) {
          if (g.lives === 0) { g.overTimer = 30; return; }
          g.lives--;
          startRound();
        }
        return;
      }
      const p = g.p;
      for (const d of ORDER) if (input.pressed(d) || input.held(d)) p.want = d;
      // Turn round on the spot; other turns wait for the next corner.
      if (p.want === REVERSE[p.dir]) p.dir = p.want;
      const moved = walk(p, speedFor('p'), (a) => {
        if (open(a.x + DIRS[a.want][0], a.y + DIRS[a.want][1])) a.dir = a.want;
        eatAt(a.x, a.y);
      });
      if (moved) p.mouth++;

      if (g.scared > 0) g.scared--;
      else if (--g.phaseT <= 0 && g.phase < SCHEDULE.length - 1) {
        g.phase++;
        g.phaseT = SCHEDULE[g.phase] * 60;
        for (const m of g.mons) if (m.mode === 'active') m.dir = REVERSE[m.dir];
      }
      for (const m of g.mons) updateMonster(m);

      // Touching a monster.
      for (const m of g.mons) {
        if (m.mode !== 'active' && m.mode !== 'leaving') continue;
        const dx = Math.abs(m.x - p.x), dy = Math.abs(m.y - p.y);
        if (Math.min(dx, COLS - dx) < 0.55 && dy < 0.55) {
          if (m.scared) {
            g.chain++;
            const value = 100 * 2 ** g.chain;
            g.score += value;
            g.popup = { x: m.x, y: m.y, value, t: 60 };
            m.mode = 'eaten';
            m.scared = 0;
            sound.play('eat-monster', { volume: 0.7 });
          } else {
            g.dying = 100;
            sound.play('die', { volume: 0.8 });
            return;
          }
        }
      }
      if (g.popup && --g.popup.t <= 0) g.popup = null;

      if (g.fruit) {
        if (--g.fruit.t <= 0) g.fruit = null;
        else if (Math.abs(p.x - 10) < 0.5 && Math.abs(p.y - 11) < 0.5) {
          const value = 100 * Math.min(g.level, 8) + 100;
          g.score += value;
          g.popup = { x: 10, y: 11, value, t: 90 };
          g.fruit = null;
          sound.play('bonus');
        }
      }
      if (g.score >= g.extraAt) { g.lives++; g.extraAt = Infinity; sound.play('extra'); }
      if (!g.dots.size && !g.potions.size) { g.flash = 120; sound.play('clear'); }
    }

    const px = (x) => Math.round(x * TILE);
    const py = (y) => Math.round(TOP + y * TILE);

    function draw(ctx, state) {
      ctx.fillStyle = '#07060c';
      ctx.fillRect(0, 0, W, H);
      if (!g) return;
      ctx.drawImage(board, 0, TOP);
      ctx.fillStyle = '#ffd84a';
      for (const key of g.dots) {
        const [c, r] = key.split(',').map(Number);
        ctx.fillRect(c * TILE + 7, TOP + r * TILE + 7, 3, 3);
      }
      const bob = Math.sin(rt.frame / 8) * 1.5;
      for (const key of g.potions) {
        const [c, r] = key.split(',').map(Number);
        if (Math.floor(rt.frame / 15) % 2 || state !== 'play') sheet.draw(ctx, POTION, c * TILE, TOP + r * TILE + bob);
      }
      if (g.fruit) sheet.draw(ctx, CHEST, px(10), py(11));

      const p = g.p;
      if (g.dying) {
        const t = 1 - g.dying / 100;
        sheet.draw(ctx, KNIGHT, px(p.x), py(p.y), { rot: t * Math.PI * 4, alpha: Math.max(0, 1 - t * 1.2) });
      } else {
        const step = Math.floor(p.mouth / 6) % 2;
        sheet.draw(ctx, KNIGHT, px(p.x), py(p.y) - step, { flipX: p.dir === 'left' });
      }
      if (!g.dying || g.dying > 70) {
        for (const m of g.mons) {
          const o = { flipX: m.dir === 'left' };
          if (m.mode === 'eaten' || m.mode === 'entering') o.alpha = 0.3;
          else if (m.scared) o.tint = m.scared < 120 && Math.floor(m.scared / 10) % 2 ? '#ffffff' : '#3d5afe';
          sheet.draw(ctx, m.sprite, px(m.x), py(m.y) + Math.sin((rt.frame + m.release) / 10), o);
        }
      }
      if (g.popup) rt.text(String(g.popup.value), px(g.popup.x) + 8, py(g.popup.y) + 4, { align: 'center', color: '#7fe9ff' });
      if (g.ready > 0 && state === 'play') rt.text('READY!', W / 2, py(11) + 4, { align: 'center', color: '#ffd84a' });

      rt.text('SCORE', 6, 6, { color: '#ffd84a' });
      rt.text(pad(g.score), 54, 6);
      rt.text('HI', W - 82, 6, { color: '#ffd84a' });
      rt.text(pad(Math.max(rt.hi, g.score)), W - 6, 6, { align: 'right' });
      for (let i = 0; i < Math.min(5, g.lives); i++) sheet.draw(ctx, KNIGHT, 4 + i * 16, H - 18);
      rt.text(`LEVEL ${g.level}`, W - 6, H - 13, { align: 'right', color: '#ffd84a' });
    }

    reset();
    g.ready = 0;

    return {
      get score() { return g.score; },
      get over() { return g.over; },
      /** For tests: the live game state. */
      get state() { return g; },
      reset,
      update,
      draw
    };
  }
};
