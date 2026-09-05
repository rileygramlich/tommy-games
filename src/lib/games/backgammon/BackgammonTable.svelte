<script>
  import GameLog from '../../components/GameLog.svelte';
  import Curtain from '../../components/Curtain.svelte';

  let { table, onexit } = $props();
  const v = $derived(table.view);
  const myTurn = $derived(!!v && v.turn === v.seat);
  const COLOURS = ['#23201c', '#f2e7d2'];

  // Top row runs 12..23 left to right, bottom row 11..0, which puts each
  // player's home board on the right the way a real board does.
  const TOP = Array.from({ length: 12 }, (_, i) => 12 + i);
  const BOTTOM = Array.from({ length: 12 }, (_, i) => 11 - i);

  let from = $state(null);

  const sources = $derived(new Set((v?.moves ?? []).map((m) => m.from)));
  const destinations = $derived(new Set((v?.moves ?? []).filter((m) => m.from === from).map((m) => m.to)));

  function checkersAt(index) {
    const value = v.points[index];
    return { seat: value > 0 ? 0 : value < 0 ? 1 : null, count: Math.abs(value) };
  }
  function tapPoint(index) {
    if (!myTurn || v.phase !== 'move') return;
    if (from !== null && destinations.has(index)) {
      const move = v.moves.find((m) => m.from === from && m.to === index);
      table.send({ type: 'move', from: move.from, to: move.to, die: move.die });
      from = null;
      return;
    }
    from = sources.has(index) ? index : null;
  }
  function tapBar() {
    if (myTurn && sources.has('bar')) from = 'bar';
  }
  function bearOff() {
    const move = v.moves.find((m) => m.from === from && m.to === 'off');
    if (move) { table.send({ type: 'move', from: move.from, to: 'off', die: move.die }); from = null; }
  }

  function status() {
    if (!v) return '';
    if (v.phase === 'gameOver') return `${v.players[v.winners[0]].name} takes the match`;
    if (v.phase === 'gameEnd') return v.lastResult ? `${v.players[v.lastResult.winner].name} wins ${v.lastResult.kind}` : 'Game over';
    if (!myTurn) return `${v.players[v.turn].name} to ${v.phase === 'roll' ? 'roll' : 'move'}`;
    if (v.phase === 'roll') return 'Your roll';
    if (v.phase === 'turnEnd') return 'Nothing more to play';
    if (v.bar[v.seat] > 0) return 'Enter from the bar first';
    return from !== null ? 'Now pick a point' : 'Pick a checker';
  }
</script>

