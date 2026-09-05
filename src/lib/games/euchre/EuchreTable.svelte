<script>
  import PlayingCard from '../../components/PlayingCard.svelte';
  import Seat from '../../components/Seat.svelte';
  import GameLog from '../../components/GameLog.svelte';
  import Curtain from '../../components/Curtain.svelte';
  import { SUITS, SUIT_NAMES, SUIT_SYMBOLS } from '../cards.js';
  import { partnerOf, teamOf } from './engine.js';

  let { table, onexit } = $props();
  const v = $derived(table.view);
  const myTurn = $derived(!!v && v.turn === v.seat && ['bid1', 'bid2', 'dealerDiscard', 'playing'].includes(v.phase));
  const others = $derived(v ? v.players.filter((p) => p.seat !== v.seat) : []);
  const myTeam = $derived(v ? teamOf(v.seat) : 0);
  const shownTrick = $derived(v && v.phase === 'trickEnd' && v.lastTrick ? v.lastTrick.plays : (v?.trick ?? []));

  let alone = $state(false);

  function status() {
    if (!v) return '';
    if (v.phase === 'gameOver') return 'Game over';
    if (v.phase === 'handEnd') return v.handSummary?.text ?? 'Hand over';
    if (v.phase === 'trickEnd') return `${v.players[v.lastTrick.winner].name} takes it`;
    if (v.phase === 'bid1') return myTurn ? 'Order it up?' : `${v.players[v.turn].name} is thinking`;
    if (v.phase === 'bid2') return myTurn ? 'Name a suit, or pass' : `${v.players[v.turn].name} is thinking`;
    if (v.phase === 'dealerDiscard') return myTurn ? 'Pitch a card' : `${v.players[v.turn].name} is discarding`;
    return myTurn ? 'Your play' : `${v.players[v.turn].name} to play`;
  }
</script>

