// Barrel Climb: a robot at the top rolls barrels down sloping girders. Climb the
// ladders, jump the barrels, grab a hammer, and reach your friend at the top.
// Art: Kenney's Pixel Platformer and Tiny Dungeon (CC0).
import { clamp, pad, overlap } from '../runtime.js';

const W = 252, H = 330;
// Girders from the bottom up: x span and the height at each end. Barrels roll downhill.
const GIRDERS = [
  { x0: 0, x1: 252, y0: 314, y1: 306 },
  { x0: 0, x1: 226, y0: 258, y1: 272 },
  { x0: 26, x1: 252, y0: 226, y1: 212 },
  { x0: 0, x1: 226, y0: 166, y1: 180 },
  { x0: 26, x1: 252, y0: 134, y1: 120 },
  { x0: 0, x1: 226, y0: 76, y1: 90 },
  { x0: 96, x1: 168, y0: 40, y1: 40, top: true }
];
// Ladders: x and the girder index they rise from. Broken ones stop halfway.
const LADDERS = [
  { x: 196, from: 0 }, { x: 40, from: 0, broken: true },
  { x: 60, from: 1 }, { x: 150, from: 1, broken: true },
  { x: 196, from: 2 }, { x: 110, from: 2 },
  { x: 40, from: 3 }, { x: 160, from: 3, broken: true },
  { x: 204, from: 4 }, { x: 90, from: 4, broken: true },
  { x: 150, from: 5 }
];
const HAMMERS = [{ x: 30, g: 1 }, { x: 214, g: 3 }];

// Sheets: platformer tiles (18), platformer characters (24), dungeon (16).
const GIRDER = 13, LADDER = 71, HEART = 44;
const HERO = [9, 10], FRIEND = [4, 5], ROBOT = [21, 22, 23];
const BARREL = 82, HAMMER = 117;

const gy = (g, x) => g.y0 + ((g.y1 - g.y0) * (clamp(x, g.x0, g.x1) - g.x0)) / (g.x1 - g.x0);
const downhill = (g) => Math.sign(g.y1 - g.y0) || -1;
const ladderSpan = (l) => {
  const lo = GIRDERS[l.from], hi = GIRDERS[l.from + 1];
  return { bottom: gy(lo, l.x + 8), top: gy(hi, l.x + 8) };
};

