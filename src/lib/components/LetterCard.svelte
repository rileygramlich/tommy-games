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
    /* Sized for reading at arm's length, not for fitting the most cards on screen. */
    width: clamp(58px, 16vw, 78px);
    height: clamp(82px, 22.5vw, 110px);
    padding: 0;
    border-radius: 11px;
    border: 1.5px solid var(--card-edge);
    background: linear-gradient(160deg, var(--card-face), color-mix(in srgb, var(--card-face) 86%, #e6dcc6));
    color: #23201c;
    box-shadow: var(--shadow-1);
    font-family: var(--serif);
    user-select: none;
    transition: transform 0.14s ease, box-shadow 0.14s ease;
  }
  .lcard.sm { width: clamp(46px, 12vw, 58px); height: clamp(64px, 17vw, 82px); }
  .lcard.lg { width: clamp(70px, 19vw, 96px); height: clamp(98px, 26.5vw, 134px); }
  button.lcard { cursor: pointer; }
  .lcard.playable:hover { transform: translateY(-7px); box-shadow: var(--shadow-2); }
  .lcard.selected { transform: translateY(-6px); box-shadow: 0 0 0 2px var(--brass), var(--shadow-2); }

  .letters { font-size: 2.2rem; font-weight: 700; letter-spacing: -0.02em; }
  .letters.pair { font-size: 1.6rem; }
  .sm .letters { font-size: 1.6rem; }
  .sm .letters.pair { font-size: 1.15rem; }
  .lg .letters { font-size: 2.7rem; }
  .lg .letters.pair { font-size: 1.95rem; }
  .value {
    /* Dark enough to read, not so loud it competes with the letter. */
    position: absolute; right: 6px; bottom: 5px;
    font-family: var(--tabular); font-size: 0.9rem; font-weight: 600; color: #6b6153;
  }
  .sm .value { font-size: 0.75rem; }
  .lg .value { font-size: 1rem; }
  .order {
    position: absolute; left: 6px; top: 5px;
    font-family: var(--tabular); font-size: 0.85rem; font-weight: 700; color: #8a6a28;
  }
  .back { background: repeating-linear-gradient(45deg, var(--felt) 0 6px, var(--felt-deep) 6px 12px); border-color: var(--felt-deep); }
  .weave { position: absolute; inset: 5px; border: 1px solid color-mix(in srgb, var(--brass) 55%, transparent); border-radius: 5px; }
</style>
