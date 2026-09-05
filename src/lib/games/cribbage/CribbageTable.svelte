<script>
  import PlayingCard from '../../components/PlayingCard.svelte';
  import GameLog from '../../components/GameLog.svelte';
  import Curtain from '../../components/Curtain.svelte';

  let { table, onexit } = $props();
  const v = $derived(table.view);
  const me = $derived(v ? v.players[v.seat] : null);
  const them = $derived(v ? v.players[1 - v.seat] : null);
  const myTurn = $derived(!!v && v.turn === v.seat && ['discard', 'pegging'].includes(v.phase));

  let picked = $state([]);
  let signature = $derived(`${v?.deal}:${v?.phase}:${(v?.hand ?? []).map((c) => c.id).join(',')}`);
  let lastSignature = '';
  $effect(() => {
    if (signature !== lastSignature) { lastSignature = signature; picked = []; }
  });

  function toggle(id) {
    if (picked.includes(id)) picked = picked.filter((p) => p !== id);
    else if (picked.length < 2) picked = [...picked, id];
  }

  function status() {
    if (!v) return '';
    if (v.phase === 'gameOver') return `${v.players[v.winners[0]].name} is home`;
    if (v.phase === 'show') return 'The count';
    if (v.phase === 'discard') {
      return v.discarded[v.seat] ? 'Waiting on the lay-away' : `Lay two away to ${v.dealer === v.seat ? 'your' : `${them.name}'s`} crib`;
    }
    if (!myTurn) return `${v.players[v.turn].name} to play`;
    return v.mustGo ? 'Nothing under thirty-one — say go' : 'Your play';
  }
</script>