{#if v}
  <div class="stack">
    <header class="spread">
      <div class="row">
        <button class="btn ghost small" onclick={onexit}>← Leave</button>
        <div>
          <div class="title">Hand {v.hand} <span class="muted">· to {v.target}</span></div>
          <div class="status">{status()}</div>
        </div>
      </div>
      <div class="row teams">
        {#each v.teams as team (team.team)}
          <div class="team" class:mine={team.team === myTeam}>
            <div class="tiny muted">{team.names.join(' & ')}</div>
            <div class="num score">{team.score} <span class="muted tiny">· {team.tricks} tricks</span></div>
          </div>
        {/each}
      </div>
    </header>

    <div class="row wrap trumprow">
      {#if v.trump}
        <span class="tag">Trump {SUIT_SYMBOLS[v.trump]} {SUIT_NAMES[v.trump]}</span>
        <span class="tiny muted">called by {v.players[v.maker].name}{v.alone ? ', alone' : ''}</span>
      {:else if v.upcard}
        <span class="tiny muted">Turned up:</span>
        <PlayingCard card={v.upcard} size="sm" />
      {:else if v.turnedDown}
        <span class="tiny muted">{SUIT_NAMES[v.turnedDown]} turned down</span>
      {/if}
    </div>

    <div class="seats">
      {#each others as p (p.seat)}
        <Seat
          player={p}
          active={v.turn === p.seat && !['handEnd', 'gameOver'].includes(v.phase)}
          dealer={v.dealer === p.seat}
          detail={`${p.seat === partnerOf(v.seat) ? 'partner' : 'against'} · ${p.tricks} tricks${v.sitter === p.seat ? ' · sitting out' : ''}`}
        />
      {/each}
    </div>

    <section class="felt board">
      <div class="trick">
        {#each shownTrick as play (play.card.id)}
          <div class="played deal-in" class:winner={v.phase === 'trickEnd' && v.lastTrick.winner === play.seat}>
            <PlayingCard card={play.card} />
            <div class="played-name">{v.players[play.seat].name}</div>
          </div>
        {/each}
        {#if !shownTrick.length}<div class="empty muted">{v.trump ? 'No cards played yet' : 'Bidding'}</div>{/if}
      </div>
      {#if table.thinking}<div class="thinking tiny">thinking…</div>{/if}
    </section>

    <section class="you stack">
      <div class="spread">
        <strong>{v.players[v.seat].name}{v.sitter === v.seat ? ' (sitting out)' : ''}</strong>
        {#if table.error}<span class="err tiny">{table.error}</span>{/if}
      </div>

      {#if myTurn && v.phase === 'bid1'}
        <div class="row wrap">
          <button class="btn primary" onclick={() => table.send({ type: 'orderUp', alone })}>
            {v.seat === v.dealer ? 'Pick it up' : 'Order it up'}
          </button>
          <button class="btn" onclick={() => table.send({ type: 'pass' })}>Pass</button>
          {#if v.allowAlone}
            <label class="check tiny"><input type="checkbox" bind:checked={alone} /> go alone</label>
          {/if}
        </div>
      {/if}

      {#if myTurn && v.phase === 'bid2'}
        <div class="row wrap">
          {#each SUITS.filter((s) => s !== v.turnedDown) as suit (suit)}
            <button class="btn" class:red={suit === 'H' || suit === 'D'} onclick={() => table.send({ type: 'call', suit, alone })}>
              {SUIT_SYMBOLS[suit]} {SUIT_NAMES[suit]}
            </button>
          {/each}
          {#if !(v.stickTheDealer && v.seat === v.dealer)}
            <button class="btn" onclick={() => table.send({ type: 'pass' })}>Pass</button>
          {:else}
            <span class="tiny muted">Stuck — you have to name one.</span>
          {/if}
          {#if v.allowAlone}
            <label class="check tiny"><input type="checkbox" bind:checked={alone} /> go alone</label>
          {/if}
        </div>
      {/if}

      {#if myTurn && v.phase === 'dealerDiscard'}
        <div class="tiny muted">Choose a card to bury.</div>
      {/if}

      <div class="hand">
        {#each v.cards as card (card.id)}
          <PlayingCard
            {card}
            size="lg"
            playable={myTurn && (v.phase === 'dealerDiscard' || (v.phase === 'playing' && v.playable.includes(card.id)))}
            dimmed={myTurn && v.phase === 'playing' && !v.playable.includes(card.id)}
            onclick={() => table.send(v.phase === 'dealerDiscard'
              ? { type: 'discard', cardId: card.id }
              : { type: 'play', cardId: card.id })}
          />
        {/each}
        {#if !v.cards.length}<div class="muted tiny">No cards.</div>{/if}
      </div>
    </section>

    <details class="panel log-panel">
      <summary>Table talk</summary>
      <GameLog log={v.log} />
    </details>
  </div>

  {#if v.phase === 'handEnd' && v.handSummary}
    <div class="overlay fade-in">
      <div class="panel result">
        <h2>Hand {v.handSummary.hand}</h2>
        <p>
          {v.players[v.handSummary.maker].name} called {SUIT_NAMES[v.handSummary.trump]}{v.handSummary.alone ? ' alone' : ''}
          and their side took {v.handSummary.takes[teamOf(v.handSummary.maker)]} of five — {v.handSummary.text}.
        </p>
        <div class="row spread">
          {#each v.teams as team (team.team)}
            <div><span class="tiny muted">{team.names.join(' & ')}</span><div class="num big">{team.score}</div></div>
          {/each}
        </div>
        <button class="btn primary" onclick={() => table.send({ type: 'continue' })}>Next deal</button>
      </div>
    </div>
  {/if}

  {#if v.phase === 'gameOver'}
    <div class="overlay fade-in">
      <div class="panel result center">
        <div class="tag">Euchre</div>
        <h2>{v.winners.map((i) => v.players[i].name).join(' & ')} win</h2>
        <p class="num big">{v.teams[0].score} – {v.teams[1].score}</p>
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
  .red { color: var(--rose); }
  .teams { gap: 1rem; align-items: flex-start; }
  .team { text-align: right; }
  .team.mine .score { color: var(--brass); }
  .score { font-family: var(--serif); font-size: 1.15rem; }
  .trumprow { min-height: 2rem; }
  .seats { display: flex; gap: 0.6rem; flex-wrap: wrap; }
  :global(.seats .seat) { background: color-mix(in srgb, var(--ink) 8%, transparent); }
  .board { position: relative; min-height: 180px; display: grid; place-items: center; padding: 1.1rem; }
  .trick { display: flex; gap: 0.7rem; flex-wrap: wrap; justify-content: center; }
  .played { display: grid; justify-items: center; gap: 0.3rem; }
  .played-name { font-size: 0.72rem; opacity: 0.75; }
  .played.winner :global(.card) { box-shadow: 0 0 0 2px var(--brass-soft), var(--shadow-2); }
  .empty { opacity: 0.5; font-size: 0.85rem; }
  .thinking { position: absolute; bottom: 0.6rem; right: 0.9rem; opacity: 0.6; font-style: italic; }
  .hand { display: flex; gap: 0.45rem; flex-wrap: wrap; min-height: 112px; align-items: flex-end; }
  .check { display: inline-flex; align-items: center; gap: 0.3rem; color: var(--ink-soft); }
  .log-panel summary { cursor: pointer; font-size: 0.85rem; color: var(--ink-soft); }
  .overlay {
    position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: 1rem;
    background: color-mix(in srgb, var(--felt-deep) 78%, transparent); backdrop-filter: blur(4px);
  }
  .result { max-width: 460px; width: 100%; display: grid; gap: 0.8rem; }
  .result.center { justify-items: center; }
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
    .teams { gap: 0.75rem; }
    .team { text-align: left; }
  }
</style>
