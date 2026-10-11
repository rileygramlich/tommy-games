// The arcade cabinet every game runs in: a fixed 60 Hz loop, sprite sheets,
// sound, keyboard and touch input, the title / pause / game-over screens and
// the high score. A game only has to say how big its screen is, what it loads,
// and how to update and draw itself.

export const STEP = 1 / 60;
const FONT = 'Press Start 2P';

export const asset = (path) => `${import.meta.env.BASE_URL}arcade/${path}`;

// ---------------------------------------------------------------- loading

let fontReady = null;
/** The arcade font, loaded once for every game. */
export function loadFont() {
  fontReady ??= new FontFace(FONT, `url(${asset('fonts/PressStart2P-Regular.ttf')})`)
    .load()
    .then((face) => { document.fonts.add(face); })
    .catch(() => { /* falls back to monospace; still playable */ });
  return fontReady;
}

const images = new Map();
function loadImage(path) {
  if (!images.has(path)) {
    images.set(path, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not load ${path}`));
      img.src = asset(path);
    }));
  }
  return images.get(path);
}

/** A grid of equal tiles, drawn by index: tile n is column n % cols, row n / cols. */
export class Sheet {
  constructor(img, size, h = size) {
    this.img = img;
    this.w = size;
    this.h = h;
    this.cols = Math.floor(img.width / size);
  }

  /**
   * Draw tile `n` with its top-left at (x, y). Options: flipX, flipY, rot
   * (radians, about the centre), alpha, scale, tint (a CSS colour washed over it).
   */
  draw(ctx, n, x, y, o = {}) {
    const sx = (n % this.cols) * this.w;
    const sy = Math.floor(n / this.cols) * this.h;
    const s = o.scale ?? 1;
    const w = this.w * s, h = this.h * s;
    if (!o.flipX && !o.flipY && !o.rot && o.alpha == null && !o.tint) {
      ctx.drawImage(this.img, sx, sy, this.w, this.h, Math.round(x), Math.round(y), w, h);
      return;
    }
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.translate(Math.round(x + w / 2), Math.round(y + h / 2));
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(o.flipX ? -1 : 1, o.flipY ? -1 : 1);
    if (o.tint) {
      ctx.drawImage(tinted(this.img, o.tint), sx, sy, this.w, this.h, -w / 2, -h / 2, w, h);
    } else {
      ctx.drawImage(this.img, sx, sy, this.w, this.h, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }
}

// A whole sheet recoloured once per colour and kept: a frightened monster, a
// flashing hit. Cheaper than tinting every frame.
const tints = new Map();
function tinted(img, color) {
  const key = `${img.src}|${color}`;
  if (!tints.has(key)) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    tints.set(key, c);
  }
  return tints.get(key);
}

// ---------------------------------------------------------------- sound

const MUTE_KEY = 'tommy-games:arcade:muted';

/** Web Audio, unlocked by the first tap or key (browsers require one). */
export class Sound {
  constructor(names) {
    this.names = names;
    this.buffers = new Map();
    this.loops = new Map();
    this.ctx = null;
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { this.muted = false; }
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.out = this.ctx.createGain();
    this.out.gain.value = this.muted ? 0 : 0.6;
    this.out.connect(this.ctx.destination);
    for (const name of this.names) {
      fetch(asset(`sounds/${name}.mp3`))
        .then((r) => r.arrayBuffer())
        .then((data) => this.ctx.decodeAudioData(data))
        .then((buf) => this.buffers.set(name, buf))
        .catch(() => { /* a missing sound is not worth stopping the game for */ });
    }
  }

  play(name, { volume = 1, rate = 1, loop = false } = {}) {
    const buf = this.buffers.get(name);
    if (!this.ctx || !buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.loop = loop;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this.out);
    src.start();
    if (loop) {
      this.stop(name);
      this.loops.set(name, src);
    }
    return src;
  }

  /** Start a looping sound unless it is already going. */
  loop(name, opts = {}) {
    if (!this.loops.has(name)) this.play(name, { ...opts, loop: true });
  }

  stop(name) {
    const src = this.loops.get(name);
    if (src) {
      try { src.stop(); } catch { /* already stopped */ }
      this.loops.delete(name);
    }
  }

  stopAll() { for (const name of [...this.loops.keys()]) this.stop(name); }

  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* private mode */ }
    if (this.out) this.out.gain.value = muted ? 0 : 0.6;
  }

  close() {
    this.stopAll();
    this.ctx?.close();
    this.ctx = null;
  }
}

// ---------------------------------------------------------------- input

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'a', KeyZ: 'a', KeyJ: 'a',
  KeyX: 'b', KeyK: 'b',
  Enter: 'start',
  KeyP: 'pause', Escape: 'pause'
};

/**
 * What the player is doing this frame. `held` is anything down right now;
 * `pressed` is only what went down since the last frame, so a tap is never
 * missed and a held key does not repeat.
 */
export class Input {
  constructor() {
    this.down = new Set();
    this.fresh = new Set();
  }
  held(action) { return this.down.has(action); }
  pressed(action) { return this.fresh.has(action); }
  /** Any of the directions or buttons, pressed this frame. */
  any() { return this.fresh.size > 0; }
  press(action) {
    if (!this.down.has(action)) this.fresh.add(action);
    this.down.add(action);
  }
  release(action) { this.down.delete(action); }
  /** A tap or swipe: pressed this frame, never held. */
  tap(action) { this.fresh.add(action); }
  endFrame() { this.fresh.clear(); }
  clear() { this.down.clear(); this.fresh.clear(); }
}

// ---------------------------------------------------------------- the cabinet

const hiKey = (id) => `tommy-games:arcade:${id}`;
function readHi(id) {
  try { return Number(localStorage.getItem(hiKey(id))) || 0; } catch { return 0; }
}
function writeHi(id, score) {
  try { localStorage.setItem(hiKey(id), String(score)); } catch { /* private mode */ }
}

/** Draw arcade text. Sizes are multiples of 8 so the font stays on its pixel grid. */
export function text(ctx, str, x, y, { color = '#fff', align = 'left', size = 8, shadow = true } = {}) {
  ctx.font = `${size}px "${FONT}", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  if (shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(str, Math.round(x) + 1, Math.round(y) + 1);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, Math.round(x), Math.round(y));
}

export const pad = (n, width = 6) => String(Math.max(0, Math.floor(n))).padStart(width, '0');

/**
 * Runs one game in one canvas. `def` is the game module's default export:
 * { id, name, width, height, sprites, sounds, create(rt) }.
 */
export class Cabinet {
  constructor(canvas, def, { onchange } = {}) {
    this.canvas = canvas;
    this.def = def;
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.sound = new Sound(def.sounds ?? []);
    this.onchange = onchange ?? (() => {});
    this.state = 'loading';
    this.hi = readHi(def.id);
    this.newHi = false;
    this.overAt = 0;
    this.frame = 0;
    this.scale = 1;
    this.acc = 0;
    this.last = 0;
    this.raf = 0;
    this.destroyed = false;
    this.onVisibility = () => { if (document.hidden) this.pause(); };
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  async load() {
    const entries = Object.entries(this.def.sprites ?? {});
    const [imgs] = await Promise.all([
      Promise.all(entries.map(([, path]) => loadImage(path))),
      loadFont()
    ]);
    if (this.destroyed) return;
    this.images = Object.fromEntries(entries.map(([name], i) => [name, imgs[i]]));
    this.game = this.def.create(this.api());
    this.setState('title');
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.tick(t));
  }

  /** What a game can reach. */
  api() {
    const self = this;
    return {
      images: this.images,
      sheet: (name, size, h) => new Sheet(this.images[name], size, h),
      sound: this.sound,
      input: this.input,
      width: this.def.width,
      height: this.def.height,
      text: (...args) => text(this.ctx, ...args),
      get hi() { return self.hi; },
      get frame() { return self.frame; }
    };
  }

  setState(state) {
    this.state = state;
    this.onchange(state);
  }

  /** The canvas fills `cssWidth` on screen; draw at device resolution for crisp text. */
  resize(cssWidth) {
    const k = Math.min(4, Math.max(1, Math.round((cssWidth / this.def.width) * (window.devicePixelRatio || 1))));
    this.scale = k;
    this.canvas.width = this.def.width * k;
    this.canvas.height = this.def.height * k;
    if (this.state !== 'loading') this.draw();
  }

  /** Fire, tap or Enter: start a game from the title, or move on from game over. */
  begin() {
    this.sound.unlock();
    if (this.state === 'title' || (this.state === 'over' && performance.now() - this.overAt > 900)) {
      this.input.clear();
      this.game.reset();
      this.newHi = false;
      this.setState('play');
      this.sound.play('start', { volume: 0.7 });
    } else if (this.state === 'paused') {
      this.resume();
    }
  }

  pause() {
    if (this.state !== 'play') return;
    this.sound.stopAll();
    this.input.clear();
    this.setState('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.input.clear();
    this.last = performance.now();
    this.setState('play');
  }

  togglePause() { this.state === 'paused' ? this.resume() : this.pause(); }

  tick(now) {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame((t) => this.tick(t));
    this.acc += Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    let steps = 0;
    while (this.acc >= STEP && steps < 5) {
      this.update();
      this.acc -= STEP;
      steps++;
    }
    if (steps) this.draw();
  }

  update() {
    const input = this.input;
    if (input.pressed('pause')) {
      this.togglePause();
    } else if (this.state === 'play') {
      this.frame++;
      this.game.update();
      if (this.game.score > this.hi) {
        this.hi = this.game.score;
        this.newHi = true;
      }
      if (this.game.over) {
        this.sound.stopAll();
        this.sound.play('gameover', { volume: 0.8 });
        if (this.newHi) writeHi(this.def.id, this.hi);
        this.overAt = performance.now();
        this.setState('over');
      }
    } else if (this.state === 'title' || this.state === 'over' || this.state === 'paused') {
      if (this.state !== 'paused') {
        this.frame++;
        this.game.attract?.();
      }
      if (input.pressed('a') || input.pressed('start')) this.begin();
    }
    input.endFrame();
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    this.game.draw(ctx, this.state);
    const { width: W, height: H } = this.def;
    if (this.state === 'title') {
      shade(ctx, W, H, 0.45);
      text(ctx, this.def.name.toUpperCase(), W / 2, H * 0.34, { align: 'center', size: 16, color: this.def.color ?? '#ffd84a' });
      text(ctx, this.def.tagline ?? '', W / 2, H * 0.34 + 26, { align: 'center', color: '#cfe8ff' });
      if (Math.floor(this.frame / 30) % 2 === 0) {
        text(ctx, matchMedia('(pointer: coarse)').matches ? 'TAP TO PLAY' : 'PRESS SPACE', W / 2, H * 0.58, { align: 'center' });
      }
      text(ctx, `HI ${pad(this.hi)}`, W / 2, H * 0.58 + 24, { align: 'center', color: '#ffd84a' });
    } else if (this.state === 'paused') {
      shade(ctx, W, H, 0.55);
      text(ctx, 'PAUSED', W / 2, H * 0.42, { align: 'center', size: 16 });
      text(ctx, 'TAP OR PRESS P', W / 2, H * 0.42 + 28, { align: 'center', color: '#cfe8ff' });
    } else if (this.state === 'over') {
      shade(ctx, W, H, 0.5);
      text(ctx, 'GAME OVER', W / 2, H * 0.38, { align: 'center', size: 16, color: '#ff6b5e' });
      text(ctx, `SCORE ${pad(this.game.score)}`, W / 2, H * 0.38 + 30, { align: 'center' });
      if (this.newHi) text(ctx, 'NEW HIGH SCORE!', W / 2, H * 0.38 + 46, { align: 'center', color: '#ffd84a' });
      if (performance.now() - this.overAt > 900 && Math.floor(this.frame / 30) % 2 === 0) {
        text(ctx, 'PLAY AGAIN?', W / 2, H * 0.62, { align: 'center', color: '#cfe8ff' });
      }
    }
  }

  setMuted(muted) {
    this.sound.unlock();
    this.sound.setMuted(muted);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.newHi) writeHi(this.def.id, this.hi);
    this.sound.close();
  }
}

function shade(ctx, W, H, alpha) {
  ctx.fillStyle = `rgba(4, 6, 20, ${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

export { KEYS };

/** Small shared helpers for the games. */
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
