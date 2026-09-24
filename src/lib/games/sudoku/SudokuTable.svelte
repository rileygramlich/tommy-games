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

  const rowOf = (i) => Math.floor(i / 9);
  const colOf = (i) => i % 9;
  const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

  function related(index) {
    if (selected == null || index === selected) return false;
    return rowOf(index) === rowOf(selected) || colOf(index) === colOf(selected) || boxOf(index) === boxOf(selected);
  }

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
    const row = Math.min(8, Math.max(0, rowOf(selected) + dRow));
    const col = Math.min(8, Math.max(0, colOf(selected) + dCol));
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
  <!-- Sudoku sets its own black-on-white palette rather than taking the felt
       table with it: a printed puzzle, readable across the room. -->
  <div class="sudoku" class:solved={v.solved}>
    <header class="head">
      <button class="plain" onclick={onexit}>← Leave</button>
      <div class="titles">
        <div class="title">Sudoku <span class="level">{v.difficultyName}</span></div>
        <div class="status">
          {v.solved ? 'Solved — every square is right' : `${v.empty} ${v.empty === 1 ? 'square' : 'squares'} to go`}
        </div>
      </div>
      <div class="no-lives">No lives</div>
    </header>

    <div class="gridwrap">
      <div class="grid" class:win={v.solved} role="grid" aria-label="Sudoku grid">
        {#each v.cells as cell (cell.index)}
          <button
            class="cell"
            style={`--i:${cell.index}`}
            class:given={cell.given}
            class:conflict={cell.conflict}
            class:selected={selected === cell.index}
            class:related={related(cell.index)}
            class:match={highlight > 0 && cell.value === highlight && selected !== cell.index}
            class:rline={colOf(cell.index) % 3 === 2 && colOf(cell.index) !== 8}
            class:bline={rowOf(cell.index) % 3 === 2 && rowOf(cell.index) !== 8}
            onclick={() => tapCell(cell.index)}
            aria-label={`Row ${rowOf(cell.index) + 1}, column ${colOf(cell.index) + 1}${cell.value ? `, ${cell.value}` : ', empty'}`}
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
    </div>

    <div class="pad">
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

      <div class="tools">
        <button class="tool" class:on={pencil} onclick={() => (pencil = !pencil)}>
          Pencil marks {pencil ? 'on' : 'off'}
        </button>
        <button class="tool" disabled={v.solved || selected == null || selectedCell?.given} onclick={erase}>
          Erase
        </button>
        {#if table.error}<span class="err">{table.error}</span>{/if}
      </div>

      <p class="hint">Tap a square, then a number. A wrong number costs nothing — squares that clash turn red.</p>
    </div>

    <details class="log">
      <summary>This grid</summary>
      <GameLog log={v.log} />
    </details>
  </div>

  {#if v.solved}
    <div class="overlay">
      <div class="result">
        <svg class="tick" viewBox="0 0 64 64" aria-hidden="true">
          <circle class="tick-ring" cx="32" cy="32" r="28" />
          <path class="tick-mark" d="M18 33l10 10 18-20" />
        </svg>
        <h2>Solved</h2>
        <p class="result-sub">{v.difficultyName} grid · {v.placed} numbers written in</p>
        <button class="tool strong" onclick={onexit}>Back to the shelf</button>
      </div>
    </div>
  {/if}
{/if}

<style>
  /* One local palette, deliberately independent of the site theme. */
  .sudoku {
    --paper: #ffffff;
    --line: #111111;
    --line-soft: #c8c8c8;
    --ink: #111111;
    --ink-soft: #555555;
    --pen: #1b4f8f;
    --wrong: #c62828;
    --won: #1b7f4c;
    --pick: #ffe9a8;

    display: grid;
    gap: 0.9rem;
    padding: 1rem clamp(0.6rem, 2vw, 1.2rem) 1.2rem;
    background: var(--paper);
    color: var(--ink);
    border: 1px solid var(--line-soft);
    border-radius: 12px;
    font-family: var(--sans);
  }

  .head { display: flex; align-items: flex-start; gap: 0.8rem; }
  .titles { flex: 1; }
  .title { font-family: var(--serif); font-size: 1.3rem; color: var(--ink); }
  .level { font-size: 0.95rem; color: var(--ink-soft); }
  .status { font-size: 1rem; color: var(--ink-soft); }
  .no-lives {
    font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--ink-soft); border: 1px solid var(--line-soft);
    border-radius: 999px; padding: 0.25em 0.7em; white-space: nowrap;
  }
  .plain {
    background: none; border: 0; padding: 0.2rem 0.1rem;
    color: var(--ink-soft); font-size: 0.9rem; cursor: pointer;
  }
  .plain:hover { color: var(--ink); }

  /* ---------------------------------------------------------------- grid */

  .gridwrap { display: grid; place-items: center; }
  .grid {
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    width: min(94vw, 540px);
    aspect-ratio: 1;
    background: var(--paper);
    /* The outer frame and the nine boxes are drawn heavy; the rest hairline. */
    border: 3px solid var(--line);
  }
  .cell {
    display: grid; place-items: center;
    background: var(--paper);
    border: 0;
    border-right: 1px solid var(--line-soft);
    border-bottom: 1px solid var(--line-soft);
    margin: 0; padding: 0;
    color: var(--pen);
    font-family: var(--tabular);
    font-variant-numeric: tabular-nums;
    font-size: clamp(1.15rem, 4.8vw, 2rem);
    cursor: pointer;
    transition: background 0.1s ease;
  }
  .cell:nth-child(9n) { border-right: 0; }
  .cell:nth-last-child(-n + 9) { border-bottom: 0; }
  .cell.rline { border-right: 3px solid var(--line); }
  .cell.bline { border-bottom: 3px solid var(--line); }

  .cell.given { color: var(--line); font-weight: 700; }
  .cell.related { background: #f2f2f2; }
  .cell.match { background: #e2e8f0; font-weight: 700; }
  .cell.selected { background: var(--pick); }
  .cell.conflict { color: var(--wrong); }
  .cell:focus-visible { outline: 2px solid var(--pen); outline-offset: -3px; }

  .digit { line-height: 1; }
  .notes {
    display: grid; grid-template-columns: repeat(3, 1fr);
    width: 100%; height: 100%; place-items: center;
    font-size: clamp(0.5rem, 1.6vw, 0.7rem); color: #8a8a8a;
  }
  .note { line-height: 1; }

  /* ---------------------------------------------------------------- pad */

  .pad { display: grid; gap: 0.6rem; justify-items: center; }
  .keys { display: grid; grid-template-columns: repeat(9, 1fr); gap: 0.3rem; width: min(94vw, 540px); }
  .key {
    position: relative;
    display: grid; place-items: center;
    aspect-ratio: 3 / 4;
    border: 2px solid var(--line);
    border-radius: 6px;
    background: var(--paper);
    color: var(--line);
    font-family: var(--tabular);
    font-size: clamp(1.1rem, 4.2vw, 1.6rem);
    font-weight: 700;
    cursor: pointer;
  }
  .key:disabled { border-color: var(--line-soft); color: var(--line-soft); cursor: default; }
  .key:not(:disabled):hover { background: var(--pick); }
  .key.done { opacity: 0.4; }
  .key-left { position: absolute; bottom: 1px; font-size: 0.6rem; font-weight: 400; color: var(--ink-soft); }

  .tools { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; justify-content: center; }
  .tool {
    border: 2px solid var(--line); border-radius: 999px;
    background: var(--paper); color: var(--line);
    padding: 0.45em 1.1em; font-size: 0.92rem; font-weight: 600; cursor: pointer;
  }
  .tool:disabled { border-color: var(--line-soft); color: var(--line-soft); cursor: default; }
  .tool.on { background: var(--line); color: var(--paper); }
  .tool.strong { background: var(--won); border-color: var(--won); color: #fff; }
  .err { color: var(--wrong); font-size: 0.85rem; }
  .hint { font-size: 0.85rem; color: var(--ink-soft); margin: 0; text-align: center; max-width: 34rem; }

  .log { color: var(--ink-soft); }
  .log summary { cursor: pointer; font-size: 0.85rem; }

  /* ---------------------------------------------------------------- win */

  /* Every square lights green in turn, sweeping across the grid. */
  .grid.win .cell {
    animation: light 1.1s ease both;
    animation-delay: calc(var(--i) * 12ms);
  }
  @keyframes light {
    0% { background: var(--paper); }
    35% { background: #c9f0d8; color: var(--won); }
    100% { background: var(--paper); color: inherit; }
  }
  .sudoku.solved .cell.given { color: var(--line); }
  .sudoku.solved .cell:not(.given) { color: var(--won); }

  .overlay {
    position: fixed; inset: 0; z-index: 30;
    display: grid; place-items: center; padding: 1rem;
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(3px);
    animation: fade 0.5s ease both;
    animation-delay: 0.7s;
  }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  .result {
    display: grid; gap: 0.6rem; justify-items: center; text-align: center;
    background: #fff; color: #111;
    border: 3px solid #111; border-radius: 14px;
    padding: 1.6rem 2rem; max-width: 380px; width: 100%;
  }
  .result h2 { font-size: 1.8rem; }
  .result-sub { font-size: 0.9rem; color: #555; margin: 0; }

  .tick { width: 84px; height: 84px; }
  .tick-ring, .tick-mark { fill: none; stroke: var(--won); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
  .tick-ring { stroke-dasharray: 176; stroke-dashoffset: 176; animation: draw 0.6s ease forwards 0.8s; }
  .tick-mark { stroke-dasharray: 48; stroke-dashoffset: 48; animation: draw 0.4s ease forwards 1.3s; }
  @keyframes draw { to { stroke-dashoffset: 0; } }

  @media (max-width: 640px) {
    .no-lives { display: none; }
    .sudoku { padding: 0.7rem 0.5rem 1rem; gap: 0.7rem; }
    .keys { gap: 0.2rem; }
  }
</style>
