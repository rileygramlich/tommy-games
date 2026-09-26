<script>
  import GameLog from '../../components/GameLog.svelte';
  import Curtain from '../../components/Curtain.svelte';
  import { SIZE, EMPTY, seatOf, isKing, isPlayable, square } from './engine.js';

  let { table, onexit } = $props();
  const v = $derived(table.view);
  const myTurn = $derived(!!v && v.turn === v.seat && v.phase === 'playing');
  const COLOURS = ['#c2412d', '#efe7d7'];

  // Checkers needs two clicks: pick a piece, then a destination. A chain in
  // progress picks the piece for you, which is also the rule — only the jumping
  // piece may continue.
  let picked = $state(null);
  const selected = $derived(v?.chainFrom ?? picked);

  const movable = $derived(new Set(v?.movable ?? []));
  const destinations = $derived(
    selected === null || !v ? new Map() : new Map(
      v.legal.filter((m) => m.from === selected).map((m) => [m.to, m])
    )
  );

  function status() {
    if (!v) return '';
    if (v.phase === 'gameOver') {
      return v.winners.length > 1 ? 'Drawn' : `${v.players[v.winners[0]].name} wins`;
    }
    if (v.chainFrom !== null && myTurn) return 'Keep jumping';
    return myTurn ? 'Your move' : `${v.players[v.turn].name} to move`;
  }

  function tap(index) {
    if (!myTurn) return;
    if (destinations.has(index)) {
      const move = destinations.get(index);
      picked = null;
      table.send({ type: 'move', from: move.from, to: move.to });
      return;
    }
    // Picking a different one of your own pieces just moves the selection,
    // unless a chain has already committed you to one.
    if (v.chainFrom === null && movable.has(index)) picked = picked === index ? null : index;
    else if (v.chainFrom === null) picked = null;
  }

  function label(index, cell) {
    const where = square(index);
    if (cell === EMPTY) return destinations.has(index) ? `Move to ${where}` : where;
    const who = v.players[seatOf(cell)].name;
    return `${where}, ${who}${isKing(cell) ? ' king' : ''}`;
  }
</script>

{#if v}
  <div class="stack">
    <header class="spread">
      <div class="row">
        <button class="btn ghost small" onclick={onexit}>← Leave</button>
        <div>
          <div class="title">Checkers</div>
          <div class="status">{status()}</div>
        </div>
      </div>
      <div class="row score">
        {#each v.players as p (p.seat)}
          <div class="tally" class:active={v.turn === p.seat && v.phase === 'playing'}>
            <span class="disc" style="background:{COLOURS[p.seat]}"></span>
            <span class="name">{p.name}</span>
            <span class="num count">{p.pieces}</span>
          </div>
        {/each}
      </div>
    </header>

    <div class="board felt">
      {#each v.board as cell, i (i)}
        {@const dark = isPlayable(i)}
        <button
          class="cell"
          class:dark
          class:light={!dark}
          class:pick={v.hints && selected === null && movable.has(i)}
          class:chosen={selected === i}
          class:target={destinations.has(i)}
          class:capture={destinations.get(i)?.captured !== undefined && destinations.get(i)?.captured !== -1}
          class:from={v.lastMove?.from === i}
          class:to={v.lastMove?.to === i}
          disabled={!dark || !myTurn || (!movable.has(i) && !destinations.has(i))}
          aria-label={label(i, cell)}
          onclick={() => tap(i)}
        >
          {#if cell !== EMPTY}
            <span class="piece" style="background:{COLOURS[seatOf(cell)]}">
              {#if isKing(cell)}<span class="crown" aria-hidden="true">♔</span>{/if}
            </span>
          {:else if destinations.has(i)}
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
        <div class="tag">Checkers</div>
        <h2>{v.winners.length > 1 ? 'A draw' : `${v.players[v.winners[0]].name} wins`}</h2>
        <p class="num big">{v.players[0].pieces} – {v.players[1].pieces}</p>
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
    gap: 0;
    padding: 10px;
    max-width: 520px;
    margin: 0 auto;
    width: 100%;
    aspect-ratio: 1;
  }
  .cell {
    position: relative;
    border: 0;
    display: grid;
    place-items: center;
    padding: 0;
    cursor: default;
  }
  .cell.light { background: color-mix(in srgb, var(--felt-line) 22%, transparent); }
  .cell.dark { background: color-mix(in srgb, var(--felt-line) 62%, transparent); }
  .cell:not(:disabled) { cursor: pointer; }
  .cell.pick .piece { box-shadow: 0 0 0 2px var(--brass-soft), 0 2px 4px rgba(0, 0, 0, 0.35); }
  .cell.chosen { background: color-mix(in srgb, var(--brass) 34%, transparent); }
  .cell.target:hover { background: color-mix(in srgb, var(--brass) 26%, transparent); }
  .cell.from { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--brass-soft) 60%, transparent); }
  .cell.to { box-shadow: inset 0 0 0 2px var(--brass-soft); }

  .piece {
    width: 74%; height: 74%; border-radius: 50%;
    border: 1px solid var(--card-edge);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
    display: grid; place-items: center;
    animation: settle 0.16s ease-out;
  }
  .crown { font-size: 0.9rem; line-height: 1; color: rgba(0, 0, 0, 0.55); }
  .dot { width: 26%; height: 26%; border-radius: 50%; background: color-mix(in srgb, var(--brass-soft) 70%, transparent); }
  /* A jump destination is worth distinguishing from a quiet step. */
  .cell.capture .dot { background: var(--brass); width: 34%; height: 34%; }
  @keyframes settle { from { transform: scale(0.82); } to { transform: scale(1); } }
  @media (prefers-reduced-motion: reduce) { .piece { animation: none; } }

  .log-panel summary { cursor: pointer; font-size: 0.85rem; color: var(--ink-soft); }
  .overlay {
    position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: 1rem;
    background: color-mix(in srgb, var(--felt-deep) 78%, transparent); backdrop-filter: blur(4px);
  }
  .sheet { max-width: 420px; width: 100%; display: grid; gap: 0.9rem; justify-items: center; }
  .big { font-size: 1.6rem; font-family: var(--serif); }

  @media (max-width: 640px) {
    .board { padding: 5px; }
    .score { gap: 0.4rem; }
    .overlay { padding: 0.6rem; }
    .sheet { max-height: 88dvh; overflow-y: auto; }
  }
</style>
