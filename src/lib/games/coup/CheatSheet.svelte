<script>
  // The reference card from the box: what each character in this game does,
  // what it blocks, and the moves anyone may make. Built from the game's own
  // character list, so it always matches the set and options being played.
  import InfluenceCard from './InfluenceCard.svelte';
  import { CHARACTERS } from './characters.js';

  let { characters = [], factions = false } = $props();

  const DOES = {
    tax: 'Take 3 coins.',
    assassinate: 'Pay 3 coins: a player loses an influence.',
    steal: 'Take 2 coins from a player.',
    exchange: 'Draw 2 cards, keep the ones you want, put the rest back.',
    interrogate: "Look at one of a player's cards; you may make them swap it.",
    embezzle: 'Take every coin in the reserve.'
  };
  const BLOCKS = { foreignAid: 'Foreign aid', steal: 'Stealing', assassinate: 'Assassination' };

  const rows = $derived(characters.map((key) => CHARACTERS[key]).filter(Boolean));
</script>

<div class="cheat">
  <div class="grid" role="table" aria-label="What each character does">
    <div class="head" role="row">
      <span role="columnheader">Card</span>
      <span role="columnheader">Action</span>
      <span role="columnheader">Blocks</span>
    </div>
    {#each rows as c (c.key)}
      <div class="row" role="row">
        <span class="who" role="cell"><InfluenceCard character={c.key} size="sm" /></span>
        <span role="cell">
          {#if c.action}
            <strong>{c.action === 'tax' ? 'Tax' : c.action[0].toUpperCase() + c.action.slice(1)}.</strong>
            {DOES[c.action]}
            {#if c.action === 'embezzle' && !factions}<em class="muted"> Factions only.</em>{/if}
          {:else}
            <span class="muted">No action.</span>
          {/if}
        </span>
        <span role="cell" class="blocks">
          <span class="label">Blocks</span>{' '}
          {#if c.blocks.length}{c.blocks.map((b) => BLOCKS[b]).join(', ')}{:else}<span class="muted">—</span>{/if}
        </span>
      </div>
    {/each}
  </div>

  <div class="grid general" role="table" aria-label="Moves anyone can make">
    <div class="head" role="row">
      <span role="columnheader">Anyone</span>
      <span role="columnheader">Action</span>
      <span role="columnheader">Blocked by</span>
    </div>
    <div class="row" role="row">
      <strong role="cell">Income</strong><span role="cell">Take 1 coin.</span><span role="cell" class="blocks muted"><span class="label">Blocked by</span>{' '}—</span>
    </div>
    <div class="row" role="row">
      <strong role="cell">Foreign aid</strong><span role="cell">Take 2 coins.</span>
      <span role="cell" class="blocks"><span class="label">Blocked by</span>{' '}{rows.some((c) => c.blocks.includes('foreignAid')) ? rows.filter((c) => c.blocks.includes('foreignAid')).map((c) => c.name).join(', ') : '—'}</span>
    </div>
    <div class="row" role="row">
      <strong role="cell">Coup</strong>
      <span role="cell">Pay 7 coins: a player loses an influence. With 10 or more coins you must.</span>
      <span role="cell" class="blocks muted"><span class="label">Blocked by</span>{' '}nobody</span>
    </div>
    {#if factions}
      <div class="row" role="row">
        <strong role="cell">Convert</strong>
        <span role="cell">Pay 1 to change your own faction, or 2 to change another player's. The coins go to the reserve.</span>
        <span role="cell" class="blocks muted"><span class="label">Blocked by</span>{' '}—</span>
      </div>
    {/if}
  </div>

  <p class="tiny muted">
    Anyone can claim any character, whatever they hold. Doubt a claim and challenge it: whoever
    is wrong loses an influence.
  </p>
</div>

<style>
  .cheat { display: grid; gap: 0.9rem; container-type: inline-size; }
  .grid { display: grid; font-size: 0.82rem; line-height: 1.35; }
  .head, .row {
    display: grid;
    /* Fixed widths: each row is its own grid, so the columns only line up if
       they do not size themselves to their content. */
    grid-template-columns: 3.2rem 1fr 5.6rem;
    gap: 0.6rem;
    align-items: center;
    padding: 0.45rem 0;
  }
  .general .head, .general .row { grid-template-columns: 5.6rem 1fr 5.6rem; }
  .head {
    font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--ink-faint); padding-top: 0;
  }
  .row { border-top: 1px solid color-mix(in srgb, var(--ink-faint) 25%, transparent); }
  .who { display: flex; }
  .label { display: none; }

  /* A phone held upright: no room for a third column ("Assassination" ran
     past the panel's edge at 320px). What a card blocks goes under its action. */
  @container (max-width: 330px) {
    .head, .row, .general .head, .general .row { grid-template-columns: 2.9rem 1fr; row-gap: 0.15rem; }
    .general .head, .general .row { grid-template-columns: 5.2rem 1fr; }
    .head span:last-child { display: none; }
    .blocks { grid-column: 2; font-size: 0.76rem; color: var(--ink-soft); }
    .blocks.muted { color: var(--ink-faint); }
    .label { display: inline; color: var(--ink-faint); }
    .who { grid-row: span 2; }
  }
  .muted { color: var(--ink-faint); }
  .tiny { font-size: 0.74rem; }
</style>
