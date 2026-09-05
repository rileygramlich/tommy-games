<script>
  import { SUIT_SYMBOLS } from '../games/wizard/deck.js';
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
  {:else if card.kind === 'wizard'}
    <span class="corner tl art">✦</span>
    <svg class="art-svg wiz" viewBox="0 0 44 52" aria-hidden="true">
      <!-- pointed hat, brim, and a little night sky around it -->
      <path class="hat" d="M22 5 C24 17 29 31 34 39 L10 39 C15 31 20 17 22 5 Z" />
      <rect class="brim" x="5" y="37.5" width="34" height="6.5" rx="3.25" />
      <path class="spark" d="M20 16 l1.1 3.1 3.1 1.1 -3.1 1.1 -1.1 3.1 -1.1 -3.1 -3.1 -1.1 3.1 -1.1 Z" />
      <path class="spark" d="M25 28 l0.8 2.2 2.2 0.8 -2.2 0.8 -0.8 2.2 -0.8 -2.2 -2.2 -0.8 2.2 -0.8 Z" />
      <path class="glint" d="M7 12 l0.9 2.5 2.5 0.9 -2.5 0.9 -0.9 2.5 -0.9 -2.5 -2.5 -0.9 2.5 -0.9 Z" />
      <path class="glint" d="M36 20 l0.7 2 2 0.7 -2 0.7 -0.7 2 -0.7 -2 -2 -0.7 2 -0.7 Z" />
    </svg>
    <span class="name">Wizard</span>
    <span class="corner br art">✦</span>
  {:else if card.kind === 'jester'}
    <span class="corner tl art jest">✧</span>
    <svg class="art-svg jest" viewBox="0 0 44 52" aria-hidden="true">
      <!-- two long horns sweeping out of a soft cap, a bell hanging off each -->
      <path class="horn" d="M16 34 C6.5 30 3 21.5 4.2 12.6 C8.5 15.5 12.5 20 17.8 26.5 C16.2 29 15.6 31.5 16 34 Z" />
      <path class="horn" d="M28 34 C37.5 30 41 21.5 39.8 12.6 C35.5 15.5 31.5 20 26.2 26.5 C27.8 29 28.4 31.5 28 34 Z" />
      <path class="dome" d="M12.5 34 C12.5 22.8 31.5 22.8 31.5 34 Z" />
      <rect class="band" x="11" y="32.4" width="22" height="5.2" rx="2.6" />
      <circle class="bell" cx="3.2" cy="10.4" r="3.2" />
      <circle class="bell" cx="40.8" cy="10.4" r="3.2" />
      <circle class="shine" cx="2.2" cy="9.4" r="0.9" />
      <circle class="shine" cx="39.8" cy="9.4" r="0.9" />
    </svg>
    <span class="name">Jester</span>
    <span class="corner br art jest">✧</span>
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
    width: 62px;
    height: 88px;
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
  .card.sm { width: 46px; height: 66px; }
  .card.lg { width: 78px; height: 110px; }
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
  .special {
    background:
      radial-gradient(80% 60% at 50% 24%, rgba(255, 255, 255, 0.9), transparent 70%),
      linear-gradient(160deg, #fffdf7, #efe5cf);
  }
  /* A thin inner rule, the way a printed court card is framed. */
  .special::after {
    content: ''; position: absolute; inset: 4px;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    border-radius: 6px; pointer-events: none;
  }
  .corner.art { font-size: 0.7rem; opacity: 0.75; }
  .sm .corner.art { font-size: 0.55rem; }

  .art-svg { width: 62%; height: auto; margin-top: 2px; }
  .sm .art-svg { width: 58%; }
  .wiz { color: #5b3a86; }
  .wiz .hat { fill: currentColor; }
  .wiz .brim { fill: color-mix(in srgb, currentColor 82%, black 18%); }
  .wiz .spark { fill: var(--brass-soft); }
  .wiz .glint { fill: color-mix(in srgb, currentColor 45%, white); }
  .corner.art { color: #5b3a86; }

  .jest { color: #b8862c; }
  .jest .horn { fill: color-mix(in srgb, currentColor 76%, black 24%); }
  .jest .dome { fill: currentColor; }
  .jest .bell { fill: color-mix(in srgb, currentColor 62%, white 38%); stroke: currentColor; stroke-width: 1.5; }
  .jest .shine { fill: rgba(255, 255, 255, 0.85); }
  .jest .band { fill: color-mix(in srgb, currentColor 88%, black 12%); }
  .corner.art.jest { color: #b8862c; }

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
