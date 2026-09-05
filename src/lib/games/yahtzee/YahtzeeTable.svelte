<script>
  import GameLog from '../../components/GameLog.svelte';
  import Curtain from '../../components/Curtain.svelte';
  import { CATEGORIES, UPPER, CATEGORY_LABELS, scoreFor } from './engine.js';

  let { table, onexit } = $props();
  const v = $derived(table.view);
  const myTurn = $derived(!!v && v.turn === v.seat && v.phase === 'rolling');
  const rolled = $derived(!!v && v.rollsLeft < 3);
  const PIPS = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [28, 72], [72, 28], [72, 72]],
    5: [[28, 28], [28, 72], [50, 50], [72, 28], [72, 72]],
    6: [[28, 25], [28, 50], [28, 75], [72, 25], [72, 50], [72, 75]]
  };

  function preview(category) {
    if (!rolled) return null;
    return scoreFor(category, v.dice, v.joker && !UPPER.includes(category));
  }
  function status() {
    if (!v) return '';
    if (v.phase === 'gameOver') return 'Game over';
    if (!myTurn) return `${v.players[v.turn].name} is rolling`;
    if (v.rollsLeft === 3) return 'Roll the dice';
    if (v.rollsLeft === 0) return 'Pick a box';
    return `Hold what you want, ${v.rollsLeft} roll${v.rollsLeft > 1 ? 's' : ''} left`;
  }
</script>

