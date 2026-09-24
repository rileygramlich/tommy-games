<script>
  // A letter card, drawn the way the printed ones are: the letter large in the
  // middle, its value in two opposite corners so it reads whichever way the
  // card is held, on a proper 2.5 × 3.5 card shape.
  let {
    card = null,
    size = 'md',
    playable = false,
    selected = false,
    faceDown = false,
    ghost = false,
    onclick = null,
    order = null
  } = $props();

  const pair = $derived(!!card && card.letters.length > 1);
</script>

<svelte:element
  this={onclick ? 'button' : 'div'}
  role={onclick ? 'button' : undefined}
  class="lcard {size}"
  class:playable
  class:selected
  class:ghost
  class:back={faceDown}
  aria-label={faceDown ? 'Face-down card' : card ? `${card.letters.toUpperCase()}, ${card.value} points` : 'Card'}
  {onclick}
>
  {#if faceDown || !card}
    <span class="weave" aria-hidden="true"></span>
  {:else}
    <span class="corner tl">{card.value}</span>
    <span class="letters" class:pair>{card.letters.toUpperCase()}</span>
    <span class="corner br">{card.value}</span>
    {#if order != null}<span class="order">{order}</span>{/if}
  {/if}
</svelte:element>

<style>
  .lcard {
    position: relative;
    container-type: inline-size;
    display: grid;
    place-items: center;
    /* The shape of a real card, so nothing has to be guessed at. */
    width: clamp(62px, 17vw, 86px);
    aspect-ratio: 5 / 7;
    padding: 0;
    border-radius: 10px;
    border: 1px solid var(--card-edge);
    background:
      radial-gradient(120% 90% at 50% 0%, #fffefa, var(--card-face)),
      var(--card-face);
    color: #23201c;
    box-shadow: var(--shadow-1);
    font-family: var(--serif);
    user-select: none;
    -webkit-user-select: none;
    transition: transform 0.14s ease, box-shadow 0.14s ease;
  }
  /* The hairline frame printed just inside the edge of the card. */
  .lcard::after {
    content: '';
    position: absolute;
    inset: 5%;
    border: 1px solid color-mix(in srgb, var(--card-edge) 70%, transparent);
    border-radius: 6px;
    pointer-events: none;
  }
  .lcard.sm { width: clamp(44px, 12vw, 56px); }
  .lcard.lg { width: clamp(76px, 21vw, 104px); }
  button.lcard { cursor: pointer; }
  .lcard.playable:hover { transform: translateY(-7px); box-shadow: var(--shadow-2); }
  .lcard.selected { transform: translateY(-8px); box-shadow: 0 0 0 2px var(--brass), var(--shadow-2); }
  .lcard.ghost { box-shadow: var(--shadow-2); transform: rotate(-3deg) scale(1.04); }

  /* Everything inside scales with the card, so one rule covers every size. */
  .letters { font-size: 44cqw; font-weight: 600; line-height: 1; letter-spacing: -0.02em; }
  .letters.pair { font-size: 30cqw; letter-spacing: -0.04em; }

  .corner {
    position: absolute;
    font-family: var(--tabular);
    font-size: 15cqw;
    font-weight: 700;
    line-height: 1;
    color: color-mix(in srgb, #23201c 62%, transparent);
  }
  .tl { top: 8%; left: 9%; }
  .br { bottom: 8%; right: 9%; transform: rotate(180deg); }

  .order {
    position: absolute; top: 8%; right: 9%;
    font-family: var(--tabular); font-size: 13cqw; font-weight: 700; color: #8a6a28;
  }

  .back {
    background: repeating-linear-gradient(45deg, var(--felt) 0 6px, var(--felt-deep) 6px 12px);
    border-color: var(--felt-deep);
  }
  .back::after { display: none; }
  .weave {
    position: absolute; inset: 6%;
    border: 1px solid color-mix(in srgb, var(--brass) 55%, transparent);
    border-radius: 5px;
  }
</style>
