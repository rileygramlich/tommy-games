<script>
  import { onMount } from 'svelte';
  import { ARCADE } from './registry.js';
  import { asset, loadFont } from './runtime.js';

  let { go } = $props();
  onMount(() => { loadFont(); });

  /** Draw one sprite from a sheet into a small canvas, scaled up crisply. */
  function sprite(canvas, icon) {
    const scale = 2;
    const w = icon.w ?? icon.size, h = icon.h ?? icon.size;
    canvas.width = w * scale;
    canvas.height = h * scale;
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const cols = icon.n == null ? 1 : Math.floor(img.width / icon.size);
      const sx = icon.n == null ? 0 : (icon.n % cols) * icon.size;
      const sy = icon.n == null ? 0 : Math.floor(icon.n / cols) * icon.size;
      ctx.drawImage(img, sx, sy, w, h, 0, 0, w * scale, h * scale);
    };
    img.src = asset(icon.src);
  }
</script>

<section class="arcade-shelf" aria-labelledby="arcade-title">
  <div class="head">
    <h2 id="arcade-title">Arcade</h2>
    <p>Five quick games in the spirit of the classics. One player, no account, high scores kept on this device.</p>
  </div>
  <div class="cabinets">
    {#each ARCADE as game (game.id)}
      <button class="cabinet" style="--glow: {game.color}" onclick={() => go(`#/arcade/${game.id}`)}>
        <div class="marquee">
          {#each game.icons as icon, i (i)}
            <canvas class="icon" class:flip={icon.flip} use:sprite={icon} aria-hidden="true"></canvas>
          {/each}
        </div>
        <span class="name">{game.name}</span>
        <span class="blurb">{game.blurb}</span>
        <span class="play">PLAY</span>
      </button>
    {/each}
  </div>
</section>

<style>
  .arcade-shelf { margin-top: 2.6rem; }
  .head { max-width: 40rem; margin-bottom: 1rem; }
  .head p { margin: 0.35rem 0 0; }
  .cabinets { display: grid; gap: 0.9rem; grid-template-columns: repeat(auto-fit, minmax(188px, 1fr)); }
  .cabinet {
    display: grid; gap: 0.55rem; align-content: start; text-align: left; cursor: pointer;
    padding: 1rem 1.05rem 1.1rem; border-radius: var(--radius);
    background:
      radial-gradient(260px 140px at 50% 0%, color-mix(in srgb, var(--glow) 30%, transparent), transparent 75%),
      #0b0e22;
    border: 1px solid color-mix(in srgb, var(--glow) 35%, #1d2340);
    color: #e8eefc; box-shadow: var(--shadow-1);
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }
  .cabinet:hover, .cabinet:focus-visible { transform: translateY(-2px); box-shadow: 0 8px 26px color-mix(in srgb, var(--glow) 30%, transparent); }
  .marquee {
    display: flex; align-items: flex-end; gap: 0.6rem; min-height: 64px; overflow: hidden;
    padding: 0.5rem 0.6rem; border-radius: 10px; background: rgba(0, 0, 0, 0.35);
  }
  .icon { display: block; image-rendering: pixelated; height: 44px; width: auto; max-width: 30%; object-fit: contain; }
  .icon.flip { transform: rotate(180deg); }
  .name {
    font-family: 'Press Start 2P', monospace; font-size: 0.72rem; line-height: 1.5;
    color: var(--glow); text-shadow: 0 0 10px color-mix(in srgb, var(--glow) 55%, transparent);
  }
  .blurb { font-size: 0.86rem; line-height: 1.5; color: #b9c3dc; }
  .play {
    justify-self: start; margin-top: 0.2rem;
    font-family: 'Press Start 2P', monospace; font-size: 0.6rem;
    padding: 0.55rem 0.8rem; border-radius: 8px; color: #0b0e22; background: var(--glow);
  }
</style>