{#if v}
  <div class="stack">
    <header class="spread">
      <div class="row">
        <button class="btn ghost small" onclick={onexit}>← Leave</button>
        <div>
          <div class="title">Round {v.round} <span class="muted">of {v.rounds}</span></div>
          <div class="status">{status()}</div>
        </div>
      </div>
      {#if v.joker}<span class="tag">Bonus Yahtzee</span>{/if}
    </header>

    <section class="felt tray">
      <div class="dice">
        {#each v.dice as die, i (i)}
          <button
            class="die"
            class:held={v.held[i]}
            class:blank={die === 0}
            disabled={!myTurn || !rolled}
            aria-label={`Die showing ${die}${v.held[i] ? ', held' : ''}`}
            onclick={() => table.send({ type: 'hold', index: i })}
          >
            {#if die > 0}
              <svg viewBox="0 0 100 100" aria-hidden="true">
                {#each PIPS[die] as [cx, cy], p (p)}<circle {cx} {cy} r="9" />{/each}
              </svg>
            {/if}
            {#if v.held[i]}<span class="hold-tag">held</span>{/if}
          </button>
        {/each}
      </div>
      <div class="row rollrow">
        <button class="btn brass" disabled={!myTurn || v.rollsLeft === 0} onclick={() => table.send({ type: 'roll' })}>
          {v.rollsLeft === 3 ? 'Roll' : `Roll again (${v.rollsLeft})`}
        </button>
        {#if table.thinking}<span class="tiny">thinking…</span>{/if}
      </div>
    </section>

    <div class="card-wrap panel">
      <table class="sheet">
        <thead>
          <tr>
            <th class="cat">Box</th>
            {#each v.players as p (p.seat)}
              <th class:active={v.turn === p.seat}>{p.name}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each CATEGORIES as category, ci (category)}
            <tr class:rule={ci === 6}>
              <td class="cat">{CATEGORY_LABELS[category]}</td>
              {#each v.players as p (p.seat)}
                <td>
                  {#if p.card[category] !== null}
                    <span class="num filled">{p.card[category]}</span>
                  {:else if p.seat === v.seat && myTurn && rolled}
                    <button class="pick num" onclick={() => table.send({ type: 'score', category })}>
                      {preview(category)}
                    </button>
                  {:else}
                    <span class="empty">·</span>
                  {/if}
                </td>
              {/each}
            </tr>
            {#if ci === 5}
              <tr class="subtotal">
                <td class="cat">Upper bonus <span class="muted tiny">(63+)</span></td>
                {#each v.players as p (p.seat)}
                  <td class="num">{p.upper}{p.bonus ? ` +${p.bonus}` : ''}</td>
                {/each}
              </tr>
            {/if}
          {/each}
          <tr class="total">
            <td class="cat">Total</td>
            {#each v.players as p (p.seat)}
              <td class="num strong">{p.total}{p.yahtzeeBonus ? ` (+${p.yahtzeeBonus})` : ''}</td>
            {/each}
          </tr>
        </tbody>
      </table>
    </div>

    <details class="panel log-panel">
      <summary>Table talk</summary>
      <GameLog log={v.log} />
    </details>
  </div>

  {#if v.phase === 'gameOver'}
    <div class="overlay fade-in">
      <div class="panel result center">
        <div class="tag">Yahtzee</div>
        <h2>{v.winners.map((i) => v.players[i].name).join(' & ')} {v.winners.length > 1 ? 'tie' : 'wins'}</h2>
        <table class="score">
          <tbody>
            {#each [...v.players].sort((a, b) => b.total - a.total) as p (p.seat)}
              <tr><td>{p.name}</td><td class="num strong">{p.total}</td></tr>
            {/each}
          </tbody>
        </table>
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

  .tray { display: grid; gap: 0.9rem; justify-items: center; padding: 1.1rem; }
  .dice { display: flex; gap: 0.6rem; flex-wrap: wrap; justify-content: center; }
  .die {
    position: relative;
    width: 62px; height: 62px; padding: 6px;
    border-radius: 12px;
    background: linear-gradient(160deg, #fffdf7, #ece2cd);
    border: 1px solid var(--card-edge);
    box-shadow: var(--shadow-1);
    cursor: pointer;
    transition: transform 0.14s ease, box-shadow 0.14s ease;
  }
  .die:disabled { cursor: default; }
  .die.blank { background: color-mix(in srgb, black 18%, transparent); border-style: dashed; box-shadow: none; }
  .die svg { width: 100%; height: 100%; fill: #23201c; }
  .die.held { transform: translateY(6px); box-shadow: 0 0 0 2px var(--brass), var(--shadow-1); }
  .hold-tag {
    position: absolute; bottom: -16px; left: 0; right: 0;
    font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--brass-soft);
  }
  .rollrow { min-height: 2.4rem; }

  .card-wrap { overflow-x: auto; }
  .sheet { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  .sheet th, .sheet td { padding: 0.22rem 0.5rem; text-align: right; }
  .sheet th.cat, .sheet td.cat { text-align: left; color: var(--ink-soft); }
  .sheet th { font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-faint); }
  .sheet th.active { color: var(--brass); }
  .sheet tbody tr:nth-child(odd) { background: color-mix(in srgb, var(--ink) 3%, transparent); }
  .rule td { border-top: 1px solid var(--card-edge); }
  .subtotal td, .total td { border-top: 1px solid var(--card-edge); font-weight: 600; }
  .empty { color: var(--ink-faint); }
  .filled { font-weight: 600; }
  .pick {
    border: 1px dashed var(--brass); background: color-mix(in srgb, var(--brass) 12%, transparent);
    border-radius: 6px; padding: 0.05em 0.5em; cursor: pointer; color: var(--ink); min-width: 2.2em;
  }
  .pick:hover { background: var(--brass); color: #2b2110; }
  .strong { font-weight: 700; }

  .log-panel summary { cursor: pointer; font-size: 0.85rem; color: var(--ink-soft); }
  .overlay {
    position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: 1rem;
    background: color-mix(in srgb, var(--felt-deep) 78%, transparent); backdrop-filter: blur(4px);
  }
  .result { max-width: 420px; width: 100%; display: grid; gap: 0.9rem; justify-items: center; }
  .score { border-collapse: collapse; }
  .score td { padding: 0.2rem 0.6rem; }
</style>
