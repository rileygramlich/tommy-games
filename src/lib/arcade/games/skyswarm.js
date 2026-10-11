// Sky Swarm: squadrons swoop in, settle into formation, then peel off and dive.
// Art: Kenney's Pixel Shmup (CC0). Planes face up on the sheet; enemies are
// turned to face the way they fly.
import { clamp, pad, pick, rand, overlap } from '../runtime.js';

const W = 240, H = 320;
const PLAYER_Y = H - 44;

// Ship sheet (32 px): small coloured planes, and the big grey bombers.
const SHIP = { player: 4, bee: 9, butterfly: 10, wasp: 11, boss: 13, bossHurt: 15 };
// Tile sheet (16 px).
const TILE = { shot: 2, enemyShot: 12, boom: [4, 5, 6, 7, 8], power: 25, water: 42, flag: 96 };
const ISLANDS = [
  [37, 38, 39, 49, 50, 51, 61, 62, 63],   // green
  [43, 44, 45, 55, 56, 57, 67, 68, 69]    // sand
];

const KINDS = {
  boss: { sprite: SHIP.boss, hp: 2, score: [150, 400] },
  butterfly: { sprite: SHIP.butterfly, hp: 1, score: [80, 160] },
  wasp: { sprite: SHIP.wasp, hp: 1, score: [80, 160] },
  bee: { sprite: SHIP.bee, hp: 1, score: [50, 100] }
};

// Formation slots: row kinds and how many in each row.
const ROWS = [
  { kind: 'boss', cols: 4 },
  { kind: 'butterfly', cols: 8 },
  { kind: 'wasp', cols: 8 },
  { kind: 'bee', cols: 8 },
  { kind: 'bee', cols: 8 }
];
const SPACING = 24, TOP = 44;

/** A smooth curve through points, walked at a constant speed. */
class Path {
  constructor(points) {
    this.samples = [];
    const p = [points[0], ...points, points[points.length - 1]];
    for (let i = 1; i < p.length - 2; i++) {
      for (let t = 0; t < 1; t += 0.05) {
        const [a, b, c, d] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
        const t2 = t * t, t3 = t2 * t;
        this.samples.push({
          x: 0.5 * (2 * b.x + (-a.x + c.x) * t + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * t2 + (-a.x + 3 * b.x - 3 * c.x + d.x) * t3),
          y: 0.5 * (2 * b.y + (-a.y + c.y) * t + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * t2 + (-a.y + 3 * b.y - 3 * c.y + d.y) * t3)
        });
      }
    }
    this.samples.push(points[points.length - 1]);
    this.lengths = [0];
    for (let i = 1; i < this.samples.length; i++) {
      const a = this.samples[i - 1], b = this.samples[i];
      this.lengths.push(this.lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.length = this.lengths[this.lengths.length - 1];
  }

  at(d) {
    const s = this.samples, L = this.lengths;
    if (d >= this.length) return { ...s[s.length - 1], angle: this.angle(s.length - 1), done: true };
    let i = 1;
    while (L[i] < d) i++;
    const f = (d - L[i - 1]) / (L[i] - L[i - 1] || 1);
    return { x: s[i - 1].x + (s[i].x - s[i - 1].x) * f, y: s[i - 1].y + (s[i].y - s[i - 1].y) * f, angle: this.angle(i), done: false };
  }

  angle(i) {
    const s = this.samples;
    const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i)];
    return Math.atan2(b.y - a.y, b.x - a.x);
  }
}

