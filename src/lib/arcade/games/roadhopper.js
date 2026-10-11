// Road Hopper: cross five lanes of traffic, then a river of drifting logs and
// sinking crates, and get five travellers home before the clock runs out.
// Art: Kenney's RPG Urban Pack, Pixel Vehicle Pack, Tiny Town, Pixel Platformer (CC0).
import { clamp, pad, overlap } from '../runtime.js';

const W = 224, H = 300;
const LANE = 20, STEP_X = 16;
const TOP = 20;                      // below the score
const HOME_Y = TOP, HOME_H = 24;
const RIVER_Y = HOME_Y + HOME_H;     // five lanes
const MEDIAN_Y = RIVER_Y + 5 * LANE;
const ROAD_Y = MEDIAN_Y + LANE;      // five lanes
const START_Y = ROAD_Y + 5 * LANE;
// Rows: 0 the start, 1–5 road, 6 the median, 7–11 river, 12 home.
const TIME = 60 * 30;

// Urban sheet (16 px): the traveller, walking in four directions.
const WALK = { up: [25, 52, 79], down: [24, 51, 78], left: [23, 50, 77], right: [26, 53, 80] };
const ASPHALT = 441, PAVEMENT = 36, PAVEMENT_EDGE = 9;
const LOG = [80, 81, 82];            // town sheet: log ends and middle
const GRASS = [0, 1, 2], DOOR = 84, HEDGE = 5;
const WATER = 73, WATER_TOP = 53, CRATE = 26; // platformer sheet (18 px)
const HOMES = [8, 52, 96, 140, 184];

const CARS = ['sedan', 'sedan_blue', 'sports_red', 'sports_yellow', 'taxi', 'police', 'van', 'suv_green', 'convertible', 'vintage', 'bus_school'];

// Each road lane: which vehicles, how fast (+ right, - left), and how spaced.
const ROAD = [
  { cars: ['sedan', 'sedan_blue', 'vintage'], speed: -0.6, gap: 74 },
  { cars: ['police', 'taxi'], speed: 0.8, gap: 90 },
  { cars: ['van', 'suv_green'], speed: -0.7, gap: 84 },
  { cars: ['sports_red', 'sports_yellow', 'convertible'], speed: 1.5, gap: 120 },
  { cars: ['bus_school'], speed: -0.55, gap: 130 }
];
// Each river lane, from the bank up: log length in tiles, or crates that dive.
const RIVER = [
  { kind: 'crates', count: 3, speed: -0.6, gap: 46 },
  { kind: 'log', len: 3, speed: 0.5, gap: 56 },
  { kind: 'log', len: 6, speed: 1.0, gap: 64 },
  { kind: 'crates', count: 2, speed: -0.7, gap: 44 },
  { kind: 'log', len: 4, speed: 0.75, gap: 58 }
];

const rowY = (r) => r === 0 ? START_Y : r <= 5 ? ROAD_Y + (5 - r) * LANE : r === 6 ? MEDIAN_Y : r <= 11 ? RIVER_Y + (11 - r) * LANE : HOME_Y + 4;

