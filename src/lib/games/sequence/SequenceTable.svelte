<script>
  import PlayingCard from '../../components/PlayingCard.svelte';
  import GameLog from '../../components/GameLog.svelte';
  import Curtain from '../../components/Curtain.svelte';
  import { SUIT_SYMBOLS, RANK_LABELS } from '../cards.js';
  import { isCorner, isWildJack, isRemoveJack, squaresFor } from './board.js';

  let { table, onexit } = $props();
  const v = $derived(table.view);
  const myTurn = $derived(!!v && v.turn === v.seat && v.phase === 'playing');

  let picked = $state(null);
  const pickedCard = $derived(v && picked ? v.hand.find((c) => c.id === picked) : null);

  // Squares the selected card can act on.
  const targets = $derived.by(() => {
    if (!v || !pickedCard || !myTurn) return new Set();
    if (isWildJack(pickedCard)) {
      return new Set(v.chips.map((c, i) => (c == null && !isCorner(i) ? i : -1)).filter((i) => i >= 0));
    }
    if (isRemoveJack(pickedCard)) {
      return new Set(v.chips.map((c, i) => (c != null && c !== v.seat && !v.locked.includes(i) ? i : -1)).filter((i) => i >= 0));
    }
    return new Set(squaresFor(pickedCard).filter((i) => v.chips[i] == null));
  });

  const sequenceCells = $derived(new Set(v ? v.sequences.flatMap((s) => s.cells) : []));

  function tap(index) {
    if (!myTurn || !pickedCard || !targets.has(index)) return;
    const type = isRemoveJack(pickedCard) ? 'remove' : 'play';
    table.send({ type, cardId: pickedCard.id, index });
    picked = null;
  }

  function status() {
    if (!v) return '';
    if (v.phase === 'gameOver') return v.winners.length ? `${v.players[v.winners[0]].name} wins` : 'Drawn — the board is stuck';
    if (!myTurn) return `${v.players[v.turn].name} is thinking`;
    if (!pickedCard) return 'Pick a card';
    if (isRemoveJack(pickedCard)) return 'One-eyed jack — take a chip off';
    if (isWildJack(pickedCard)) return 'Two-eyed jack — play it anywhere';
    return 'Now tap its square';
  }
</script>

