<script>
  import { SUIT_SYMBOLS } from '../games/wizard/deck.js';
  import { ART } from '../art.js';
  let {
    card = null,
    size = 'md',
    playable = false,
    dimmed = false,
    selected = false,
    faceDown = false,
    label = null,
    onclick = null
  } = $props();

  const red = $derived(card?.suit === 'H' || card?.suit === 'D');
  const rank = $derived(card && card.kind === 'suit'
    ? ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[card.rank] ?? String(card.rank))
    : '');
</script>

<svelte:element
  this={onclick ? 'button' : 'div'}
  role={onclick ? 'button' : undefined}
  class="card {size}"
  class:playable
  class:dimmed
  class:selected
  class:red
  class:back={faceDown}
  class:special={card && card.kind !== 'suit'}
  aria-label={label ?? (faceDown ? 'Face-down card' : card ? `${rank}${card.suit ?? ''} ${card.kind}` : 'Card')}
  disabled={onclick && !playable ? true : undefined}
  {onclick}
>
  {#if faceDown || !card}
    <span class="weave" aria-hidden="true"></span>
  {:else if card.kind === 'wizard' || card.kind === 'jester'}
    <img class="painting" src={ART[card.kind].src} alt="" draggable="false" decoding="async" />
    <span class="name {card.kind}">{card.kind === 'wizard' ? 'Wizard' : 'Jester'}</span>
  {:else}
    <span class="corner tl"><b>{rank}</b>{SUIT_SYMBOLS[card.suit]}</span>
    <span class="pip">{SUIT_SYMBOLS[card.suit]}</span>
    <span class="corner br"><b>{rank}</b>{SUIT_SYMBOLS[card.suit]}</span>
  {/if}
</svelte:element>

<style>
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: clamp(46px, 13vw, 62px);
    height: clamp(65px, 18.4vw, 88px);
    padding: 0;
    border-radius: 9px;
    border: 1px solid var(--card-edge);
    background: linear-gradient(160deg, var(--card-face), color-mix(in srgb, var(--card-face) 88%, #e6dcc6));
    color: #23201c;
    box-shadow: var(--shadow-1);
    font-family: var(--serif);
    user-select: none;
    transition: transform 0.14s ease, box-shadow 0.14s ease, filter 0.14s ease;
  }
  .card.sm { width: clamp(36px, 10vw, 46px); height: clamp(51px, 14.2vw, 66px); }
  .card.lg { width: clamp(54px, 15vw, 78px); height: clamp(76px, 21.2vw, 110px); }
  .card.red { color: var(--rose); }
  .card.dimmed { filter: grayscale(0.55) brightness(0.86); opacity: 0.72; }
  button.card { cursor: pointer; }
  button.card:disabled { cursor: default; }
  .card.playable:hover { transform: translateY(-7px); box-shadow: var(--shadow-2); }
  .card.selected { transform: translateY(-9px); box-shadow: 0 0 0 2px var(--brass), var(--shadow-2); }

  .corner { position: absolute; font-size: 0.78rem; line-height: 1; display: flex; align-items: center; gap: 1px; }
  .corner b { font-weight: 600; }
  .tl { top: 6px; left: 6px; }
  .br { bottom: 6px; right: 6px; transform: rotate(180deg); }
  .pip { font-size: 1.75rem; line-height: 1; }
  .sm .pip { font-size: 1.25rem; }
  .sm .corner { font-size: 0.62rem; }

  .name {
    font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase;
    margin-top: 2px; color: #6b6153;
  }
  .sm .name { font-size: 0.46rem; letter-spacing: 0.06em; }
  /* Wizard and Jester: the painting fills the card inside a thin margin of card
     stock, the name on a coloured band, as on a printed court card. */
  .special { overflow: hidden; container-type: inline-size; }
  .painting {
    position: absolute; inset: 3px;
    width: calc(100% - 6px); height: calc(100% - 6px);
    object-fit: cover; border-radius: 6px;
  }
  .special .name {
    position: absolute; left: 3px; right: 3px; bottom: 3px; margin: 0;
    padding: 3px 2px 2px; border-radius: 0 0 6px 6px; text-align: center;
    color: #fbf6ea; font-size: 15cqw; line-height: 1.15; letter-spacing: 0.04em; white-space: nowrap;
  }
  .name.wizard { background: #4a2f70; }
  .name.jester { background: #8a6420; }

  .back {
    background:
      repeating-linear-gradient(45deg, var(--felt) 0 6px, var(--felt-deep) 6px 12px);
    border-color: var(--felt-deep);
  }
  .weave {
    position: absolute; inset: 5px;
    border: 1px solid color-mix(in srgb, var(--brass) 55%, transparent);
    border-radius: 5px;
  }
</style>