{#if v}
  <div class="stack">
    <header class="spread">
      <div class="row">
        <button class="btn ghost small" onclick={onexit}>← Leave</button>
        <div>
          <div class="title">Deal {v.deal} <span class="muted">· to {v.target}</span></div>
          <div class="status">{status()}</div>
        </div>
      </div>
      {#if v.starter}
        <div class="row starter">
          <div class="tiny muted">Cut</div>
          <PlayingCard card={v.starter} size="sm" />
        </div>
      {/if}
    </header>

    <div class="track panel">
      {#each v.players as p (p.seat)}
        <div class="lane">
          <div class="spread tiny">
            <span>{p.name}{v.dealer === p.seat ? ' · crib' : ''}</span>
            <span class="num">{p.score}</span>
          </div>
          <div class="bar"><div class="fill" style="width:{Math.min(100, (p.score / v.target) * 100)}%" class:mine={p.seat === v.seat}></div></div>
        </div>
      {/each}
    </div>

    <section class="felt board">
      {#if v.phase === 'pegging'}
        <div class="count-badge">
          <div class="tiny muted">Count</div>
          <div class="num count">{v.count}</div>
        </div>
        <div class="pile">
          {#each v.pile as card (card.id)}<PlayingCard {card} size="sm" />{/each}
          {#if !v.pile.length}<div class="empty muted">Nothing down yet</div>{/if}
        </div>
      {:else if v.phase === 'show'}
        <div class="show stack">
          {#each v.showRows as row, i (i)}
            <div class="showrow fade-in">
              <div class="spread">
                <strong>{row.who}</strong>
                <span class="num strong">{row.total}</span>
              </div>
              <div class="row wrap cards">
                {#each row.cards as card (card.id)}<PlayingCard {card} size="sm" />{/each}
                {#if v.starter}<span class="plus">+</span><PlayingCard card={v.starter} size="sm" />{/if}
              </div>
              <div class="tiny parts">{row.parts.length ? row.parts.map((p) => `${p.label} ${p.points}`).join(' · ') : 'nineteen — nothing at all'}</div>
            </div>
          {/each}
          <button class="btn primary" onclick={() => table.send({ type: 'continue' })}>
            {v.showStep === 0 ? 'Count the hands' : v.showStep < 3 ? 'Next' : 'Deal again'}
          </button>
        </div>
      {:else}
        <div class="empty muted">{v.phase === 'discard' ? 'Choose two for the crib' : ''}</div>
      {/if}
      {#if table.thinking}<div class="thinking tiny">thinking…</div>{/if}
    </section>

    <section class="you stack">
      <div class="spread">
        <div class="row">
          <strong>{me.name}</strong>
          <span class="tiny muted">{me.score} points{v.dealer === v.seat ? ' · your crib' : ''}</span>
        </div>
        {#if table.error}<span class="err tiny">{table.error}</span>{/if}
      </div>

      <div class="hand">
        {#each (v.phase === 'show' ? v.kept : v.hand) as card (card.id)}
          <PlayingCard
            {card}
            size="lg"
            playable={myTurn && (v.phase === 'discard' ? !v.discarded[v.seat] : v.playable.includes(card.id))}
            dimmed={myTurn && v.phase === 'pegging' && !v.playable.includes(card.id)}
            selected={picked.includes(card.id)}
            onclick={() => (v.phase === 'discard' ? toggle(card.id) : table.send({ type: 'play', cardId: card.id }))}
          />
        {/each}
        {#if !v.hand.length && v.phase === 'pegging'}<div class="muted tiny">Out of cards.</div>{/if}
      </div>

      <div class="row wrap">
        {#if v.phase === 'discard' && !v.discarded[v.seat]}
          <button class="btn primary" disabled={picked.length !== 2 || !myTurn} onclick={() => table.send({ type: 'discard', cardIds: picked })}>
            Lay away {picked.length}/2
          </button>
        {/if}
        {#if v.phase === 'pegging' && myTurn && v.mustGo}
          <button class="btn brass" onclick={() => table.send({ type: 'go' })}>Go</button>
        {/if}
        {#if v.lastScore}
          <span class="tiny muted">{v.players[v.lastScore.seat].name} pegged {v.lastScore.points} — {v.lastScore.reason}</span>
        {/if}
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
        <div class="tag">Cribbage</div>
        <h2>{v.players[v.winners[0]].name} is home</h2>
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
  .tiny { font-size: 0.75rem; }
  .err { color: var(--rose); }
  .starter { gap: 0.5rem; }

  .track { display: grid; gap: 0.6rem; }
  .lane { display: grid; gap: 0.2rem; }
  .bar { height: 8px; border-radius: 999px; background: var(--paper-3); overflow: hidden; }
  .fill { height: 100%; background: var(--ink-faint); transition: width 0.4s ease; }
  .fill.mine { background: linear-gradient(90deg, var(--felt-line), var(--brass)); }

  .board { position: relative; min-height: 170px; display: grid; place-items: center; padding: 1.1rem; }
  .count-badge { position: absolute; top: 0.7rem; left: 0.9rem; text-align: left; }
  .count { font-family: var(--serif); font-size: 1.5rem; }
  .pile { display: flex; gap: 0.4rem; flex-wrap: wrap; justify-content: center; }
  .empty { opacity: 0.5; font-size: 0.85rem; }
  .thinking { position: absolute; bottom: 0.6rem; right: 0.9rem; opacity: 0.6; font-style: italic; }

  .show { width: 100%; max-width: 460px; }
  .showrow { border-top: 1px solid color-mix(in srgb, #f0e6d2 26%, transparent); padding-top: 0.5rem; }
  .showrow .cards { gap: 0.3rem; margin: 0.3rem 0; align-items: center; }
  .plus { opacity: 0.6; }
  .parts { opacity: 0.8; }
  .strong { font-weight: 700; }

  .hand { display: flex; gap: 0.45rem; flex-wrap: wrap; min-height: 112px; align-items: flex-end; }
  .log-panel summary { cursor: pointer; font-size: 0.85rem; color: var(--ink-soft); }
  .overlay {
    position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: 1rem;
    background: color-mix(in srgb, var(--felt-deep) 78%, transparent); backdrop-filter: blur(4px);
  }
  .result { max-width: 420px; width: 100%; display: grid; gap: 0.9rem; justify-items: center; }
  .big { font-family: var(--serif); font-size: 1.5rem; }

  @media (max-width: 640px) {
    /* One thumb, one column: hands shrink, strips scroll, sheets scroll. */
    .hand { min-height: 0; gap: 0.3rem; }
    .seats { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 0.25rem; scrollbar-width: none; }
    .seats::-webkit-scrollbar { display: none; }
    .board { min-height: 0; padding: 0.7rem; }
    .overlay { padding: 0.6rem; align-items: end; }
    .sheet, .result { max-height: 88dvh; overflow-y: auto; }
  }

  @media (max-width: 640px) {
    .show { max-width: 100%; }
    .count-badge { position: static; }
    .pile { gap: 0.25rem; }
  }
</style>