export default {
  width: W,
  height: H,
  sprites: {
    urban: 'sprites/urban.png', town: 'sprites/town.png', plat: 'sprites/platformer-tiles.png',
    ...Object.fromEntries(CARS.map((c) => [c, `sprites/cars/${c}.png`]))
  },
  sounds: ['start', 'hop', 'squash', 'splash', 'home', 'clear', 'die', 'extra', 'gameover', 'bonus'],

  create(rt) {
    const urban = rt.sheet('urban', 16);
    const town = rt.sheet('town', 16);
    const plat = rt.sheet('plat', 18);
    const { input, sound, images } = rt;

    let g;
    let waterT = 0;

    /** Evenly spaced items that loop round as one belt, so gaps never bunch up. */
    function belt(period, minSpan, offset, make) {
      const count = Math.max(2, Math.ceil(minSpan / period));
      return { items: Array.from({ length: count }, (_, k) => make(offset + k * period - period, k)), span: count * period };
    }

    function lanes(level) {
      const boost = 1 + (level - 1) * 0.18;
      const road = ROAD.map((l, i) => {
        const b = belt(l.gap, W + 90, (i * 37) % l.gap, (x, k) => {
          const img = images[l.cars[k % l.cars.length]];
          return { x, img, w: img.width };
        });
        return { ...l, speed: l.speed * boost, ...b, y: ROAD_Y + (4 - i) * LANE };
      });
      const river = RIVER.map((l, i) => {
        const size = l.kind === 'log' ? l.len * 16 : l.count * 18;
        // Some crate groups dive under now and then.
        const b = belt(size + l.gap, W + size + 40, (i * 29) % (size + l.gap), (x, k) => ({
          x, w: size, dives: l.kind === 'crates' && k % 2 === 0, phase: k * 90
        }));
        return { ...l, speed: l.speed * boost, ...b, y: RIVER_Y + (4 - i) * LANE, size };
      });
      return { road, river };
    }

    function reset() {
      g = { score: 0, lives: 3, level: 1, over: false, homes: [false, false, false, false, false], extraAt: 10000 };
      g.lanes = lanes(1);
      spawn();
    }

    function spawn() {
      g.p = { x: W / 2 - 8, row: 0, dir: 'up', hop: 0, from: null, best: 0, dead: 0, cause: null };
      g.time = TIME;
    }

    function die(cause) {
      if (g.p.dead) return;
      g.p.dead = 90;
      g.p.cause = cause;
      sound.play(cause === 'water' ? 'splash' : 'squash', { volume: 0.8 });
      sound.play('die', { volume: 0.5 });
    }

    const crateUnder = (item) => !item.dives || Math.sin((rt.frame + item.phase) / 70) > -0.55;

    function update() {
      waterT++;
      moveTraffic();
      if (g.overTimer != null) { if (--g.overTimer <= 0) g.over = true; return; }
      if (g.banner > 0) g.banner--;
      const p = g.p;

      if (p.dead) {
        if (--p.dead === 0) {
          if (g.lives === 0) { g.overTimer = 30; return; }
          g.lives--;
          spawn();
        }
        return;
      }

      // Hops: a tap moves one square; holding keeps hopping.
      if (p.hop > 0) {
        p.hop--;
      } else {
        const want = ['up', 'down', 'left', 'right'].find((d) => input.pressed(d) || input.held(d));
        if (want) {
          p.dir = want;
          p.hop = 8;
          if (want === 'up' && p.row < 12) p.row++;
          if (want === 'down' && p.row > 0) p.row--;
          if (want === 'left') p.x = Math.max(0, p.x - STEP_X);
          if (want === 'right') p.x = Math.min(W - 16, p.x + STEP_X);
          sound.play('hop', { volume: 0.35 });
          if (p.row > p.best) { g.score += 10; p.best = p.row; }
        }
      }

      if (--g.time <= 0) { die('time'); return; }

      // On the river: ride whatever is underneath, or drown.
      if (p.row >= 7 && p.row <= 11) {
        const lane = g.lanes.river[p.row - 7];
        const feet = { x: p.x + 5, y: lane.y + 4, w: 6, h: 12 };
        const ride = lane.items.find((it) => overlap(feet, { x: it.x, y: lane.y, w: it.w, h: LANE }) && crateUnder(it));
        if (p.hop <= 4) {
          if (!ride) { die('water'); return; }
          p.x += lane.speed;
          if (p.x < -8 || p.x > W - 8) { die('water'); return; }
        } else if (ride) {
          p.x += lane.speed;
        }
      }

      // The home bank: only an empty home, lined up, will do.
      if (p.row === 12 && p.hop === 0) {
        const slot = HOMES.findIndex((hx) => Math.abs(p.x - hx - 4) < 10);
        if (slot < 0 || g.homes[slot]) { die('water'); return; }
        g.homes[slot] = true;
        g.score += 50 + Math.floor(g.time / 30) * 10;
        sound.play('home');
        if (g.homes.every(Boolean)) {
          g.score += 1000;
          g.level++;
          g.homes = [false, false, false, false, false];
          g.lanes = lanes(g.level);
          g.banner = 120;
          sound.play('clear');
        }
        spawn();
        return;
      }

      // The road.
      if (p.row >= 1 && p.row <= 5) {
        const lane = g.lanes.road[p.row - 1];
        const body = { x: p.x + 4, y: lane.y + 6, w: 8, h: 8 };
        if (lane.items.some((c) => overlap(body, { x: c.x + 2, y: lane.y + 2, w: c.w - 4, h: LANE - 4 }))) die('car');
      }

      if (g.score >= g.extraAt) { g.lives++; g.extraAt = Infinity; sound.play('extra'); }
    }

    function moveTraffic() {
      for (const lane of [...g.lanes.road, ...g.lanes.river]) {
        // Everything in a lane loops round together, keeping its spacing.
        for (const it of lane.items) {
          it.x += lane.speed;
          if (lane.speed > 0 && it.x > W + 10) it.x -= lane.span;
          if (lane.speed < 0 && it.x + it.w < -10) it.x += lane.span;
        }
      }
    }

    function drawScenery(ctx) {
      // Home bank: hedge with five doors.
      for (let x = 0; x < W; x += 16) { town.draw(ctx, GRASS[(x / 16) % 3], x, HOME_Y); town.draw(ctx, GRASS[1], x, HOME_Y + 8); }
      for (let x = 0; x < W; x += 16) town.draw(ctx, HEDGE, x, HOME_Y - 2);
      HOMES.forEach((hx, i) => {
        ctx.fillStyle = '#2c1d14';
        ctx.fillRect(hx + 1, HOME_Y + 2, 22, 22);
        town.draw(ctx, DOOR, hx + 4, HOME_Y + 6);
        if (g.homes[i]) urban.draw(ctx, WALK.down[0], hx + 4, HOME_Y + 6);
      });
      // River.
      for (let y = RIVER_Y; y < MEDIAN_Y; y += 18) {
        for (let x = 0; x < W; x += 18) plat.draw(ctx, y === RIVER_Y ? WATER_TOP : WATER, x - ((waterT / 4) % 18), y);
        plat.draw(ctx, WATER, W - ((waterT / 4) % 18), y);
      }
      ctx.fillStyle = '#1e7fc2';
      ctx.fillRect(0, MEDIAN_Y - 2, W, 2);
      // Median and start: pavement. Road: asphalt with lane lines.
      for (let x = 0; x < W; x += 16) {
        urban.draw(ctx, PAVEMENT_EDGE, x, MEDIAN_Y); urban.draw(ctx, PAVEMENT, x, MEDIAN_Y + 4);
        urban.draw(ctx, PAVEMENT_EDGE, x, START_Y); urban.draw(ctx, PAVEMENT, x, START_Y + 4);
        for (let y = ROAD_Y; y < START_Y; y += 16) urban.draw(ctx, ASPHALT, x, y);
      }
      ctx.fillStyle = '#d9dcef';
      for (let i = 1; i < 5; i++) for (let x = 4; x < W; x += 24) ctx.fillRect(x, ROAD_Y + i * LANE - 1, 12, 2);
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(0, ROAD_Y, W, 1);
      ctx.fillRect(0, START_Y - 1, W, 1);
    }

    function draw(ctx, state) {
      if (!g) return;
      drawScenery(ctx);
      // Logs and crates.
      for (const lane of g.lanes.river) {
        for (const it of lane.items) {
          if (lane.kind === 'log') {
            for (let t = 0; t < lane.len; t++) town.draw(ctx, t === 0 ? LOG[0] : t === lane.len - 1 ? LOG[2] : LOG[1], it.x + t * 16, lane.y + 2);
          } else {
            const up = Math.sin((rt.frame + it.phase) / 70);
            const alpha = !it.dives ? 1 : up > -0.3 ? 1 : up > -0.55 ? 0.55 : 0.15;
            for (let t = 0; t < lane.count; t++) plat.draw(ctx, CRATE, it.x + t * 18, lane.y + 1, { alpha });
          }
        }
      }
      // Traffic.
      for (const lane of g.lanes.road) {
        for (const c of lane.items) {
          const y = lane.y + LANE - c.img.height - 1;
          ctx.save();
          if (lane.speed < 0) { ctx.translate(Math.round(c.x) + c.w, y); ctx.scale(-1, 1); ctx.drawImage(c.img, 0, 0); }
          else ctx.drawImage(c.img, Math.round(c.x), y);
          ctx.restore();
        }
      }
      // The traveller.
      const p = g.p;
      const y = rowY(p.row) + (p.row === 12 ? 0 : 2);
      if (p.dead) {
        if (p.cause === 'water') {
          const r = (90 - p.dead) / 6;
          ctx.strokeStyle = 'rgba(230, 245, 255, 0.85)';
          ctx.beginPath(); ctx.arc(p.x + 8, y + 9, r, 0, Math.PI * 2); ctx.stroke();
        } else if (Math.floor(p.dead / 6) % 2) {
          urban.draw(ctx, WALK[p.dir][0], p.x, y, { tint: '#ff6b5e' });
        }
      } else {
        const lift = p.hop > 0 ? -Math.sin((p.hop / 8) * Math.PI) * 3 : 0;
        const frames = WALK[p.dir];
        urban.draw(ctx, p.hop > 0 ? frames[1 + (p.hop > 4 ? 0 : 1)] : frames[0], p.x, y + lift);
      }

      // HUD: score on top, lives and time below.
      ctx.fillStyle = '#0a0d24';
      ctx.fillRect(0, 0, W, TOP - 2);
      ctx.fillRect(0, H - 16, W, 16);
      rt.text('SCORE', 4, 5, { color: '#ffb84a' });
      rt.text(pad(g.score, 5), 48, 5);
      rt.text('HI', 128, 5, { color: '#ffb84a' });
      rt.text(pad(Math.max(rt.hi, g.score), 5), 148, 5);
      for (let i = 0; i < Math.min(5, g.lives); i++) urban.draw(ctx, WALK.down[0], 2 + i * 12, H - 16, { scale: 0.75 });
      const frac = clamp(g.time / TIME, 0, 1);
      ctx.fillStyle = frac < 0.25 ? '#ff6b5e' : '#7dff8a';
      ctx.fillRect(W - 6 - Math.round(90 * frac), H - 11, Math.round(90 * frac), 6);
      rt.text('TIME', W - 100, H - 12, { align: 'right', color: '#ffd84a' });
      if (state === 'play' && g.banner > 0) rt.text(`LEVEL ${g.level}`, W / 2, MEDIAN_Y + 2, { align: 'center', size: 16, color: '#ffb84a' });
    }

    reset();

    return {
      get score() { return g.score; },
      get over() { return g.over; },
      /** For tests: the live game state. */
      get state() { return g; },
      reset,
      update,
      attract() { waterT++; moveTraffic(); },
      draw
    };
  }
};
