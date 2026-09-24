<script>
  import GameLog from '../../components/GameLog.svelte';

  let { table, onexit } = $props();
  const v = $derived(table.view);

  let selected = $state(null);
  let pencil = $state(false);

  const selectedCell = $derived(selected == null || !v ? null : v.cells[selected]);
  // Highlighting the same number across the grid is the single biggest help
  // when the numbers start swimming.
  const highlight = $derived(selectedCell?.value || 0);

  function tapCell(index) {
    selected = selected === index ? null : index;
  }

  function enter(value) {
    if (selected == null || !v) return;
    const cell = v.cells[selected];
    if (cell.given) return;
    if (pencil) {
      table.send({ type: 'note', index: selected, value });
      return;
    }
    // Tapping the number already in the square takes it out again.
    if (cell.value === value) table.send({ type: 'erase', index: selected });
    else table.send({ type: 'place', index: selected, value });
  }

  function erase() {
    if (selected == null) return;
    table.send({ type: 'erase', index: selected });
  }

  function move(dRow, dCol) {
    if (selected == null) { selected = 0; return; }
    const row = Math.min(8, Math.max(0, Math.floor(selected / 9) + dRow));
    const col = Math.min(8, Math.max(0, (selected % 9) + dCol));
    selected = row * 9 + col;
  }

  function onKey(event) {
    if (!v || v.solved) return;
    const key = event.key;
    if (key >= '1' && key <= '9') { enter(Number(key)); event.preventDefault(); return; }
    if (key === 'Backspace' || key === 'Delete' || key === '0') { erase(); event.preventDefault(); return; }
    if (key === 'ArrowUp') { move(-1, 0); event.preventDefault(); }
    else if (key === 'ArrowDown') { move(1, 0); event.preventDefault(); }
    else if (key === 'ArrowLeft') { move(0, -1); event.preventDefault(); }
    else if (key === 'ArrowRight') { move(0, 1); event.preventDefault(); }
    else if (key.toLowerCase() === 'n') pencil = !pencil;
  }
</script>

<svelte:window onkeydown={onKey} />

