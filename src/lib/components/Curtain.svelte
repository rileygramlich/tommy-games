<script>
  let { name, onreveal } = $props();
</script>

<div class="curtain fade-in">
  <div class="inner">
    <p class="muted">Pass the device</p>
    <h2>{name}, your turn</h2>
    <button class="btn brass" onclick={onreveal}>Show my hand</button>
  </div>
</div>

<style>
  .curtain {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--felt-deep) 92%, black);
    backdrop-filter: blur(3px);
  }
  .inner { text-align: center; color: #f2e9d6; display: grid; gap: 0.9rem; justify-items: center; }
  .inner h2 { font-size: clamp(1.6rem, 6vw, 2.4rem); }
  .inner .muted { color: color-mix(in srgb, var(--brass-soft) 80%, transparent); letter-spacing: 0.14em; text-transform: uppercase; font-size: 0.72rem; margin: 0; }
</style>
