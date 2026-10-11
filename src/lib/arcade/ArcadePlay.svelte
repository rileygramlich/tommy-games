<script>
  import { onMount } from 'svelte';
  import { Cabinet, KEYS, loadFont } from './runtime.js';

  let { game, onexit } = $props();

  let canvas = $state();
  let stage = $state();
  let cab = null;
  let state = $state('loading');
  let muted = $state(false);
  let error = $state('');
  let size = $state({ w: 0, h: 0 });

  const controls = $derived(game.controls ?? { dpad: 'lr', buttons: [{ action: 'a', label: 'Fire' }] });
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

  onMount(() => {
    let alive = true;
    loadFont(); // the bar and buttons use it too
    const resizer = new ResizeObserver(() => fit());

    game.load().then(async (mod) => {
      if (!alive) return;
      const def = { ...mod.default, id: game.id, name: game.name, tagline: game.short, color: game.color };
      cab = new Cabinet(canvas, def, { onchange: (s) => { state = s; } });
      muted = cab.sound.muted;
      resizer.observe(stage);
      fit();
      await cab.load();
    }).catch((err) => { error = err.message ?? 'That game would not load.'; });

    const onKey = (e, down) => {
      const action = KEYS[e.code];
      if (!action || !cab || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      cab.sound.unlock();
      if (down) {
        if (e.repeat) return;
        if (cab.state !== 'play' && (action === 'a' || action === 'start')) cab.begin();
        else cab.input.press(action);
      } else {
        cab.input.release(action);
      }
    };
    const keydown = (e) => onKey(e, true);
    const keyup = (e) => onKey(e, false);
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    const blur = () => cab?.pause();
    window.addEventListener('blur', blur);

    return () => {
      alive = false;
      resizer.disconnect();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur);
      cab?.destroy();
    };
  });

  /** As big as the stage allows, keeping the game's shape. */
  function fit() {
    if (!stage || !cab) return;
    const { width: W, height: H } = cab.def;
    const box = stage.getBoundingClientRect();
    let w = box.width;
    let h = (w * H) / W;
    if (h > box.height) { h = box.height; w = (h * W) / H; }
    size = { w: Math.floor(w), h: Math.floor((Math.floor(w) * H) / W) };
    cab.resize(size.w);
  }

  // ---- touch: the canvas starts, resumes and (in maze games) takes swipes
  let swipe = null;
  function canvasDown(e) {
    if (!cab) return;
    cab.sound.unlock();
    if (cab.state !== 'play') { cab.begin(); return; }
    if (controls.swipe) swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
    else if (controls.tap) cab.input.press(controls.tap);
  }
  function canvasMove(e) {
    if (!swipe || e.pointerId !== swipe.id) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (Math.hypot(dx, dy) < 18) return;
    cab.input.tap(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }
  function canvasUp() {
    swipe = null;
    if (controls.tap) cab?.input.release(controls.tap);
  }

  // ---- on-screen buttons: held while the finger is down
  function hold(action) {
    return {
      onpointerdown: (e) => {
        e.preventDefault();
        if (!cab) return;
        cab.sound.unlock();
        if (cab.state !== 'play') { cab.begin(); return; }
        cab.input.press(action);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      },
      onpointerup: () => cab?.input.release(action),
      onpointercancel: () => cab?.input.release(action),
      onlostpointercapture: () => cab?.input.release(action),
      oncontextmenu: (e) => e.preventDefault()
    };
  }

  function toggleSound() {
    muted = !muted;
    cab?.setMuted(muted);
  }
</script>

<div class="arcade" style="--glow: {game.color}">
  <header class="bar">
    <button class="chip" onclick={onexit} aria-label="Back to the shelf">‹ Shelf</button>
    <span class="title">{game.name}</span>
    <div class="row">
      <button class="chip" onclick={toggleSound} aria-label={muted ? 'Sound on' : 'Sound off'}>{muted ? 'Muted' : 'Sound'}</button>
      <button class="chip" onclick={() => cab?.togglePause()} disabled={state !== 'play' && state !== 'paused'}
        aria-label={state === 'paused' ? 'Resume' : 'Pause'}>{state === 'paused' ? 'Resume' : 'Pause'}</button>
    </div>
  </header>

  <div class="stage" bind:this={stage}>
    <div class="screen" style="width: {size.w}px; height: {size.h}px">
      <canvas bind:this={canvas} style="width: {size.w}px; height: {size.h}px"
        onpointerdown={canvasDown} onpointermove={canvasMove} onpointerup={canvasUp} onpointercancel={canvasUp}
        oncontextmenu={(e) => e.preventDefault()}></canvas>
      {#if state === 'loading'}<p class="loading">{error || 'Loading…'}</p>{/if}
    </div>
  </div>

  {#if touch}
    <div class="pad">
      {#if controls.dpad === '4way'}
        <div class="cross">
          <button class="key up" aria-label="Up" {...hold('up')}>▲</button>
          <button class="key left" aria-label="Left" {...hold('left')}>◀</button>
          <button class="key right" aria-label="Right" {...hold('right')}>▶</button>
          <button class="key down" aria-label="Down" {...hold('down')}>▼</button>
        </div>
      {:else}
        <div class="lr">
          <button class="key" aria-label="Left" {...hold('left')}>◀</button>
          <button class="key" aria-label="Right" {...hold('right')}>▶</button>
        </div>
      {/if}
      <div class="buttons">
        {#each controls.buttons ?? [] as b (b.action)}
          <button class="key big" {...hold(b.action)}>{b.label}</button>
        {/each}
      </div>
    </div>
  {:else}
    <p class="help">{game.keys}</p>
  {/if}
</div>

<style>
  .arcade {
    position: fixed; inset: 0; z-index: 20;
    display: flex; flex-direction: column;
    background:
      radial-gradient(900px 500px at 50% 0%, color-mix(in srgb, var(--glow) 28%, transparent), transparent 70%),
      #07091a;
    color: #e8eefc;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
    overscroll-behavior: none;
  }
  .bar {
    display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
    padding: 0.55rem 0.7rem;
  }
  .title {
    font-family: 'Press Start 2P', monospace; font-size: 0.72rem; letter-spacing: 0.04em;
    color: var(--glow); text-shadow: 0 0 12px color-mix(in srgb, var(--glow) 60%, transparent);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
  }
  /* On a phone the name is already on the title screen; the buttons need the room. */
  @media (max-width: 420px) { .title { display: none; } }
  .row { display: flex; gap: 0.4rem; }
  .chip {
    font-family: 'Press Start 2P', monospace; font-size: 0.55rem; line-height: 1;
    padding: 0.6rem 0.65rem; border-radius: 8px; cursor: pointer; white-space: nowrap;
    background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.16); color: #e8eefc;
  }
  .chip:disabled { opacity: 0.4; cursor: default; }
  .stage { flex: 1; min-height: 0; display: grid; place-items: center; padding: 0 0.5rem; }
  .screen {
    position: relative; border-radius: 6px; overflow: hidden;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.08), 0 0 40px color-mix(in srgb, var(--glow) 35%, transparent);
  }
  canvas {
    display: block; image-rendering: pixelated; image-rendering: crisp-edges;
    touch-action: none; background: #000;
  }
  /* A faint scanline, like the glass of an old cabinet. */
  .screen::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.12) 0 1px, transparent 1px 3px);
    mix-blend-mode: multiply;
  }
  .loading {
    position: absolute; inset: 0; display: grid; place-items: center; margin: 0;
    font-family: 'Press Start 2P', monospace; font-size: 0.6rem; color: #cfe8ff;
  }
  .help {
    text-align: center; margin: 0.6rem 0 0.9rem; color: #9aa6c4;
    font-family: 'Press Start 2P', monospace; font-size: 0.55rem; line-height: 1.8;
  }
  .pad {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.6rem 1rem 0.9rem; gap: 1rem; touch-action: none;
  }
  .key {
    font-family: 'Press Start 2P', monospace; font-size: 0.85rem; color: #fff;
    width: 64px; height: 64px; border-radius: 16px; cursor: pointer;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.06));
    border: 1px solid rgba(255, 255, 255, 0.22);
    box-shadow: 0 4px 0 rgba(0, 0, 0, 0.45);
    touch-action: none;
  }
  .key:active { transform: translateY(2px); box-shadow: 0 2px 0 rgba(0, 0, 0, 0.45); background: rgba(255, 255, 255, 0.24); }
  .lr { display: flex; gap: 0.7rem; }
  .cross {
    display: grid; grid-template-columns: repeat(3, 56px); grid-template-rows: repeat(3, 52px);
    gap: 4px;
  }
  .cross .key { width: 56px; height: 52px; font-size: 0.7rem; }
  .cross .up { grid-column: 2; grid-row: 1; }
  .cross .left { grid-column: 1; grid-row: 2; }
  .cross .right { grid-column: 3; grid-row: 2; }
  .cross .down { grid-column: 2; grid-row: 3; }
  .buttons { display: flex; gap: 0.7rem; }
  .key.big {
    width: 84px; height: 84px; border-radius: 50%; font-size: 0.6rem;
    background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--glow) 90%, white), color-mix(in srgb, var(--glow) 70%, black));
    border-color: color-mix(in srgb, var(--glow) 60%, white);
  }
</style>
