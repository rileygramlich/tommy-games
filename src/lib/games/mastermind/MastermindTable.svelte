<script>
  import GameLog from '../../components/GameLog.svelte';
  import Curtain from '../../components/Curtain.svelte';

  let { table, onexit } = $props();
  const v = $derived(table.view);
  const myTurn = $derived(!!v && (
    (v.phase === 'setCode' && v.seat === v.codemaker) ||
    (v.phase === 'guessing' && v.seat === v.breaker)
  ));

  let working = $state([]);
  const signature = $derived(`${v?.round}:${v?.phase}:${v?.guesses.length}`);
  let lastSignature = '';
  $effect(() => {
    if (signature !== lastSignature) { lastSignature = signature; working = []; }
  });

  const colourOf = (key) => v.colours.find((c) => c.key === key);
  const full = $derived(!!v && working.length === v.pegs);

  function place(key) {
    if (!myTurn || working.length >= v.pegs) return;
    if (!v.repeats && working.includes(key)) return;
    working = [...working, key];
  }
  function clearFrom(i) {
    working = working.slice(0, i);
  }
  function submit() {
    const move = v.phase === 'setCode'
      ? { type: 'setCode', code: working }
      : { type: 'guess', code: working };
    table.send(move);
    working = [];
  }

  function status() {
    if (!v) return '';
    if (v.phase === 'gameOver') return 'Game over';
    if (v.phase === 'roundEnd') {
      return v.roundSummary.solved ? `Cracked in ${v.roundSummary.guesses}` : 'Never cracked';
    }
    if (v.phase === 'setCode') {
      return v.seat === v.codemaker ? 'Hide a row of pegs' : `${v.players[v.codemaker].name} is setting a code`;
    }
    if (v.seat === v.breaker) return `${v.left} ${v.left === 1 ? 'guess' : 'guesses'} left`;
    return `${v.players[v.breaker].name} is working on it`;
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
      <div class="row scores">
        {#each v.players as p (p.seat)}
          <div class="who" class:mine={p.seat === v.seat}>
            <div class="tiny muted">{p.name} · {p.role === 'codemaker' ? 'hiding' : 'breaking'}</div>
            <div class="num score">{p.score}</div>
          </div>
        {/each}
      </div>
    </header>

    <section class="felt board">
      <div class="secret-row">
        <span class="tiny muted">Code</span>
        <div class="pegs">
          {#each Array(v.pegs) as _, i (i)}
            {#if v.secret}
              <span class="peg" style="--peg:{colourOf(v.secret[i]).hex}">{colourOf(v.secret[i]).letter}</span>
            {:else}
              <span class="peg hidden">?</span>
            {/if}
          {/each}
        </div>
        {#if v.secret && v.phase !== 'roundEnd' && v.phase !== 'gameOver'}
          <span class="tiny muted">only you can see this</span>
        {/if}
      </div>

      <ol class="rows">
        {#each v.guesses as guess, i (i)}
          <li class="guessrow fade-in">
            <span class="num idx">{i + 1}</span>
            <div class="pegs">
              {#each guess.code as key, k (k)}
                <span class="peg" style="--peg:{colourOf(key).hex}">{colourOf(key).letter}</span>
              {/each}
            </div>
            <div class="marks" aria-label={`${guess.exact} exact, ${guess.colour} misplaced`}>
              {#each Array(guess.exact) as _, m (`b${m}`)}<span class="mark black"></span>{/each}
              {#each Array(guess.colour) as _, m (`w${m}`)}<span class="mark white"></span>{/each}
              {#each Array(v.pegs - guess.exact - guess.colour) as _, m (`e${m}`)}<span class="mark empty"></span>{/each}
            </div>
          </li>
        {/each}
        {#each Array(Math.max(0, v.left)) as _, i (`blank${i}`)}
          <li class="guessrow blank">
            <span class="num idx">{v.guesses.length + i + 1}</span>
            <div class="pegs">
              {#each Array(v.pegs) as _, k (k)}<span class="peg empty"></span>{/each}
            </div>
            <div class="marks">
              {#each Array(v.pegs) as _, m (m)}<span class="mark empty"></span>{/each}
            </div>
          </li>
        {/each}
      </ol>
      {#if table.thinking}<div class="thinking tiny">thinking…</div>{/if}
    </section>

    {#if myTurn}
      <section class="you stack">
        <div class="working">
          <div class="pegs">
            {#each Array(v.pegs) as _, i (i)}
              {#if working[i]}
                <button class="peg" style="--peg:{colourOf(working[i]).hex}" onclick={() => clearFrom(i)}
                  aria-label={`${colourOf(working[i]).name}, tap to clear`}>{colourOf(working[i]).letter}</button>
              {:else}
                <span class="peg empty"></span>
              {/if}
            {/each}
          </div>
          <button class="btn primary" disabled={!full} onclick={submit}>
            {v.phase === 'setCode' ? 'Lock it in' : 'Guess'}
          </button>
        </div>
        <div class="palette">
          {#each v.colours as colour (colour.key)}
            <button
              class="peg pick"
              style="--peg:{colour.hex}"
              disabled={working.length >= v.pegs || (!v.repeats && working.includes(colour.key))}
              onclick={() => place(colour.key)}
              aria-label={colour.name}
            >{colour.letter}</button>
          {/each}
          {#if working.length}
            <button class="btn ghost small" onclick={() => (working = [])}>Clear</button>
          {/if}
        </div>
        {#if !v.repeats}<div class="tiny muted">No colour twice this game.</div>{/if}
        {#if table.error}<div class="tiny err">{table.error}</div>{/if}
      </section>
    {/if}

    <details class="panel log-panel">
      <summary>Table talk</summary>
      <GameLog log={v.log} />
    </details>
  </div>

  {#if v.phase === 'roundEnd' && v.roundSummary}
    <div class="overlay fade-in">
      <div class="panel result">
        <h2>Round {v.roundSummary.round}</h2>
        <div class="pegs big">
          {#each v.roundSummary.secret as key, i (i)}
            <span class="peg" style="--peg:{colourOf(key).hex}">{colourOf(key).letter}</span>
          {/each}
        </div>
        <p>
          {v.players[v.roundSummary.breaker].name}
          {v.roundSummary.solved ? `cracked it in ${v.roundSummary.guesses}` : 'never cracked it'}.
          {v.players[v.roundSummary.codemaker].name} scores {v.roundSummary.points}.
        </p>
        <div class="row spread">
          {#each v.players as p (p.seat)}
            <div><span class="tiny muted">{p.name}</span><div class="num big-num">{p.score}</div></div>
          {/each}
        </div>
        <button class="btn primary" onclick={() => table.send({ type: 'continue' })}>
          {v.round >= v.rounds ? 'Final scores' : 'Swap roles'}
        </button>
      </div>
    </div>
  {/if}

  {#if v.phase === 'gameOver'}
    <div class="overlay fade-in">
      <div class="panel result center">
        <div class="tag">Mastermind</div>
        <h2>{v.winners.map((i) => v.players[i].name).join(' & ')} {v.winners.length > 1 ? 'tie' : 'wins'}</h2>
        <p class="num big-num">{v.players[0].score} – {v.players[1].score}</p>
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
  .scores { gap: 1rem; }
  .who { text-align: right; }
  .who.mine .score { color: var(--brass); }
  .score { font-family: var(--serif); font-size: 1.2rem; }

  .board { position: relative; padding: 0.9rem; display: grid; gap: 0.6rem; }
  .secret-row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; padding-bottom: 0.5rem; border-bottom: 1px solid color-mix(in srgb, #f0e6d2 22%, transparent); }
  .rows { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; max-height: 46vh; overflow-y: auto; }
  .guessrow { display: flex; align-items: center; gap: 0.6rem; }
  .guessrow.blank { opacity: 0.35; }
  .idx { width: 1.4em; text-align: right; font-size: 0.7rem; opacity: 0.6; }

  .pegs { display: flex; gap: 0.3rem; }
  .peg {
    display: grid; place-items: center;
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--peg, transparent);
    border: 1px solid rgba(0, 0, 0, 0.35);
    box-shadow: inset 0 -3px 5px rgba(0, 0, 0, 0.28), 0 1px 2px rgba(0, 0, 0, 0.3);
    color: rgba(255, 255, 255, 0.75);
    font-size: 0.62rem; font-weight: 700; font-family: var(--tabular);
    padding: 0;
  }
  .peg.empty {
    background: color-mix(in srgb, black 22%, transparent);
    border-style: dashed; border-color: color-mix(in srgb, #f0e6d2 30%, transparent);
    box-shadow: none;
  }
  .peg.hidden { background: color-mix(in srgb, black 32%, transparent); color: var(--brass-soft); }
  .pegs.big .peg { width: 38px; height: 38px; font-size: 0.72rem; }
  button.peg { cursor: pointer; }
  button.peg:disabled { opacity: 0.35; cursor: default; }
  .peg.pick { width: 38px; height: 38px; }
  .peg.pick:not(:disabled):hover { transform: translateY(-2px); }

  .marks { display: grid; grid-template-columns: repeat(2, auto); gap: 2px; margin-left: auto; }
  .mark { width: 9px; height: 9px; border-radius: 50%; }
  .mark.black { background: #17150f; border: 1px solid rgba(255, 255, 255, 0.4); }
  .mark.white { background: #f4ecd8; border: 1px solid rgba(0, 0, 0, 0.3); }
  .mark.empty { background: color-mix(in srgb, #f0e6d2 12%, transparent); }

  .thinking { position: absolute; bottom: 0.5rem; right: 0.8rem; opacity: 0.6; font-style: italic; }

  .working { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; }
  .palette { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }

  .log-panel summary { cursor: pointer; font-size: 0.85rem; color: var(--ink-soft); }
  .overlay {
    position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: 1rem;
    background: color-mix(in srgb, var(--felt-deep) 78%, transparent); backdrop-filter: blur(4px);
  }
  .result { max-width: 420px; width: 100%; display: grid; gap: 0.8rem; justify-items: center; text-align: center; }
  .big-num { font-family: var(--serif); font-size: 1.5rem; }

  @media (max-width: 640px) {
    .rows { max-height: 40dvh; }
    .peg { width: clamp(26px, 7.5vw, 30px); height: clamp(26px, 7.5vw, 30px); }
    .peg.pick, .pegs.big .peg { width: clamp(34px, 10vw, 38px); height: clamp(34px, 10vw, 38px); }
    .board { padding: 0.7rem; }
    .scores { gap: 0.75rem; }
    .who { text-align: left; }
    .overlay { padding: 0.6rem; }
    .result { max-height: 88dvh; overflow-y: auto; }
  }
</style>