export default {
  width: W,
  height: H,
  sprites: { ships: 'sprites/shmup-ships.png', tiles: 'sprites/shmup-tiles.png' },
  sounds: ['start', 'shoot', 'enemy-shoot', 'explode', 'explode-big', 'dive', 'powerup', 'clear', 'extra', 'die', 'gameover'],

  create(rt) {
    const ships = rt.sheet('ships', 32);
    const tiles = rt.sheet('tiles', 16);
    const { input, sound } = rt;

    let g;
    let scroll = 0;
    let islands = [];

    function newIsland(y) {
      return { x: rand(-16, W - 32), y, set: pick(ISLANDS) };
    }
    for (let i = 0; i < 4; i++) islands.push(newIsland(i * 110 - 40));

    function reset() {
      g = {
        score: 0, lives: 2, stage: 0, over: false, extraAt: 20000,
        player: { x: W / 2 - 16, alive: true, respawn: 0, safe: 0, dual: 0 },
        shots: [], bombs: [], booms: [], drops: [], enemies: [],
        sway: 0, t: 0, banner: 0, entering: [], diveTimer: 120, clearTimer: 0
      };
      nextStage();
    }

    function slotPos(e) {
      const offset = Math.sin(g.sway) * 14;
      const breathe = 1 + Math.sin(g.sway * 0.7) * 0.04;
      const spacing = e.kind === 'boss' ? 34 : SPACING; // the bombers are wider
      return { x: W / 2 + (e.col - (e.cols - 1) / 2) * spacing * breathe + offset - 16, y: TOP + e.row * 22 - 16 + (e.row > 0 ? 6 : 0) };
    }

    function nextStage() {
      g.stage++;
      g.banner = 150;
      g.enemies = [];
      g.entering = [];
      // Five squadrons; each flies one of four mirrored entry paths.
      const groups = [[], [], [], [], []];
      ROWS.forEach((r, row) => {
        for (let col = 0; col < r.cols; col++) {
          const e = { kind: r.kind, row, col, cols: r.cols, hp: KINDS[r.kind].hp, state: 'waiting', d: 0, path: null, x: -50, y: -50, angle: Math.PI / 2, flash: 0 };
          g.enemies.push(e);
          const group = row === 0 ? 0 : row <= 2 ? (col < r.cols / 2 ? 1 : 2) : (col < r.cols / 2 ? 3 : 4);
          groups[group].push(e);
        }
      });
      groups.forEach((list, gi) => {
        list.forEach((e, i) => { g.entering.push({ e, at: 90 + gi * 150 + i * 9, gi }); });
      });
    }

    function entryPath(e, gi) {
      const left = gi % 2 === 1 || (gi === 0 && e.col < 2);
      const s = left ? -1 : 1;
      const cx = W / 2;
      const start = gi <= 2 && gi > 0
        ? { x: cx - s * (W / 2 + 30), y: H * 0.62 }
        : { x: cx + s * 40, y: -24 };
      const slot = slotPos(e);
      return new Path([
        start,
        { x: cx - s * 30, y: H * 0.5 },
        { x: cx + s * 50, y: H * 0.42 },
        { x: cx + s * 20, y: H * 0.28 },
        { x: slot.x + 16, y: slot.y + 16 }
      ]);
    }

    function divePath(e) {
      const px = g.player.x + 16;
      const s = e.x + 16 < W / 2 ? -1 : 1;
      return new Path([
        { x: e.x + 16, y: e.y + 16 },
        { x: e.x + 16 + s * 26, y: e.y - 4 },
        { x: e.x + 16 + s * 10, y: e.y + 60 },
        { x: clamp(px + rand(-40, 40), 20, W - 20), y: H * 0.7 },
        { x: clamp(px + rand(-80, 80), 0, W), y: H + 40 }
      ]);
    }

    function addBoom(x, y, big = false) {
      g.booms.push({ x, y, t: 0, big });
    }

    function killPlayer() {
      const p = g.player;
      p.alive = false;
      p.respawn = 150;
      p.dual = 0;
      addBoom(p.x + 8, PLAYER_Y + 8, true);
      sound.play('explode-big');
      sound.play('die', { volume: 0.7 });
      // Lives are the ships in reserve: losing the last one ends it.
      if (g.lives === 0) g.overTimer = 100;
      else g.lives--;
    }

    function hitEnemy(e) {
      e.hp--;
      if (e.hp > 0) {
        e.flash = 8;
        sound.play('explode', { volume: 0.4, rate: 1.5 });
        return;
      }
      const diving = e.state === 'diving' || e.state === 'returning';
      g.score += KINDS[e.kind].score[diving ? 1 : 0];
      e.state = 'dead';
      addBoom(e.x + 8, e.y + 8, e.kind === 'boss');
      sound.play('explode', { volume: 0.7 });
      if (e.kind === 'boss' && Math.random() < 0.5) g.drops.push({ x: e.x + 8, y: e.y + 8 });
    }

    function update() {
      g.t++;
      g.sway += 0.02;
      scrollBackground(0.6);

      if (g.overTimer != null) {
        if (--g.overTimer <= 0) g.over = true;
        updateEffects();
        return;
      }

      if (g.banner > 0) g.banner--;
      const p = g.player;

      // The player.
      if (p.alive) {
        const speed = 2.2;
        if (input.held('left')) p.x -= speed;
        if (input.held('right')) p.x += speed;
        p.x = clamp(p.x, 0, W - 32);
        if (p.safe > 0) p.safe--;
        if (p.dual > 0) p.dual--;
        const max = p.dual ? 4 : 2;
        if (input.pressed('a') && g.shots.length < max) {
          if (p.dual) {
            g.shots.push({ x: p.x + 7, y: PLAYER_Y + 4 }, { x: p.x + 17, y: PLAYER_Y + 4 });
          } else {
            g.shots.push({ x: p.x + 12, y: PLAYER_Y });
          }
          sound.play('shoot', { volume: 0.35 });
        }
      } else if (--p.respawn <= 0 && g.overTimer == null) {
        const busy = g.enemies.some((e) => e.state === 'diving');
        if (!busy || p.respawn < -120) {
          p.alive = true;
          p.safe = 120;
          p.x = W / 2 - 16;
        }
      }

      // Squadrons arriving.
      for (const slot of g.entering) {
        if (slot.started || g.t < slot.at) continue;
        slot.started = true;
        slot.e.state = 'entering';
        slot.e.path = entryPath(slot.e, slot.gi);
        slot.e.d = 0;
      }

      // Enemies.
      const alive = g.enemies.filter((e) => e.state !== 'dead');
      const speed = 2.3 + Math.min(1.2, g.stage * 0.12);
      for (const e of alive) {
        if (e.flash) e.flash--;
        if (e.state === 'waiting') continue;
        if (e.state === 'formation') {
          const s = slotPos(e);
          e.x = s.x; e.y = s.y;
          e.angle = Math.PI / 2;
          // Later stages: the line itself takes shots at you.
          if (g.stage >= 3 && p.alive && Math.random() < 0.0004 * g.stage) fireAt(e);
          continue;
        }
        e.d += speed;
        const at = e.path.at(e.d);
        e.x = at.x - 16; e.y = at.y - 16; e.angle = at.angle;
        if (e.state === 'diving' && p.alive && e.ammo > 0 && e.y > H * 0.3 && Math.random() < 0.035) {
          fireAt(e);
          e.ammo--;
        }
        if (at.done) {
          if (e.state === 'diving') {
            // Off the bottom: come back in from the top to the slot.
            const slot = slotPos(e);
            e.state = 'returning';
            e.path = new Path([{ x: slot.x + 16, y: -30 }, { x: slot.x + 16, y: slot.y + 16 }]);
            e.d = 0;
          } else {
            e.state = 'formation';
          }
        }
        // Keep the path's end on the slot as the formation sways.
        if ((e.state === 'entering' || e.state === 'returning') && e.path.length - e.d < 30) {
          const slot = slotPos(e);
          const f = 1 - (e.path.length - e.d) / 30;
          e.x += (slot.x - e.x) * f;
          e.y += (slot.y - e.y) * f;
        }
        // Collide with the player.
        if (p.alive && !p.safe && overlap(box(e, 10), { x: p.x + 8, y: PLAYER_Y + 8, w: 16, h: 14 })) {
          hitEnemy(e);
          if (e.state !== 'dead') { e.state = 'dead'; addBoom(e.x + 8, e.y + 8); }
          killPlayer();
        }
      }

      // Dives: more often, and in pairs, as the stage goes on.
      const settled = alive.filter((e) => e.state === 'formation');
      const diving = alive.filter((e) => e.state === 'diving').length;
      if (p.alive && settled.length && g.entering.every((s) => s.started) && --g.diveTimer <= 0) {
        g.diveTimer = Math.max(40, 140 - g.stage * 10 + rand(-20, 20));
        const count = Math.min(settled.length, diving < 3 ? (Math.random() < 0.3 + g.stage * 0.05 ? 2 : 1) : 0);
        for (let i = 0; i < count; i++) {
          const e = pick(settled.filter((x) => x.state === 'formation'));
          if (!e) break;
          e.state = 'diving';
          e.ammo = Math.min(3, 1 + Math.floor(g.stage / 3));
          e.path = divePath(e);
          e.d = 0;
          sound.play('dive', { volume: 0.25 });
        }
      }

      // Shots.
      for (const s of g.shots) s.y -= 6;
      g.shots = g.shots.filter((s) => {
        if (s.y < -16) return false;
        for (const e of alive) {
          if (e.state === 'dead' || e.state === 'waiting') continue;
          if (overlap({ x: s.x + 6, y: s.y, w: 4, h: 12 }, box(e, 8))) { hitEnemy(e); return false; }
        }
        return true;
      });

      for (const b of g.bombs) { b.x += b.vx; b.y += b.vy; }
      g.bombs = g.bombs.filter((b) => {
        if (b.y > H) return false;
        if (p.alive && !p.safe && overlap({ x: b.x + 6, y: b.y + 5, w: 4, h: 6 }, { x: p.x + 9, y: PLAYER_Y + 8, w: 14, h: 14 })) {
          killPlayer();
          return false;
        }
        return true;
      });

      for (const d of g.drops) d.y += 1.2;
      g.drops = g.drops.filter((d) => {
        if (d.y > H) return false;
        if (p.alive && overlap({ x: d.x, y: d.y, w: 16, h: 16 }, { x: p.x + 4, y: PLAYER_Y + 4, w: 24, h: 24 })) {
          p.dual = 60 * 12;
          g.score += 500;
          sound.play('powerup');
          return false;
        }
        return true;
      });

      updateEffects();

      if (g.score >= g.extraAt) {
        g.lives++;
        g.extraAt += 50000;
        sound.play('extra');
      }

      // Stage cleared.
      if (g.enemies.every((e) => e.state === 'dead') && g.entering.every((s) => s.started)) {
        if (g.clearTimer === 0) sound.play('clear');
        if (++g.clearTimer > 90) { g.clearTimer = 0; g.bombs = []; nextStage(); }
      }
    }

    function updateEffects() {
      for (const b of g.booms) b.t++;
      g.booms = g.booms.filter((b) => b.t < (b.big ? 40 : 25));
    }

    function fireAt(e) {
      const dx = g.player.x + 16 - (e.x + 16);
      const vy = 2.4 + Math.min(1.4, g.stage * 0.12);
      g.bombs.push({ x: e.x + 8, y: e.y + 20, vx: clamp(dx / 90, -1.2, 1.2), vy });
      sound.play('enemy-shoot', { volume: 0.15 });
    }

    const box = (e, inset) => ({ x: e.x + inset, y: e.y + inset, w: 32 - inset * 2, h: 32 - inset * 2 });

    function scrollBackground(speed) {
      scroll = (scroll + speed) % 16;
      for (const isl of islands) isl.y += speed;
      islands = islands.filter((i) => i.y < H + 10);
      while (islands.length < 4) islands.push(newIsland(Math.min(...islands.map((i) => i.y), H) - rand(80, 150)));
    }

    function drawBackground(ctx) {
      for (let y = -16; y < H; y += 16) {
        for (let x = 0; x < W; x += 16) tiles.draw(ctx, TILE.water, x, y + scroll);
      }
      for (const isl of islands) {
        isl.set.forEach((t, i) => tiles.draw(ctx, t, isl.x + (i % 3) * 16, isl.y + Math.floor(i / 3) * 16));
      }
    }

    function draw(ctx, state) {
      drawBackground(ctx);
      if (!g) return;
      const p = g.player;
      for (const e of g.enemies) {
        if (e.state === 'dead' || e.state === 'waiting') continue;
        const sprite = e.kind === 'boss' && e.hp === 1 ? SHIP.bossHurt : KINDS[e.kind].sprite;
        ships.draw(ctx, sprite, e.x, e.y, { rot: e.angle - Math.PI / 2 + Math.PI, tint: e.flash ? '#ffffff' : null });
      }
      for (const d of g.drops) tiles.draw(ctx, TILE.power, d.x, d.y, { alpha: Math.floor(g.t / 8) % 2 ? 1 : 0.7 });
      for (const s of g.shots) tiles.draw(ctx, TILE.shot, s.x, s.y);
      for (const b of g.bombs) tiles.draw(ctx, TILE.enemyShot, b.x, b.y);
      if (p.alive && (p.safe === 0 || Math.floor(p.safe / 6) % 2 === 0)) {
        ships.draw(ctx, SHIP.player, p.x, PLAYER_Y);
      }
      for (const b of g.booms) {
        const frames = TILE.boom;
        const f = frames[Math.min(frames.length - 1, Math.floor(b.t / (b.big ? 8 : 5)))];
        tiles.draw(ctx, f, b.x - (b.big ? 8 : 0), b.y - (b.big ? 8 : 0), { scale: b.big ? 2 : 1 });
      }

      // Score along the top, lives and stage along the bottom, on dark bands so they read over the sea.
      ctx.fillStyle = 'rgba(6, 12, 34, 0.55)';
      ctx.fillRect(0, 0, W, 27);
      ctx.fillRect(0, H - 22, W, 22);
      rt.text('1UP', 8, 6, { color: '#ff5d5d' });
      rt.text(pad(g.score), 8, 16);
      rt.text('HI', W / 2, 6, { align: 'center', color: '#ff5d5d' });
      rt.text(pad(Math.max(rt.hi, g.score)), W / 2, 16, { align: 'center' });
      if (p.dual) rt.text('DUAL', W - 8, 6, { align: 'right', color: '#7dff8a' });
      for (let i = 0; i < Math.min(5, g.lives); i++) ships.draw(ctx, SHIP.player, 4 + i * 18, H - 20, { scale: 0.5 });
      rt.text(`STAGE ${g.stage}`, W - 6, H - 14, { align: 'right', color: '#ffd84a' });
      if (state === 'play' && g.banner > 0 && g.overTimer == null) {
        rt.text(`STAGE ${g.stage}`, W / 2, H / 2 - 8, { align: 'center', size: 16, color: '#4fc3ff' });
      }
    }

    reset();
    // The title screen shows the first formation already in place.
    for (const e of g.enemies) { e.state = 'formation'; const s = slotPos(e); e.x = s.x; e.y = s.y; }
    g.entering.forEach((s) => { s.started = true; });
    g.banner = 0;

    return {
      get score() { return g.score; },
      get over() { return g.over; },
      /** For tests: the live game state. */
      get state() { return g; },
      reset,
      update,
      attract() { scrollBackground(0.6); g.sway += 0.02; for (const e of g.enemies) if (e.state === 'formation') { const s = slotPos(e); e.x = s.x; e.y = s.y; } },
      draw
    };
  }
};
