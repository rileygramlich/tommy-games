<script>
  import { CHARACTERS } from './characters.js';
  import { ART } from '../../art.js';
  let {
    character = null,
    size = 'md',
    faceDown = false,
    dead = false,
    selected = false,
    dimmed = false,
    onclick = null
  } = $props();
  const spec = $derived(character ? CHARACTERS[character] : null);
</script>

<svelte:element
  this={onclick ? 'button' : 'div'}
  role={onclick ? 'button' : undefined}
  class="inf {size}"
  class:back={faceDown || !spec}
  class:dead
  class:selected
  class:dimmed
  style={spec ? `--ink-colour:${spec.colour}` : ''}
  aria-label={faceDown ? 'Face-down influence' : spec ? spec.name : 'Influence'}
  {onclick}
>
  {#if faceDown || !spec}
    <span class="weave" aria-hidden="true"></span>
  {:else}
    <img class="painting" src={ART[spec.key].src} alt="" draggable="false" decoding="async" />
    <span class="name">{spec.name}</span>
  {/if}
</svelte:element>

<style>
  .inf {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: clamp(52px, 14vw, 68px);
    height: clamp(72px, 19.6vw, 95px);
    padding: 0;
    border-radius: 9px;
    border: 1px solid var(--card-edge);
    background: linear-gradient(165deg, var(--card-face), color-mix(in srgb, var(--card-face) 84%, #e2d7bd));
    color: var(--ink-colour, #23201c);
    box-shadow: var(--shadow-1);
    font-family: var(--serif);
    transition: transform 0.14s ease, box-shadow 0.14s ease, filter 0.14s ease;
  }
  /* A size container, so the name can be sized to the card it is on. */
  .inf:not(.back) { overflow: hidden; container-type: inline-size; }
  .inf.sm { width: clamp(38px, 10vw, 46px); height: clamp(52px, 14vw, 64px); }
  .inf.lg { width: clamp(64px, 17vw, 82px); height: clamp(88px, 23.5vw, 114px); }
  button.inf { cursor: pointer; }
  button.inf:hover { transform: translateY(-4px); box-shadow: var(--shadow-2); }
  .inf.selected { transform: translateY(-6px); box-shadow: 0 0 0 2px var(--brass), var(--shadow-2); }
  .inf.dimmed { filter: grayscale(0.5) brightness(0.9); opacity: 0.7; }
  .inf.dead { filter: grayscale(0.85); opacity: 0.55; transform: rotate(-3deg); }

  /* The painting fills the card inside a thin margin of card stock, and the
     name sits on a band in the character's colour, as on a printed card. */
  .painting {
    position: absolute; inset: 3px;
    width: calc(100% - 6px); height: calc(100% - 6px);
    object-fit: cover; border-radius: 6px;
  }
  .name {
    /* "Ambassador" has to fit the same card as "Duke". */
    position: absolute; left: 3px; right: 3px; bottom: 3px;
    padding: 3px 2px 2px; border-radius: 0 0 6px 6px;
    background: color-mix(in srgb, var(--ink-colour, #23201c) 88%, black);
    color: #fbf6ea; text-align: center;
    /* Sized to the card: "AMBASSADOR", the longest name, fits on the smallest. */
    font-size: 12cqw; line-height: 1.15; letter-spacing: 0; text-transform: uppercase;
    white-space: nowrap;
  }
  .sm .name { padding: 2px 1px 1px; }

  .back {
    background: repeating-linear-gradient(45deg, var(--felt) 0 6px, var(--felt-deep) 6px 12px);
    border-color: var(--felt-deep);
  }
  .back::before { display: none; }
  .weave {
    position: absolute; inset: 5px;
    border: 1px solid color-mix(in srgb, var(--brass) 50%, transparent);
    border-radius: 5px;
  }
</style>