{#if v}
  <div class="stack">
    <header class="spread">
      <div class="row">
        <button class="btn ghost small" onclick={onexit}>← Leave</button>
        <div>
          <div class="title">Game {v.gameNo} <span class="muted">· match to {v.target}</span></div>
          <div class="status">{status()}</div>
        </div>
      </div>
      <div class="row tallies">
        {#each v.players as p (p.seat)}
          <div class="tally" class:active={v.turn === p.seat}>
            <span class="pip" style="background:{COLOURS[p.seat]}"></span>
            <div>
              <div class="tiny">{p.name}</div>
              <div class="tiny muted num">{p.score} pts · {p.pips} pips · {p.off} off</div>
            </div>
          </div>
        {/each}
      </div>
    </header>

    <div class="board felt">
      <div class="half">
        {#each TOP as index (index)}
          {@const spot = checkersAt(index)}
          <button
            class="point top"
            class:dark={index % 2 === 0}
            class:source={myTurn && sources.has(index)}
            class:dest={myTurn && destinations.has(index)}
            class:picked={from === index}
            onclick={() => tapPoint(index)}
            aria-label={`Point ${v.seat === 0 ? index + 1 : 24 - index}, ${spot.count} checkers`}
          >
            <span class="triangle" aria-hidden="true"></span>
            <span class="stack-checkers">
              {#each Array(Math.min(spot.count, 5)) as _, k (k)}
                <span class="checker" style="background:{COLOURS[spot.seat]}"></span>
              {/each}
              {#if spot.count > 5}<span class="more num">{spot.count}</span>{/if}
            </span>
          </button>
        {/each}
      </div>

      <div class="bar-row">
        <button class="bar" class:source={myTurn && sources.has('bar')} onclick={tapBar} aria-label="The bar">
          {#each v.bar as count, seat (seat)}
            {#if count}
              <span class="barstack">
                {#each Array(Math.min(count, 3)) as _, k (k)}
                  <span class="checker small" style="background:{COLOURS[seat]}"></span>
                {/each}
                {#if count > 3}<span class="more num">{count}</span>{/if}
              </span>
            {/if}
          {/each}
          <span class="tiny label">bar</span>
        </button>

        <div class="dice-area">
          {#if v.phase === 'roll' && myTurn}
            <button class="btn brass" onclick={() => table.send({ type: 'roll' })}>Roll</button>
          {:else if v.dice.length}
            <div class="row dice">
              {#each v.dice as die, i (i)}
                <span class="die" class:spent={!v.diceLeft.includes(die) || v.diceLeft.filter((d) => d === die).length < v.dice.filter((d, j) => d === die && j <= i).length}>{die}</span>
              {/each}
              {#if v.diceLeft.length > 2}<span class="tiny muted">doubles — {v.diceLeft.length} left</span>{/if}
            </div>
          {/if}
          {#if myTurn && v.phase === 'turnEnd'}
            <button class="btn small" onclick={() => table.send({ type: 'continue' })}>End turn</button>
          {/if}
          {#if myTurn && from !== null && destinations.has('off')}
            <button class="btn small brass" onclick={bearOff}>Bear off</button>
          {/if}
          {#if table.thinking}<span class="tiny muted">thinking…</span>{/if}
        </div>

        <div class="off-tray">
          {#each v.players as p (p.seat)}
            <div class="off" title={`${p.name} borne off`}>
              <span class="pip" style="background:{COLOURS[p.seat]}"></span>
              <span class="num tiny">{p.off}</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="half">
        {#each BOTTOM as index (index)}
          {@const spot = checkersAt(index)}
          <button
            class="point bottom"
            class:dark={index % 2 === 0}
            class:source={myTurn && sources.has(index)}
            class:dest={myTurn && destinations.has(index)}
            class:picked={from === index}
            onclick={() => tapPoint(index)}
            aria-label={`Point ${v.seat === 0 ? index + 1 : 24 - index}, ${spot.count} checkers`}
          >
            <span class="triangle" aria-hidden="true"></span>
            <span class="stack-checkers">
              {#each Array(Math.min(spot.count, 5)) as _, k (k)}
                <span class="checker" style="background:{COLOURS[spot.seat]}"></span>
              {/each}
              {#if spot.count > 5}<span class="more num">{spot.count}</span>{/if}
            </span>
          </button>
        {/each}
      </div>
    </div>

    {#if table.error}<div class="err tiny center">{table.error}</div>{/if}

    <details class="panel log-panel">
      <summary>Moves</summary>
      <GameLog log={v.log} />
    </details>
  </div>

  {#if v.phase === 'gameEnd'}
    <div class="overlay fade-in">
      <div class="panel result center">
        <h2>{v.players[v.lastResult.winner].name} wins {v.lastResult.kind}</h2>
        <p class="num big">{v.players[0].score} – {v.players[1].score}</p>
        <button class="btn primary" onclick={() => table.send({ type: 'continue' })}>
          {Math.max(v.players[0].score, v.players[1].score) >= v.target ? 'Final' : 'Next game'}
        </button>
      </div>
    </div>
  {/if}

  {#if v.phase === 'gameOver'}
    <div class="overlay fade-in">
      <div class="panel result center">
        <div class="tag">Backgammon</div>
        <h2>{v.players[v.winners[0]].name} takes the match</h2>
        <p class="num big">{v.players[0].score} – {v.players[1].score}</p>
        <button class="btn primary" onclick={onexit}>Back to the shelf</button>
      </div>
    </div>
  {/if}

  {#if table.curtain}<Curtain name={table.curtain.name} onreveal={() => table.reveal()} />{/if}
{/if}

<style>
  .title { font-family: var(--serif); font-size: 1.15rem; }
  .status { font-size: 0.85rem; color: var(--ink-soft); }
  .tiny { font-size: 0.72rem; }
  .err { color: var(--rose); }
  .tallies { gap: 0.8rem; }
  .tally { display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.5rem; border-radius: 8px; border: 1px solid transparent; }
  .tally.active { border-color: var(--brass); }
  .pip { width: 12px; height: 12px; border-radius: 50%; border: 1px solid var(--card-edge); display: inline-block; }

  .board { padding: 0.5rem; display: grid; gap: 0.3rem; }
  .half { display: grid; grid-template-columns: repeat(12, 1fr); gap: 2px; }
  .point {
    position: relative;
    height: clamp(110px, 20vw, 165px);
    background: none; border: 0; padding: 0; cursor: default;
    display: flex; flex-direction: column; align-items: center;
  }
  .point.bottom { flex-direction: column-reverse; }
  .triangle {
    position: absolute; inset: 0;
    background: color-mix(in srgb, #f0e0bf 22%, transparent);
    clip-path: polygon(0 0, 100% 0, 50% 100%);
  }
  .point.bottom .triangle { clip-path: polygon(0 100%, 100% 100%, 50% 0); }
  .point.dark .triangle { background: color-mix(in srgb, #7a2f28 45%, transparent); }
  .point.source { cursor: pointer; }
  .point.source .triangle { box-shadow: inset 0 0 0 2px var(--brass-soft); }
  .point.picked .triangle { background: color-mix(in srgb, var(--brass) 45%, transparent); }
  .point.dest { cursor: pointer; }
  .point.dest .triangle { background: color-mix(in srgb, #6fbf94 45%, transparent); }
  .stack-checkers { position: relative; display: flex; flex-direction: inherit; align-items: center; gap: 1px; padding: 2px 0; }
  .checker {
    width: clamp(18px, 3.2vw, 26px); height: clamp(18px, 3.2vw, 26px);
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.35);
    box-shadow: inset 0 -2px 3px rgba(0, 0, 0, 0.28);
  }
  .checker.small { width: 18px; height: 18px; }
  .more { position: absolute; bottom: -2px; right: -4px; font-size: 0.62rem; color: var(--brass-soft); }

  .bar-row {
    display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.6rem;
    padding: 0.35rem 0.2rem;
    border-top: 1px solid color-mix(in srgb, #f0e0bf 20%, transparent);
    border-bottom: 1px solid color-mix(in srgb, #f0e0bf 20%, transparent);
  }
  .bar {
    display: flex; align-items: center; gap: 0.3rem;
    min-width: 64px; min-height: 34px; padding: 0.2rem 0.5rem;
    background: color-mix(in srgb, black 22%, transparent);
    border: 1px solid transparent; border-radius: 8px; color: inherit; cursor: default;
  }
  .bar.source { cursor: pointer; border-color: var(--brass-soft); }
  .barstack { display: flex; gap: 2px; position: relative; }
  .bar .label { opacity: 0.5; letter-spacing: 0.08em; text-transform: uppercase; }
  .dice-area { display: flex; align-items: center; justify-content: center; gap: 0.5rem; flex-wrap: wrap; }
  .die {
    display: grid; place-items: center;
    width: 30px; height: 30px; border-radius: 7px;
    background: linear-gradient(160deg, #fffdf7, #e8dcc4);
    color: #23201c; font-family: var(--serif); font-size: 1rem;
    box-shadow: var(--shadow-1);
  }
  .die.spent { opacity: 0.35; }
  .off-tray { display: grid; gap: 0.2rem; }
  .off { display: flex; align-items: center; gap: 0.3rem; }

  .log-panel summary { cursor: pointer; font-size: 0.85rem; color: var(--ink-soft); }
  .overlay {
    position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: 1rem;
    background: color-mix(in srgb, var(--felt-deep) 78%, transparent); backdrop-filter: blur(4px);
  }
  .result { max-width: 420px; width: 100%; display: grid; gap: 0.9rem; justify-items: center; }
  .big { font-family: var(--serif); font-size: 1.5rem; }
</style>
