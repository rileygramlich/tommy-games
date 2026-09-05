<script>
  let {
    card = null,
    size = 'md',
    playable = false,
    selected = false,
    faceDown = false,
    onclick = null,
    order = null
  } = $props();
</script>

<svelte:element
  this={onclick ? 'button' : 'div'}
  role={onclick ? 'button' : undefined}
  class="lcard {size}"
  class:playable
  class:selected
  class:back={faceDown}
  aria-label={faceDown ? 'Face-down card' : card ? `${card.letters.toUpperCase()}, ${card.value} points` : 'Card'}
  {onclick}
>
  {#if faceDown || !card}
    <span class="weave" aria-hidden="true"></span>
  {:else}
    <span class="letters" class:pair={card.letters.length > 1}>{card.letters.toUpperCase()}</span>
    <span class="value">{card.value}</span>
    {#if order != null}<span class="order">{order}</span>{/if}
  {/if}
</svelte:element>

<style>
  .lcard {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(44px, 12.5vw, 58px);
    height: clamp(62px, 17.7vw, 82px);
    padding: 0;
    border-radius: 9px;
    border: 1px solid var(--card-edge);
    background: linear-gradient(160deg, var(--card-face), color-mix(in srgb, var(--card-face) 86%, #e6dcc6));
    color: #23201c;
    box-shadow: var(--shadow-1);
    font-family: var(--serif);
    user-select: none;
    transition: transform 0.14s ease, box-shadow 0.14s ease;
  }
  .lcard.sm { width: clamp(34px, 9.5vw, 42px); height: clamp(48px, 13.5vw, 60px); }
  .lcard.lg { width: clamp(50px, 14vw, 70px); height: clamp(70px, 19.8vw, 98px); }
  button.lcard { cursor: pointer; }
  .lcard.playable:hover { transform: translateY(-7px); box-shadow: var(--shadow-2); }
  .lcard.selected { transform: translateY(-6px); box-shadow: 0 0 0 2px var(--brass), var(--shadow-2); }

  .letters { font-size: 1.55rem; font-weight: 600; letter-spacing: -0.02em; }
  .letters.pair { font-size: 1.15rem; }
  .sm .letters { font-size: 1.1rem; }
  .sm .letters.pair { font-size: 0.85rem; }
  .value {
    position: absolute; right: 5px; bottom: 4px;
    font-family: var(--tabular); font-size: 0.62rem; color: var(--ink-faint);
  }
  .order {
    position: absolute; left: 5px; top: 4px;
    font-family: var(--tabular); font-size: 0.6rem; color: var(--brass);
  }
  .back { background: repeating-linear-gradient(45deg, var(--felt) 0 6px, var(--felt-deep) 6px 12px); border-color: var(--felt-deep); }
  .weave { position: absolute; inset: 5px; border: 1px solid color-mix(in srgb, var(--brass) 55%, transparent); border-radius: 5px; }
</style>