{#if v}
  <div class="stack">
    <header class="spread">
      <div class="row">
        <button class="btn ghost small" onclick={onexit}>← Leave</button>
        <div>
          <div class="title">Sudoku <span class="muted">· {v.difficultyName}</span></div>
          <div class="status">
            {v.solved ? 'Solved — the whole grid is right' : `${v.empty} ${v.empty === 1 ? 'square' : 'squares'} to go`}
          </div>
        </div>
      </div>
      <div class="tiny muted no-lives">No lives — it waits until you get it</div>
    </header>

    <section class="gridwrap">
      <div class="grid" role="grid" aria-label="Sudoku grid">
        {#each v.cells as cell (cell.index)}
          <button
            class="cell"
            class:given={cell.given}
            class:conflict={cell.conflict}
            class:selected={selected === cell.index}
            class:peer={selected != null && cell.index !== selected && (
              Math.floor(cell.index / 9) === Math.floor(selected / 9) ||
              cell.index % 9 === selected % 9 ||
              (Math.floor(Math.floor(cell.index / 9) / 3) * 3 + Math.floor((cell.index % 9) / 3)) ===
                (Math.floor(Math.floor(selected / 9) / 3) * 3 + Math.floor((selected % 9) / 3))
            )}
            class:match={highlight > 0 && cell.value === highlight}
            class:edge-r={cell.index % 9 === 2 || cell.index % 9 === 5}
            class:edge-b={Math.floor(cell.index / 9) === 2 || Math.floor(cell.index / 9) === 5}
            onclick={() => tapCell(cell.index)}
            aria-label={`Row ${Math.floor(cell.index / 9) + 1}, column ${(cell.index % 9) + 1}${cell.value ? `, ${cell.value}` : ', empty'}`}
          >
            {#if cell.value}
              <span class="digit">{cell.value}</span>
            {:else if cell.notes.length}
              <span class="notes">
                {#each cell.notes as note (note)}<span class="note">{note}</span>{/each}
              </span>
            {/if}
          </button>
        {/each}
      </div>
    </section>

    <section class="pad stack">
      <div class="keys">
        {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as n (n)}
          <button
            class="key"
            class:done={v.remaining[n - 1] <= 0}
            disabled={v.solved || selected == null || selectedCell?.given}
            onclick={() => enter(n)}
          >
            <span class="key-digit">{n}</span>
            <span class="key-left">{Math.max(0, v.remaining[n - 1])}</span>
          </button>
        {/each}
      </div>
      <div class="row wrap tools">
        <button class="btn" class:on={pencil} onclick={() => (pencil = !pencil)}>
          {pencil ? 'Pencil marks: on' : 'Pencil marks: off'}
        </button>
        <button class="btn ghost" disabled={v.solved || selected == null || selectedCell?.given} onclick={erase}>
          Erase
        </button>
        {#if table.error}<span class="tiny err">{table.error}</span>{/if}
      </div>
      <p class="tiny muted">
        Tap a square, then a number. A wrong number costs nothing — squares that clash turn red.
      </p>
    </section>

    <details class="panel log-panel">
      <summary>This grid</summary>
      <GameLog log={v.log} />
    </details>
  </div>

  {#if v.solved}
    <div class="overlay fade-in">
      <div class="panel result center">
        <div class="tag">Sudoku</div>
        <h2>Solved</h2>
        <p class="tiny muted">{v.difficultyName} grid · {v.placed} numbers written in</p>
        <button class="btn primary" onclick={onexit}>Back to the shelf</button>
      </div>
    </div>
  {/if}
{/if}

<style>
  .title { font-family: var(--serif); font-size: 1.15rem; }
  .status { font-size: 0.95rem; color: var(--ink-soft); }
  .tiny { font-size: 0.8rem; }
  .err { color: var(--rose); }
  .no-lives { text-align: right; max-width: 10rem; }

  .gridwrap { display: grid; place-items: center; }
  .grid {
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    width: min(92vw, 520px);
    aspect-ratio: 1;
    background: var(--card-edge);
    border: 3px solid var(--card-edge);
    border-radius: 8px;
    gap: 1px;
    overflow: hidden;
  }
  .cell {
    display: grid; place-items: center;
    background: var(--paper-2);
    border: 0; padding: 0; margin: 0;
    color: var(--brass);
    font-family: var(--tabular);
    font-size: clamp(1.1rem, 4.6vw, 1.9rem);
    cursor: pointer;
    transition: background 0.12s ease;
  }
  /* The heavy lines between the three-by-three boxes. */
  .cell.edge-r { box-shadow: 2px 0 0 0 var(--card-edge); }
  .cell.edge-b { box-shadow: 0 2px 0 0 var(--card-edge); }
  .cell.edge-r.edge-b { box-shadow: 2px 0 0 0 var(--card-edge), 0 2px 0 0 var(--card-edge); }

  .cell.given { color: var(--ink); font-weight: 700; background: color-mix(in srgb, var(--ink) 7%, var(--paper-2)); }
  .cell.peer { background: color-mix(in srgb, var(--brass) 9%, var(--paper-2)); }
  .cell.peer.given { background: color-mix(in srgb, var(--brass) 9%, color-mix(in srgb, var(--ink) 7%, var(--paper-2))); }
  .cell.match { background: color-mix(in srgb, var(--brass) 22%, var(--paper-2)); }
  .cell.selected { background: color-mix(in srgb, var(--brass) 34%, var(--paper-2)); box-shadow: inset 0 0 0 2px var(--brass); }
  .cell.conflict { color: var(--rose); }
  .cell.conflict.given { color: var(--rose); }

  .digit { line-height: 1; }
  .notes {
    display: grid; grid-template-columns: repeat(3, 1fr);
    width: 100%; height: 100%; place-items: center;
    font-size: clamp(0.5rem, 1.7vw, 0.72rem); color: var(--ink-faint);
  }
  .note { line-height: 1; }

  .pad { align-items: center; }
  .keys {
    display: grid; grid-template-columns: repeat(9, 1fr);
    gap: 0.35rem; width: min(92vw, 520px);
  }
  .key {
    position: relative;
    display: grid; place-items: center;
    aspect-ratio: 3 / 4;
    border: 1px solid var(--card-edge);
    border-radius: 8px;
    background: var(--paper-2);
    color: var(--ink);
    font-family: var(--tabular);
    font-size: clamp(1.1rem, 4.2vw, 1.6rem);
    cursor: pointer;
  }
  .key:disabled { opacity: 0.4; cursor: default; }
  .key:not(:disabled):hover { background: color-mix(in srgb, var(--brass) 18%, var(--paper-2)); }
  .key.done { opacity: 0.35; }
  .key-digit { line-height: 1; }
  .key-left { position: absolute; bottom: 2px; font-size: 0.6rem; color: var(--ink-faint); }

  .tools .on { background: var(--felt); color: #f2e9d6; border-color: var(--felt-deep); }

  .log-panel summary { cursor: pointer; font-size: 0.85rem; color: var(--ink-soft); }
  .overlay {
    position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: 1rem;
    background: color-mix(in srgb, var(--felt-deep) 78%, transparent); backdrop-filter: blur(4px);
  }
  .result { max-width: 420px; width: 100%; display: grid; gap: 0.9rem; justify-items: center; text-align: center; }

  @media (max-width: 640px) {
    .no-lives { display: none; }
    .keys { gap: 0.25rem; }
  }
</style>