{#if v}
  <div class="stack">
    <header class="spread">
      <div class="row">
        <button class="btn ghost small" onclick={onexit}>← Leave</button>
        <div>
          <div class="title">Sequence</div>
          <div class="status">{status()}</div>
        </div>
      </div>
      <div class="row players">
        {#each v.players as p (p.seat)}
          <div class="who" class:active={v.turn === p.seat && v.phase === 'playing'}>
            <span class="chip" style="background:{p.colour}"></span>
            <span class="tiny">{p.name}</span>
            <span class="num tiny">{p.sequences}/{v.needed}</span>
          </div>
        {/each}
      </div>
    </header>

    <div class="board felt">
      {#each v.board as cell, i (i)}
        <button
          class="cell"
          class:corner={isCorner(i)}
          class:target={targets.has(i)}
          class:seq={sequenceCells.has(i)}
          class:last={v.lastMove?.index === i}
          class:red={cell && (cell.suit === 'H' || cell.suit === 'D')}
          disabled={!targets.has(i)}
          aria-label={isCorner(i) ? 'Free corner' : `${RANK_LABELS[cell.rank]} of ${cell.suit}`}
          onclick={() => tap(i)}
        >
          {#if isCorner(i)}
            <span class="free">★</span>
          {:else}
            <span class="face"><b>{RANK_LABELS[cell.rank]}</b>{SUIT_SYMBOLS[cell.suit]}</span>
          {/if}
          {#if v.chips[i] != null}
            <span class="chip placed" style="background:{v.players[v.chips[i]].colour}"></span>
          {/if}
        </button>
      {/each}
    </div>

    <section class="you stack">
      <div class="spread">
        <div class="row">
          <strong>{v.players[v.seat].name}</strong>
          <span class="tiny muted">{v.drawPile} cards left in the deck</span>
        </div>
        {#if table.error}<span class="err tiny">{table.error}</span>{/if}
      </div>
      <div class="hand">
        {#each v.hand as card (card.id)}
          <PlayingCard
            {card}
            playable={myTurn}
            selected={picked === card.id}
            dimmed={v.dead.includes(card.id)}
            onclick={() => (picked = picked === card.id ? null : card.id)}
          />
        {/each}
      </div>
      <div class="row wrap">
        {#if myTurn && pickedCard && v.dead.includes(pickedCard.id) && !v.exchanged}
          <button class="btn small" onclick={() => { table.send({ type: 'exchange', cardId: pickedCard.id }); picked = null; }}>
            Swap this dead card
          </button>
        {/if}
        {#if myTurn && !targets.size && pickedCard && !v.dead.includes(pickedCard.id)}
          <span class="tiny muted">No square open for that one.</span>
        {/if}
        {#if table.thinking}<span class="tiny muted">thinking…</span>{/if}
      </div>
    </section>

    <details class="panel log-panel">
      <summary>Table talk</summary>
      <GameLog log={v.log} />
    </details>
  </div>

  {#if v.phase === 'gameOver'}
    <div class="overlay fade-in">
      <div class="panel result center">
        <div class="tag">Sequence</div>
        <h2>{v.winners.length ? `${v.players[v.winners[0]].name} wins` : 'A dead board'}</h2>
        <button class="btn primary" onclick={onexit}>Back to the shelf</button>
      </div>
    </div>
  {/if}

  {#if table.curtain}<Curtain name={table.curtain.name} onreveal={() => table.reveal()} />{/if}
{/if}

<style>
  .title { font-family: var(--serif); font-size: 1.15rem; }
  .status { font-size: 0.85rem; color: var(--ink-soft); }
  .tiny { font-size: 0.75rem; }
  .err { color: var(--rose); }
  .players { gap: 0.6rem; flex-wrap: wrap; }
  .who { display: flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.5rem; border-radius: 999px; border: 1px solid transparent; }
  .who.active { border-color: var(--brass); background: color-mix(in srgb, var(--brass) 14%, transparent); }
  .chip { width: 13px; height: 13px; border-radius: 50%; border: 1px solid rgba(0, 0, 0, 0.3); }

  .board {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 2px;
    padding: 8px;
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    aspect-ratio: 1;
  }
  .cell {
    position: relative;
    display: grid; place-items: center;
    border: 0; border-radius: 3px; padding: 0;
    background: var(--card-face);
    color: #23201c;
    font-family: var(--serif);
    font-size: clamp(0.5rem, 1.5vw, 0.72rem);
    cursor: default;
    overflow: hidden;
  }
  .cell.red { color: var(--rose); }
  .cell.corner { background: linear-gradient(160deg, var(--brass-soft), var(--brass)); color: #2b2110; }
  .cell.target { cursor: pointer; box-shadow: inset 0 0 0 2px var(--brass); }
  .cell.target:hover { background: color-mix(in srgb, var(--brass) 30%, var(--card-face)); }
  .cell.last { outline: 2px solid var(--brass-soft); outline-offset: -2px; }
  .face { display: flex; align-items: baseline; gap: 1px; }
  .free { font-size: 1rem; }
  .chip.placed {
    position: absolute;
    width: 68%; height: 68%; border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), inset 0 -2px 3px rgba(0, 0, 0, 0.25);
    animation: drop 0.18s ease-out;
  }
  .cell.seq .chip.placed { box-shadow: 0 0 0 2px var(--brass-soft), 0 1px 3px rgba(0, 0, 0, 0.4); }
  @keyframes drop { from { transform: scale(0.3); opacity: 0.3; } to { transform: scale(1); opacity: 1; } }

  .hand { display: flex; gap: 0.4rem; flex-wrap: wrap; min-height: 92px; align-items: flex-end; }
  .log-panel summary { cursor: pointer; font-size: 0.85rem; color: var(--ink-soft); }
  .overlay {
    position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: 1rem;
    background: color-mix(in srgb, var(--felt-deep) 78%, transparent); backdrop-filter: blur(4px);
  }
  .result { max-width: 400px; width: 100%; display: grid; gap: 0.9rem; justify-items: center; }

  @media (max-width: 640px) {
    .board { padding: 4px; gap: 1px; }
    .cell { border-radius: 2px; }
    .hand { min-height: 0; gap: 0.25rem; }
    .players { gap: 0.35rem; }
    .overlay { padding: 0.6rem; }
    .result { max-height: 88dvh; overflow-y: auto; }
  }
</style>
