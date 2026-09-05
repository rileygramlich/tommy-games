<script>
  import GameLog from '../../components/GameLog.svelte';
  import Curtain from '../../components/Curtain.svelte';
  import { square } from './engine.js';

  let { table, onexit } = $props();
  const v = $derived(table.view);
  const myTurn = $derived(!!v && v.turn === v.seat && v.phase === 'playing');
  const COLOURS = ['#23201c', '#f7f1e5'];

  function status() {
    if (!v) return '';
    if (v.phase === 'gameOver') {
      return v.winners.length > 1 ? 'Drawn' : `${v.players[v.winners[0]].name} wins`;
    }
    return myTurn ? 'Your move' : `${v.players[v.turn].name} to move`;
  }
</script>

{#if v}
  <div class="stack">
    <header class="spread">
      <div class="row">
        <button class="btn ghost small" onclick={onexit}>← Leave</button>
        <div>
          <div class="title">Reversi</div>
          <div class="status">{status()}</div>
        </div>
      </div>
      <div class="row score">
        {#each v.players as p (p.seat)}
          <div class="tally" class:active={v.turn === p.seat && v.phase === 'playing'}>
            <span class="disc" style="background:{COLOURS[p.seat]}"></span>
            <span class="name">{p.name}</span>
            <span class="num count">{p.discs}</span>
          </div>
        {/each}
      </div>
    </header>

    <div class="board felt">
      {#each v.board as cell, i (i)}
        <button
          class="cell"
          class:legal={v.legal.includes(i)}
          class:last={v.lastMove === i}
          disabled={!v.legal.includes(i)}
          aria-label={`${square(i)}${cell === -1 ? '' : cell === 0 ? ', dark' : ', light'}`}
          onclick={() => table.send({ type: 'place', index: i })}
        >
          {#if cell !== -1}
            <span class="disc placed" class:flipped={v.lastFlips.includes(i)} style="background:{COLOURS[cell]}"></span>
          {:else if v.legal.includes(i) && v.hints}
            <span class="dot"></span>
          {/if}
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
        <div class="tag">Reversi</div>
        <h2>{v.winners.length > 1 ? 'A draw' : `${v.players[v.winners[0]].name} wins`}</h2>
        <p class="num big">{v.players[0].discs} – {v.players[1].discs}</p>
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
  .count { font-weight: 700; }

  .board {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 2px;
    padding: 10px;
    max-width: 520px;
    margin: 0 auto;
    width: 100%;
    aspect-ratio: 1;
  }
  .cell {
    position: relative;
    border: 0;
    border-radius: 3px;
    background: color-mix(in srgb, var(--felt-line) 55%, transparent);
    display: grid;
    place-items: center;
    padding: 0;
    cursor: default;
  }
  .cell.legal { cursor: pointer; }
  .cell.legal:hover { background: color-mix(in srgb, var(--brass) 35%, transparent); }
  .cell.last { box-shadow: inset 0 0 0 2px var(--brass-soft); }
  .disc.placed {
    width: 78%; height: 78%; border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
    animation: drop 0.18s ease-out;
  }
  .disc.flipped { animation: flip 0.3s ease-out; }
  @keyframes drop { from { transform: scale(0.4); opacity: 0.4; } to { transform: scale(1); opacity: 1; } }
  @keyframes flip { from { transform: scaleX(0.05); } to { transform: scaleX(1); } }
  .dot { width: 22%; height: 22%; border-radius: 50%; background: color-mix(in srgb, var(--brass-soft) 60%, transparent); }

  .log-panel summary { cursor: pointer; font-size: 0.85rem; color: var(--ink-soft); }
  .overlay {
    position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: 1rem;
    background: color-mix(in srgb, var(--felt-deep) 78%, transparent); backdrop-filter: blur(4px);
  }
  .sheet { max-width: 420px; width: 100%; display: grid; gap: 0.9rem; justify-items: center; }
  .big { font-size: 1.6rem; font-family: var(--serif); }

  @media (max-width: 640px) {
    .board { padding: 5px; gap: 1px; }
    .score { gap: 0.4rem; }
    .overlay { padding: 0.6rem; }
    .sheet { max-height: 88dvh; overflow-y: auto; }
  }
</style>
