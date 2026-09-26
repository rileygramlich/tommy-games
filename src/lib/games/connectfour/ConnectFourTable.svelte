<script>
  import GameLog from '../../components/GameLog.svelte';
  import Curtain from '../../components/Curtain.svelte';
  import { COLS } from './engine.js';

  let { table, onexit } = $props();
  const v = $derived(table.view);
  const myTurn = $derived(!!v && v.turn === v.seat && v.phase === 'playing');
  const COLOURS = ['#c2412d', '#e5b93c'];

  // Which column the pointer is over, so the whole column highlights and a
  // ghost disc shows where gravity would take it.
  let hovered = $state(-1);

  function status() {
    if (!v) return '';
    if (v.phase === 'gameOver') {
      return v.winners.length > 1 ? 'Drawn' : `${v.players[v.winners[0]].name} wins`;
    }
    return myTurn ? 'Your move' : `${v.players[v.turn].name} to move`;
  }

  const playable = (col) => !!v && v.legal.includes(col);
  function drop(col) {
    if (!playable(col)) return;
    hovered = -1;
    table.send({ type: 'drop', col });
  }
</script>

{#if v}
  <div class="stack">
    <header class="spread">
      <div class="row">
        <button class="btn ghost small" onclick={onexit}>← Leave</button>
        <div>
          <div class="title">Connect Four</div>
          <div class="status">{status()}</div>
        </div>
      </div>
      <div class="row score">
        {#each v.players as p (p.seat)}
          <div class="tally" class:active={v.turn === p.seat && v.phase === 'playing'}>
            <span class="disc" style="background:{COLOURS[p.seat]}"></span>
            <span class="name">{p.name}</span>
          </div>
        {/each}
      </div>
    </header>

    <div class="board felt" style="--cols:{COLS}">
      {#each v.board as cell, i (i)}
        {@const col = i % COLS}
        <button
          class="cell"
          class:open={playable(col)}
          class:aimed={hovered === col && playable(col)}
          class:win={v.line.includes(i)}
          disabled={!playable(col)}
          aria-label={`Column ${col + 1}${cell === -1 ? ', empty' : cell === 0 ? ', red' : ', yellow'}`}
          onclick={() => drop(col)}
          onpointerenter={() => (hovered = col)}
          onpointerleave={() => (hovered = hovered === col ? -1 : hovered)}
          onfocus={() => (hovered = col)}
          onblur={() => (hovered = hovered === col ? -1 : hovered)}
        >
          <span class="slot">
            {#if cell !== -1}
              <span
                class="disc placed"
                class:last={v.lastMove === i}
                style="background:{COLOURS[cell]}"
              ></span>
            {:else if v.hints && hovered === col && v.landing[col] === Math.floor(i / COLS) && myTurn}
              <span class="disc ghost" style="background:{COLOURS[v.seat]}"></span>
            {/if}
          </span>
        </button>
      {/each}
    </div>

    {#if table.thinking}<div class="tiny muted center">thinking…</div>{/if}

    <details class="panel log-panel">
      <summary>Moves</summary>
      <GameLog log={v.log} />
    </details>
  </div>

  {#if v.phase === 'gameOver'}
    <div class="overlay fade-in">
      <div class="panel sheet center">
        <div class="tag">Connect Four</div>
        <h2>{v.winners.length > 1 ? 'A draw' : `${v.players[v.winners[0]].name} wins`}</h2>
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
  .score { gap: 0.8rem; }
  .tally {
    display: flex; align-items: center; gap: 0.4rem;
    padding: 0.3rem 0.6rem; border-radius: 999px; border: 1px solid transparent;
  }
  .tally.active { border-color: var(--brass); background: color-mix(in srgb, var(--brass) 14%, transparent); }
  .tally .disc { width: 14px; height: 14px; border-radius: 50%; border: 1px solid var(--card-edge); }

  .board {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 4px;
    padding: 10px;
    max-width: 520px;
    margin: 0 auto;
    width: 100%;
    aspect-ratio: 7 / 6;
  }
  .cell {
    position: relative;
    border: 0;
    border-radius: 6px;
    background: color-mix(in srgb, var(--felt-line) 55%, transparent);
    display: grid;
    place-items: center;
    padding: 0;
    cursor: default;
  }
  .cell.open { cursor: pointer; }
  .cell.aimed { background: color-mix(in srgb, var(--brass) 26%, transparent); }
  .cell.win { box-shadow: inset 0 0 0 2px var(--brass); }
  /* The hole the disc sits in, so an empty cell still reads as a slot. */
  .slot {
    width: 82%; height: 82%; border-radius: 50%;
    background: color-mix(in srgb, var(--felt-deep) 55%, transparent);
    display: grid; place-items: center;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
  }
  .disc.placed {
    width: 100%; height: 100%; border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
    animation: fall 0.22s cubic-bezier(0.4, 0.8, 0.5, 1);
  }
  .disc.placed.last { outline: 2px solid var(--brass-soft); outline-offset: -2px; }
  .disc.ghost { width: 100%; height: 100%; border-radius: 50%; opacity: 0.28; }
  @keyframes fall {
    from { transform: translateY(-260%); }
    to { transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .disc.placed { animation: none; }
  }

  .log-panel summary { cursor: pointer; font-size: 0.85rem; color: var(--ink-soft); }
  .overlay {
    position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: 1rem;
    background: color-mix(in srgb, var(--felt-deep) 78%, transparent); backdrop-filter: blur(4px);
  }
  .sheet { max-width: 420px; width: 100%; display: grid; gap: 0.9rem; justify-items: center; }

  @media (max-width: 640px) {
    .board { padding: 5px; gap: 2px; }
    .score { gap: 0.4rem; }
    .overlay { padding: 0.6rem; }
    .sheet { max-height: 88dvh; overflow-y: auto; }
  }
</style>
