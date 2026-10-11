// Invaders from Above: rows of creatures march side to side and down, one at a
// time, so the fewer are left the faster they go. Bunkers crumble pixel by pixel.
// Art: Kenney's Pixel Platformer and Pixel Shmup (CC0).
import { pad, rand, randInt, overlap } from '../runtime.js';

const W = 240, H = 300;
const GROUND = H - 26;
const PLAYER_Y = GROUND - 22;
const COLS = 11, ROWS = 5, GAP_X = 19, GAP_Y = 18;

// Character sheet (24 px): two or three frames per creature.
const ROW_KIND = [
  { frames: [24, 25, 26], score: 30 },   // winged
  { frames: [15, 16], score: 20 },       // spiked
  { frames: [15, 16], score: 20 },
  { frames: [18, 19], score: 10 },       // little robots
  { frames: [18, 19], score: 10 }
];
const PLAYER = 9, SAUCER = 8;
const BOOM = [4, 5, 6, 7, 8]; // shmup tiles
const NOTES = [1, 0.89, 0.79, 0.75];

export default {
  width: W,
  height: H,
  sprites: { chars: 'sprites/platformer-chars.png', tiles: 'sprites/platformer-tiles.png', bg: 'sprites/platformer-bg.png', fx: 'sprites/shmup-tiles.png' },
  sounds: ['start', 'shoot', 'explode', 'explode-big', 'march', 'ufo', 'bonus', 'die', 'extra', 'clear', 'gameover'],

  create(rt) {
    const chars = rt.sheet('chars', 24);
    const tiles = rt.sheet('tiles', 18);
    const bg = rt.sheet('bg', 24);
    const fx = rt.sheet('fx', 16);
    const { input, sound } = rt;
    const stars = Array.from({ length: 50 }, () => ({ x: rand(0, W), y: rand(0, GROUND - 40), t: rand(0, 6) }));

    let g;

    function makeBunker(x) {
      const c = document.createElement('canvas');
      c.width = 36; c.height = 26;
      const b = c.getContext('2d', { willReadFrequently: true });
      b.imageSmoothingEnabled = false;
      // Grassy blocks, with an arch cut out underneath like the old ones.
      tiles.draw(b, 1, 0, 0); tiles.draw(b, 3, 18, 0);
      tiles.draw(b, 21, 0, 18); tiles.draw(b, 23, 18, 18);
      b.globalCompositeOperation = 'destination-out';
      b.beginPath(); b.ellipse(18, 26, 8, 8, 0, 0, Math.PI * 2); b.fill();
      b.fillRect(0, 0, 2, 2); b.fillRect(34, 0, 2, 2);
      b.globalCompositeOperation = 'source-over';
      return { x, y: PLAYER_Y - 44, c, b, data: b.getImageData(0, 0, 36, 26) };
    }

    /** Is there bunker at this screen point? If so, blow a ragged hole in it. */
    function bunkerHit(px, py, radius = 3) {
      for (const k of g.bunkers) {
        const lx = Math.floor(px - k.x), ly = Math.floor(py - k.y);
        if (lx < 0 || ly < 0 || lx >= 36 || ly >= 26) continue;
        if (k.data.data[(ly * 36 + lx) * 4 + 3] < 40) continue;
        for (let i = 0; i < 18; i++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
          k.b.clearRect(Math.round(lx + Math.cos(a) * r) - 1, Math.round(ly + Math.sin(a) * r) - 1, 2, 2);
        }
        k.data = k.b.getImageData(0, 0, 36, 26);
        return true;
      }
      return false;
    }

    function newWave() {
      g.wave++;
      const drop = Math.min(5, g.wave - 1) * 8;
      g.invaders = [];
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          g.invaders.push({ row, col, x: 14 + col * GAP_X, y: 40 + drop + row * GAP_Y, alive: true });
        }
      }
      g.dx = 2;
      g.cursor = 0;
      g.dropNext = false;
      g.frame = 0;
      g.bombs = [];
      g.banner = 100;
    }

    function reset() {
      g = {
        score: 0, lives: 2, wave: 0, over: false, extraAt: 1500,
        player: { x: W / 2 - 12, alive: true, timer: 0 },
        shot: null, bombs: [], booms: [], saucer: null, saucerIn: 1200,
        bunkers: [24, 80, 136, 192].map(makeBunker), note: 0, banner: 0
      };
      newWave();
    }

    const living = () => g.invaders.filter((i) => i.alive);

    function marchOne() {
      const alive = living();
      if (!alive.length) return;
      // One creature moves each frame, bottom row first, like the original's ripple.
      if (g.cursor >= alive.length) {
        g.cursor = 0;
        g.frame++;
        sound.play('march', { volume: 0.35, rate: NOTES[g.note++ % 4] * 0.6 });
        if (g.dropNext) { g.dropNext = false; g.dx = -g.dx; g.dropping = true; } else g.dropping = false;
      }
      const order = [...alive].sort((a, b) => b.row - a.row || a.col - b.col);
      const inv = order[g.cursor++];
      if (g.dropping) inv.y += 8;
      else inv.x += g.dx;
      if ((inv.x > W - 22 && g.dx > 0) || (inv.x < 2 && g.dx < 0)) g.dropNext = true;
      // Creatures that reach the bunkers chew through them.
      for (let i = 0; i < 4; i++) bunkerHit(inv.x + 4 + i * 4, inv.y + 16, 4);
    }

    function boom(x, y, big) { g.booms.push({ x, y, t: 0, big }); }

    function killPlayer() {
      const p = g.player;
      if (!p.alive) return;
      p.alive = false;
      p.timer = 120;
      boom(p.x + 4, PLAYER_Y + 4, true);
      sound.play('explode-big');
      sound.play('die', { volume: 0.6 });
      if (g.lives === 0) g.overTimer = 90;
      else g.lives--;
    }

    function update() {
      for (const s of stars) s.t += 0.05;
      for (const b of g.booms) b.t++;
      g.booms = g.booms.filter((b) => b.t < 30);
      if (g.overTimer != null) { if (--g.overTimer <= 0) g.over = true; return; }
      if (g.banner > 0) g.banner--;
      const p = g.player;

      if (p.alive) {
        if (input.held('left')) p.x = Math.max(4, p.x - 1.6);
        if (input.held('right')) p.x = Math.min(W - 28, p.x + 1.6);
        if (input.pressed('a') && !g.shot) {
          g.shot = { x: p.x + 11, y: PLAYER_Y - 2 };
          sound.play('shoot', { volume: 0.3, rate: 1.2 });
        }
      } else if (--p.timer <= 0) {
        p.alive = true;
        p.x = W / 2 - 12;
        g.bombs = [];
      }

      // The march pauses while you are exploding, as it did then.
      if (p.alive) marchOne();

      // Your shot.
      if (g.shot) {
        g.shot.y -= 5;
        const s = { x: g.shot.x, y: g.shot.y, w: 2, h: 7 };
        let hit = false;
        for (const inv of living()) {
          if (overlap(s, { x: inv.x + 4, y: inv.y + 4, w: 16, h: 15 })) {
            inv.alive = false;
            g.score += ROW_KIND[inv.row].score;
            boom(inv.x + 4, inv.y + 4);
            sound.play('explode', { volume: 0.45 });
            hit = true;
            break;
          }
        }
        if (!hit && g.saucer && overlap(s, { x: g.saucer.x + 2, y: g.saucer.y + 2, w: 20, h: 20 })) {
          const value = [50, 100, 150, 300][randInt(0, 3)];
          g.score += value;
          g.popup = { x: g.saucer.x, y: g.saucer.y, value, t: 90 };
          boom(g.saucer.x + 4, g.saucer.y + 4, true);
          sound.stop('ufo');
          sound.play('bonus');
          g.saucer = null;
          hit = true;
        }
        if (!hit) hit = bunkerHit(s.x + 1, s.y);
        if (!hit) {
          for (const b of g.bombs) {
            if (overlap(s, { x: b.x - 1, y: b.y, w: 4, h: 8 })) { b.dead = true; hit = true; boom(b.x - 6, b.y - 4); }
          }
        }
        if (hit || g.shot.y < 24) g.shot = null;
      }

      // Their bombs: from the lowest creature in a column, more of them later on.
      const alive = living();
      const maxBombs = Math.min(5, 2 + Math.floor(g.wave / 2));
      if (p.alive && alive.length && g.bombs.length < maxBombs && Math.random() < 0.035 + g.wave * 0.004) {
        const cols = [...new Set(alive.map((i) => i.col))];
        // Often from the column right above you.
        const near = alive.filter((i) => Math.abs(i.x + 12 - (p.x + 12)) < 16).map((i) => i.col);
        const col = near.length && Math.random() < 0.4 ? near[0] : cols[randInt(0, cols.length - 1)];
        const shooter = alive.filter((i) => i.col === col).sort((a, b) => b.y - a.y)[0];
        g.bombs.push({ x: shooter.x + 12, y: shooter.y + 18, speed: Math.random() < 0.3 ? 2.6 : 1.7, t: 0 });
      }
      for (const b of g.bombs) {
        b.y += b.speed;
        b.t++;
        if (b.y > GROUND - 4) { b.dead = true; boom(b.x - 6, GROUND - 12); }
        else if (bunkerHit(b.x, b.y + 7, 3)) b.dead = true;
        else if (p.alive && overlap({ x: b.x - 1, y: b.y, w: 3, h: 8 }, { x: p.x + 5, y: PLAYER_Y + 6, w: 14, h: 16 })) { b.dead = true; killPlayer(); }
      }
      g.bombs = g.bombs.filter((b) => !b.dead);

      // The saucer.
      if (g.saucer) {
        g.saucer.x += g.saucer.dx;
        if (g.saucer.x < -30 || g.saucer.x > W + 10) { g.saucer = null; sound.stop('ufo'); }
      } else if (p.alive && --g.saucerIn <= 0 && alive.length > 8) {
        g.saucerIn = randInt(1100, 1700);
        const fromLeft = Math.random() < 0.5;
        g.saucer = { x: fromLeft ? -24 : W, y: 22, dx: fromLeft ? 0.8 : -0.8 };
        sound.loop('ufo', { volume: 0.18 });
      }
      if (g.popup && --g.popup.t <= 0) g.popup = null;

      if (g.score >= g.extraAt) { g.lives++; g.extraAt = Infinity; sound.play('extra'); }

      // Landed: it is over, however many lives are left.
      if (alive.some((i) => i.y + 20 >= PLAYER_Y)) { g.lives = 0; killPlayer(); }
      if (!alive.length) {
        if (!g.clearing) { g.clearing = 80; sound.play('clear'); sound.stop('ufo'); g.saucer = null; }
        if (--g.clearing <= 0) { g.clearing = 0; newWave(); }
      }
    }

    function drawBackground(ctx) {
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, '#060818');
      sky.addColorStop(1, '#1b1d4a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      for (const s of stars) {
        ctx.fillStyle = `rgba(255,255,255,${0.35 + Math.sin(s.t) * 0.3})`;
        ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      }
      // Hills on the horizon, in the night.
      ctx.save();
      ctx.globalAlpha = 0.55;
      for (let x = 0; x < W; x += 24) bg.draw(ctx, x % 48 ? 14 : 15, x, GROUND - 48);
      for (let x = 0; x < W; x += 24) bg.draw(ctx, 22, x, GROUND - 24);
      ctx.restore();
      ctx.fillStyle = 'rgba(6, 8, 24, 0.45)';
      ctx.fillRect(0, GROUND - 48, W, 48);
      for (let x = 0; x < W; x += 18) tiles.draw(ctx, 2, x, GROUND);
      ctx.fillStyle = '#5a3a26';
      ctx.fillRect(0, GROUND + 18, W, H - GROUND - 18);
    }

    function draw(ctx, state) {
      drawBackground(ctx);
      if (!g) return;
      for (const k of g.bunkers) ctx.drawImage(k.c, k.x, k.y);
      for (const inv of g.invaders) {
        if (!inv.alive) continue;
        const kind = ROW_KIND[inv.row];
        chars.draw(ctx, kind.frames[g.frame % kind.frames.length], inv.x, inv.y, { scale: 0.85 });
      }
      if (g.saucer) chars.draw(ctx, SAUCER, g.saucer.x, g.saucer.y, { rot: (rt.frame / 10) % (Math.PI * 2) });
      if (g.popup) rt.text(String(g.popup.value), g.popup.x + 12, g.popup.y + 6, { align: 'center', color: '#ff6b5e' });
      const p = g.player;
      if (p.alive) chars.draw(ctx, PLAYER, p.x, PLAYER_Y);
      if (g.shot) { ctx.fillStyle = '#fff6a0'; ctx.fillRect(g.shot.x, g.shot.y, 2, 7); }
      for (const b of g.bombs) {
        ctx.fillStyle = b.speed > 2 ? '#ff6b5e' : '#e8f4ff';
        const zig = Math.floor(b.t / 4) % 2;
        for (let i = 0; i < 4; i++) ctx.fillRect(b.x - 1 + ((i + zig) % 2 ? 1 : -1), b.y + i * 2, 2, 2);
      }
      for (const b of g.booms) {
        const f = BOOM[Math.min(BOOM.length - 1, Math.floor(b.t / 6))];
        fx.draw(ctx, f, b.x - (b.big ? 4 : 0), b.y - (b.big ? 4 : 0), { scale: b.big ? 1.5 : 1 });
      }

      rt.text('SCORE', 8, 4, { color: '#7dff8a' });
      rt.text(pad(g.score, 5), 56, 4);
      rt.text('HI', 150, 4, { color: '#7dff8a' });
      rt.text(pad(Math.max(rt.hi, g.score), 5), 172, 4);
      for (let i = 0; i < Math.min(5, g.lives); i++) chars.draw(ctx, PLAYER, 6 + i * 16, H - 20, { scale: 0.6 });
      rt.text(`WAVE ${g.wave}`, W - 6, H - 14, { align: 'right', color: '#ffd84a' });
      if (state === 'play' && g.banner > 0) rt.text(`WAVE ${g.wave}`, W / 2, H / 2 + 20, { align: 'center', size: 16, color: '#7dff8a' });
    }

    reset();
    g.banner = 0;

    return {
      get score() { return g.score; },
      get over() { return g.over; },
      /** For tests: the live game state. */
      get state() { return g; },
      reset,
      update,
      attract() { for (const s of stars) s.t += 0.05; if (rt.frame % 30 === 0) g.frame++; },
      draw
    };
  }
};