export default {
  width: W,
  height: H,
  sprites: { tiles: 'sprites/platformer-tiles.png', chars: 'sprites/platformer-chars.png', dungeon: 'sprites/dungeon.png', bg: 'sprites/platformer-bg.png' },
  sounds: ['start', 'jump', 'roll', 'hammer', 'bonus', 'die', 'clear', 'extra', 'gameover'],

  create(rt) {
    const tiles = rt.sheet('tiles', 18);
    const chars = rt.sheet('chars', 24);
    const dungeon = rt.sheet('dungeon', 16);
    const bg = rt.sheet('bg', 24);
    const { input, sound } = rt;
    let g;

    function reset() {
      g = { score: 0, lives: 2, level: 0, over: false, extraAt: 7000 };
      nextLevel();
    }

    function nextLevel() {
      g.level++;
      startRound();
    }

    function startRound() {
      g.p = { x: 24, y: gy(GIRDERS[0], 32) - 22, vx: 0, vy: 0, state: 'stand', face: 1, walk: 0, on: 0, ladder: null, fallFrom: 0, hammer: 0 };
      g.barrels = [];
      g.throwIn = 90;
      g.throwing = 0;
      g.bonus = Math.min(8000, 4000 + g.level * 1000);
      g.bonusTick = 0;
      g.hammers = HAMMERS.map((h) => ({ ...h, taken: false }));
      g.dying = 0;
      g.won = 0;
      g.popups = [];
    }

    /** The girder whose surface is at or just below `feet` at x, if any. */
    function girderAt(x, feet, slack = 3) {
      let best = null, bestD = Infinity;
      GIRDERS.forEach((gd, i) => {
        if (x < gd.x0 - 2 || x > gd.x1 + 2) return;
        const d = gy(gd, x) - feet;
        if (d >= -slack && d < bestD) { bestD = d; best = i; }
      });
      return best;
    }

    function ladderNear(x, feet, dir) {
      return LADDERS.find((l) => {
        if (Math.abs(x - (l.x + 8)) > 6) return false;
        const s = ladderSpan(l);
        const reach = l.broken ? s.bottom - (s.bottom - s.top) * 0.45 : s.top;
        return dir === 'up' ? Math.abs(feet - s.bottom) < 4 : !l.broken && Math.abs(feet - s.top) < 4 && reach === s.top;
      });
    }

    function die() {
      if (g.dying) return;
      g.dying = 120;
      sound.play('die', { volume: 0.8 });
    }

    function updatePlayer() {
      const p = g.p;
      const cx = p.x + 12;
      const feet = p.y + 22;
      if (p.hammer > 0) p.hammer--;

      if (p.state === 'climb') {
        const s = ladderSpan(p.ladder);
        const stop = p.ladder.broken ? s.bottom - (s.bottom - s.top) * 0.45 : s.top;
        if (input.held('up')) p.y -= 0.9;
        if (input.held('down')) p.y += 0.9;
        p.walk += input.held('up') || input.held('down') ? 1 : 0;
        if (p.y + 22 <= stop) {
          p.y = stop - 22;
          if (!p.ladder.broken) { p.state = 'stand'; p.on = p.ladder.from + 1; }
        }
        if (p.y + 22 >= s.bottom) { p.y = s.bottom - 22; p.state = 'stand'; p.on = p.ladder.from; }
        return;
      }

      if (p.state === 'stand') {
        if (input.held('up') && !p.hammer) {
          const l = ladderNear(cx, feet, 'up');
          if (l) { p.state = 'climb'; p.ladder = l; p.x = l.x - 4; return; }
        }
        if (input.held('down') && !p.hammer) {
          const l = ladderNear(cx, feet, 'down');
          if (l) { p.state = 'climb'; p.ladder = l; p.x = l.x - 4; p.y += 2; return; }
        }
        let vx = 0;
        if (input.held('left')) vx = -1.05;
        if (input.held('right')) vx = 1.05;
        if (vx) { p.face = Math.sign(vx); p.walk++; }
        if (input.pressed('a') && !p.hammer) {
          p.state = 'jump';
          p.vx = vx;
          p.vy = -2.6;
          p.jumpFrom = p.y;
          p.cleared = new Set();
          sound.play('jump', { volume: 0.4 });
          return;
        }
        p.x = clamp(p.x + vx, -6, W - 18);
        const gd = GIRDERS[p.on];
        if (cx < gd.x0 - 4 || cx > gd.x1 + 4) {
          p.state = 'fall'; p.vy = 0; p.vx = vx; p.fallFrom = p.y;
        } else {
          p.y = gy(gd, p.x + 12) - 22;
        }
        return;
      }

      // In the air: jumping or falling off an edge.
      p.vy += 0.13;
      p.x = clamp(p.x + p.vx, -6, W - 18);
      p.y += p.vy;
      if (p.vy > 0) {
        const i = girderAt(p.x + 12, p.y + 22 - p.vy, 0);
        if (i != null && p.y + 22 >= gy(GIRDERS[i], p.x + 12)) {
          const drop = p.y - (p.state === 'jump' ? p.jumpFrom : p.fallFrom);
          p.y = gy(GIRDERS[i], p.x + 12) - 22;
          p.on = i;
          p.state = 'stand';
          if (drop > 30) die();
        }
      }
      // Points for every barrel that passes under a jump.
      if (p.state === 'jump') {
        for (const b of g.barrels) {
          if (p.cleared.has(b) || b.state !== 'roll') continue;
          if (Math.abs(b.x + 8 - (p.x + 12)) < 8 && b.y > p.y + 16 && b.y - p.y < 44) {
            p.cleared.add(b);
            g.score += 100;
            g.popups.push({ x: p.x + 12, y: p.y, value: 100, t: 50 });
            sound.play('bonus', { volume: 0.5 });
          }
        }
      }
      if (p.y > H) die();
    }

    function updateBarrels() {
      const speed = 1.15 + Math.min(0.9, g.level * 0.12);
      for (const b of g.barrels) {
        b.spin += b.state === 'roll' ? b.dir * 0.18 : 0;
        if (b.state === 'roll') {
          const gd = GIRDERS[b.on];
          b.x += b.dir * speed;
          if (b.x + 8 < gd.x0 || b.x + 8 > gd.x1) {
            b.state = 'fall'; b.vy = 0.5;
            if (b.on === 0) b.gone = true;
          } else {
            b.y = gy(gd, b.x + 8) - 16;
            // Sometimes take a ladder down, more often when you are below.
            const l = LADDERS.find((ld) => ld.from + 1 === b.on && Math.abs(ld.x + 8 - (b.x + 8)) < speed / 2 + 0.01);
            if (l && b.on > 0 && Math.random() < (g.p.on < b.on ? 0.45 : 0.15)) { b.state = 'ladder'; b.x = l.x; b.ladder = l; }
          }
        } else if (b.state === 'ladder') {
          b.y += 1.1;
          const s = ladderSpan(b.ladder);
          if (b.y + 16 >= s.bottom) {
            b.on = b.ladder.from;
            b.y = s.bottom - 16;
            b.state = 'roll';
            b.dir = downhill(GIRDERS[b.on]);
          }
        } else if (b.state === 'fall') {
          b.vy += 0.18;
          b.y += b.vy;
          const below = GIRDERS.findIndex((gd, i) => i < b.on && b.x + 8 >= gd.x0 && b.x + 8 <= gd.x1 && b.y + 16 >= gy(gd, b.x + 8) && b.y + 16 - b.vy <= gy(gd, b.x + 8) + 2);
          if (below >= 0) {
            b.on = below;
            b.state = 'roll';
            b.dir = downhill(GIRDERS[below]);
            b.y = gy(GIRDERS[below], b.x + 8) - 16;
            sound.play('roll', { volume: 0.3 });
          }
          if (b.y > H) b.gone = true;
        }
        if (b.x < -20 || b.x > W + 20) b.gone = true;

        // Hitting you, or your hammer.
        const p = g.p;
        const body = { x: p.x + 6, y: p.y + 4, w: 12, h: 18 };
        const box = { x: b.x + 2, y: b.y + 2, w: 12, h: 12 };
        if (p.hammer && overlap({ x: p.x - 6 + (p.face > 0 ? 14 : 0), y: p.y - 10, w: 22, h: 30 }, box)) {
          b.gone = true;
          g.score += 300;
          g.popups.push({ x: b.x + 8, y: b.y, value: 300, t: 50 });
          sound.play('hammer', { volume: 0.7 });
        } else if (!g.dying && overlap(body, box)) {
          die();
        }
      }
      g.barrels = g.barrels.filter((b) => !b.gone);
    }

    function update() {
      if (g.overTimer != null) { if (--g.overTimer <= 0) g.over = true; return; }
      for (const pu of g.popups) pu.t--;
      g.popups = g.popups.filter((pu) => pu.t > 0);
      if (g.dying) {
        if (--g.dying === 0) {
          if (g.lives === 0) { g.overTimer = 30; return; }
          g.lives--;
          startRound();
        }
        return;
      }
      if (g.won) {
        if (--g.won === 0) nextLevel();
        return;
      }
      updatePlayer();
      if (g.dying) return;

      // The robot throws.
      if (g.throwing > 0) {
        if (--g.throwing === 20) {
          g.barrels.push({ x: 40, y: gy(GIRDERS[5], 48) - 16, on: 5, dir: 1, state: 'roll', spin: 0 });
          sound.play('roll', { volume: 0.4 });
        }
      } else if (--g.throwIn <= 0) {
        g.throwing = 40;
        g.throwIn = Math.max(70, 170 - g.level * 15) + Math.random() * 60;
      }
      updateBarrels();

      // Hammers.
      for (const h of g.hammers) {
        if (h.taken) continue;
        const hy = gy(GIRDERS[h.g], h.x + 8) - 34;
        if (overlap({ x: g.p.x + 4, y: g.p.y, w: 16, h: 22 }, { x: h.x, y: hy, w: 16, h: 16 })) {
          h.taken = true;
          g.p.hammer = 60 * 9;
          sound.play('bonus');
        }
      }

      // The bonus runs down; at zero you are out of time.
      if (++g.bonusTick >= 120) {
        g.bonusTick = 0;
        g.bonus = Math.max(0, g.bonus - 100);
        if (g.bonus === 0) die();
      }
      if (g.p.on === 6 && g.p.state === 'stand') {
        g.score += g.bonus;
        g.won = 150;
        g.barrels = [];
        sound.play('clear');
      }
      if (g.score >= g.extraAt) { g.lives++; g.extraAt = Infinity; sound.play('extra'); }
    }

    function drawGirder(ctx, gd) {
      for (let x = gd.x0; x < gd.x1; x += 18) {
        const w = Math.min(18, gd.x1 - x);
        const y = Math.round(gy(gd, x + w / 2));
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y - 1, w, 20); ctx.clip();
        tiles.draw(ctx, GIRDER, x, y);
        ctx.restore();
      }
    }

    function draw(ctx, state) {
      // A sunset building site.
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#1b1440');
      sky.addColorStop(0.7, '#6b2f5a');
      sky.addColorStop(1, '#e0794a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.globalAlpha = 0.35;
      for (let x = 0; x < W; x += 24) { bg.draw(ctx, x % 48 ? 12 : 13, x, H - 72); bg.draw(ctx, 20, x, H - 48); bg.draw(ctx, 20, x, H - 24); }
      ctx.restore();
      if (!g) return;

      for (const l of LADDERS) {
        const s = ladderSpan(l);
        const end = l.broken ? s.bottom - (s.bottom - s.top) * 0.45 : s.top;
        for (let y = s.bottom - 18; y > end - 18; y -= 18) {
          ctx.save();
          ctx.beginPath(); ctx.rect(l.x, Math.max(y, end - 2), 18, 18); ctx.clip();
          tiles.draw(ctx, LADDER, l.x, y);
          ctx.restore();
        }
        if (l.broken) { ctx.save(); ctx.beginPath(); ctx.rect(l.x, s.top, 18, 6); ctx.clip(); tiles.draw(ctx, LADDER, l.x, s.top); ctx.restore(); }
      }
      GIRDERS.forEach((gd) => drawGirder(ctx, gd));

      for (const h of g.hammers) if (!h.taken) dungeon.draw(ctx, HAMMER, h.x, gy(GIRDERS[h.g], h.x + 8) - 34 + Math.sin(rt.frame / 10) * 2);

      // The friend waiting at the top, and the robot.
      const top = GIRDERS[6];
      chars.draw(ctx, FRIEND[Math.floor(rt.frame / 30) % 2], 126, top.y0 - 24);
      if (g.won) tiles.draw(ctx, HEART, 112, top.y0 - 44 - Math.sin(rt.frame / 8) * 3);
      const robotFrame = g.throwing > 0 ? ROBOT[Math.min(2, Math.floor((40 - g.throwing) / 14))] : ROBOT[0];
      chars.draw(ctx, robotFrame, 4, gy(GIRDERS[5], 20) - 36, { scale: 1.5 });
      // Stacked barrels beside the robot.
      dungeon.draw(ctx, BARREL, 0, gy(GIRDERS[5], 4) - 52); dungeon.draw(ctx, BARREL, 14, gy(GIRDERS[5], 18) - 52);

      for (const b of g.barrels) dungeon.draw(ctx, BARREL, b.x, b.y, { rot: b.spin });

      const p = g.p;
      if (g.dying) {
        const t = 1 - g.dying / 120;
        chars.draw(ctx, HERO[0], p.x, p.y, { rot: Math.min(1, t * 3) * Math.PI / 2, tint: Math.floor(g.dying / 8) % 2 ? '#ff6b5e' : null });
      } else {
        const frame = p.state === 'climb' ? HERO[Math.floor(p.walk / 10) % 2] : HERO[Math.floor(p.walk / 8) % 2];
        chars.draw(ctx, frame, p.x, p.y, { flipX: p.face < 0 && p.state !== 'climb' });
        if (p.hammer) {
          const up = Math.floor(rt.frame / 8) % 2;
          dungeon.draw(ctx, HAMMER, p.x + (p.face > 0 ? 14 : -6), p.y - (up ? 12 : 0), { rot: up ? 0 : (p.face > 0 ? 1.2 : -1.2), alpha: p.hammer < 90 && Math.floor(p.hammer / 6) % 2 ? 0.4 : 1 });
        }
      }
      for (const pu of g.popups) rt.text(String(pu.value), pu.x, pu.y - (50 - pu.t) / 3, { align: 'center', color: '#ffd84a' });

      ctx.fillStyle = 'rgba(8, 6, 24, 0.7)';
      ctx.fillRect(0, 0, W, 20);
      rt.text(pad(g.score), 4, 6);
      rt.text(`HI ${pad(Math.max(rt.hi, g.score))}`, 124, 6, { align: 'center', color: '#ffd84a' });
      rt.text(`BONUS ${g.bonus}`, W - 4, 6, { align: 'right', color: g.bonus <= 1000 ? '#ff6b5e' : '#7fe9ff' });
      for (let i = 0; i < Math.min(4, g.lives); i++) chars.draw(ctx, HERO[0], 180 + i * 14, 24, { scale: 0.6 });
      rt.text(`LV${g.level}`, W - 4, 26, { align: 'right', color: '#ff7a5c' });
      if (g.won) rt.text('YOU MADE IT!', W / 2, H / 2 - 30, { align: 'center', size: 16, color: '#7dff8a' });
      if (state === 'play' && g.level > 0 && g.bonus === Math.min(8000, 4000 + g.level * 1000) && g.bonusTick < 100 && !g.won) {
        rt.text(`LEVEL ${g.level}`, W / 2, H / 2, { align: 'center', size: 16, color: '#ff7a5c' });
      }
    }

    reset();

    return {
      get score() { return g.score; },
      get over() { return g.over; },
      /** For tests: the live game state. */
      get state() { return g; },
      reset,
      update,
      attract() { if (rt.frame % 90 === 0) g.throwing = 40; if (g.throwing > 0) g.throwing--; },
      draw
    };
  }
};
