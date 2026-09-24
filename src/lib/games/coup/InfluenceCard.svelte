<script>
  import { CHARACTERS } from './characters.js';
  import CharacterFace from './CharacterFace.svelte';
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
    <span class="portrait"><CharacterFace character={spec.key} /></span>
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
  .inf::before {
    content: '';
    position: absolute; inset: 4px 4px auto 4px; height: 4px;
    border-radius: 2px;
    background: var(--ink-colour, var(--ink-faint));
  }
  .inf.sm { width: clamp(38px, 10vw, 46px); height: clamp(52px, 14vw, 64px); }
  .inf.lg { width: clamp(64px, 17vw, 82px); height: clamp(88px, 23.5vw, 114px); }
  button.inf { cursor: pointer; }
  button.inf:hover { transform: translateY(-4px); box-shadow: var(--shadow-2); }
  .inf.selected { transform: translateY(-6px); box-shadow: 0 0 0 2px var(--brass), var(--shadow-2); }
  .inf.dimmed { filter: grayscale(0.5) brightness(0.9); opacity: 0.7; }
  .inf.dead { filter: grayscale(0.85); opacity: 0.55; transform: rotate(-3deg); }

  .portrait { display: block; width: 72%; margin-top: 7px; }
  .sm .portrait { width: 78%; margin-top: 4px; }
  .lg .portrait { width: 70%; margin-top: 9px; }
  .name {
    /* "Ambassador" has to fit the same card as "Duke". */
    font-size: 0.5rem; letter-spacing: 0.01em; text-transform: uppercase;
    color: color-mix(in srgb, var(--ink-colour, #23201c) 75%, #6b6153);
    padding: 0 3px; text-align: center; max-width: 100%;
  }
  .sm .name { font-size: 0.4rem; }
  .lg .name { font-size: 0.56rem; letter-spacing: 0.03em; }

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
