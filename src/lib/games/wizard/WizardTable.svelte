<script>
  import PlayingCard from '../../components/PlayingCard.svelte';
  import Seat from '../../components/Seat.svelte';
  import GameLog from '../../components/GameLog.svelte';
  import Curtain from '../../components/Curtain.svelte';
  import { SUITS, SUIT_NAMES, SUIT_SYMBOLS } from './deck.js';

  let { table, onexit } = $props();

  const v = $derived(table.view);
  const me = $derived(v ? v.players[v.seat] : null);
  const myTurn = $derived(!!v && v.turn === v.seat && ['bidding', 'playing', 'chooseTrump'].includes(v.phase));
  const others = $derived(v ? v.players.filter((p) => p.seat !== v.seat) : []);
  const bidTotal = $derived(v ? v.players.reduce((sum, p) => sum + (p.bid ?? 0), 0) : 0);
  const shownTrick = $derived(v && v.phase === 'trickEnd' && v.lastTrick ? v.lastTrick.plays : (v?.trick ?? []));
  const trickWinner = $derived(v && v.phase === 'trickEnd' ? v.lastTrick?.winner : null);

  function statusLine() {
    if (!v) return '';
    if (v.phase === 'gameOver') return 'Game over';
    if (v.phase === 'chooseTrump') return v.turn === v.seat ? 'A Wizard turned up — call the trump suit' : `${v.players[v.turn].name} is calling trump`;
    if (v.phase === 'bidding') return v.turn === v.seat ? 'How many tricks will you take?' : `${v.players[v.turn].name} is bidding`;
    if (v.phase === 'trickEnd') return `${v.players[v.lastTrick.winner].name} takes the trick`;
    if (v.phase === 'roundEnd') return `Round ${v.round} scored`;
    if (v.turn !== v.seat) return `${v.players[v.turn].name} to play`;
    if (!v.trick.length) return 'Your lead';
    return v.ledSuit ? `Your turn — ${SUIT_NAMES[v.ledSuit]} were led` : 'Your turn';
  }

  function seatDetail(p) {
    if (v.phase === 'bidding' || v.phase === 'chooseTrump') {
      return p.bid == null ? `${p.cards} cards` : `bid ${p.bid}`;
    }
    return `${p.tricks}/${p.bid ?? '–'} tricks · ${p.score} pts`;
  }
</script>

{#if v}
  <div class="table-shell">
    <header class="spread top">
      <div class="row">
        <button class="btn ghost small" onclick={onexit}>← Leave</button>
        <div>
          <div class="round">Round {v.round} <span class="muted">of {v.rounds}</span></div>
          <div class="status">{statusLine()}</div>
        </div>
      </div>
      <div class="row trump">
        <div class="trump-label">
          <div class="muted tiny">Trump</div>
          <div class="trump-name">
            {#if v.trumpSuit}
              <span class:red={v.trumpSuit === 'H' || v.trumpSuit === 'D'}>{SUIT_SYMBOLS[v.trumpSuit]} {SUIT_NAMES[v.trumpSuit]}</span>
            {:else}
              None
            {/if}
          </div>
        </div>
        {#if v.trumpCard}<PlayingCard card={v.trumpCard} size="sm" />{/if}
      </div>
    </header>

    <div class="seats">
      {#each others as p (p.seat)}
        <Seat
          player={p}
          active={v.turn === p.seat && v.phase !== 'roundEnd'}
          dealer={v.dealer === p.seat}
          detail={seatDetail(p)}
          badge={v.phase === 'playing' || v.phase === 'trickEnd' ? p.tricks : null}
        />
      {/each}
    </div>

    <section class="felt board">
      {#if v.phase === 'bidding' || v.phase === 'chooseTrump'}
        <div class="bid-summary fade-in">
          <div class="tiny muted">Bids so far</div>
          <div class="bid-total num">{bidTotal} <span class="muted">/ {v.round} tricks</span></div>
          {#if v.hookRule}<div class="tiny muted">Dealer may not make it even</div>{/if}
        </div>
      {/if}

      <div class="trick">
        {#each shownTrick as play (play.card.id)}
          <div class="played deal-in" class:winner={trickWinner === play.seat}>
            <PlayingCard card={play.card} />
            <div class="played-name">{v.players[play.seat].name}</div>
          </div>
        {/each}
        {#if !shownTrick.length}
          <div class="empty muted">
            {v.phase === 'bidding' || v.phase === 'chooseTrump' ? 'Bidding' : 'No cards played yet'}
          </div>
        {/if}
      </div>

      {#if table.thinking}<div class="thinking tiny">thinking…</div>{/if}
    </section>

    <section class="you">
      <div class="spread you-head">
        <div class="row">
          <strong>{me.name}</strong>
          <span class="muted tiny">
            {#if me.bid != null}bid {me.bid} · won {me.tricks}{:else}no bid yet{/if} · {me.score} pts
          </span>
        </div>
        {#if table.error}<span class="err tiny">{table.error}</span>{/if}
      </div>

      {#if v.phase === 'chooseTrump' && myTurn}
        <div class="row wrap actions">
          {#each SUITS as suit (suit)}
            <button class="btn" class:red={suit === 'H' || suit === 'D'} onclick={() => table.send({ type: 'chooseTrump', suit })}>
              {SUIT_SYMBOLS[suit]} {SUIT_NAMES[suit]}
            </button>
          {/each}
        </div>
      {/if}

      {#if v.phase === 'bidding' && myTurn}
        <div class="row wrap actions">
          <span class="muted tiny">Your bid:</span>
          {#each Array.from({ length: v.round + 1 }, (_, i) => i) as n (n)}
            <button class="btn small" disabled={!v.legalBids.includes(n)} onclick={() => table.send({ type: 'bid', bid: n })}>{n}</button>
          {/each}
        </div>
      {/if}

      <div class="hand">
        {#each v.hand as card (card.id)}
          <PlayingCard
            {card}
            size="lg"
            playable={myTurn && v.phase === 'playing' && v.playable.includes(card.id)}
            dimmed={v.phase === 'playing' && myTurn && !v.playable.includes(card.id)}
            onclick={() => table.send({ type: 'play', cardId: card.id })}
          />
        {/each}
        {#if !v.hand.length}<div class="muted tiny">Hand played out.</div>{/if}
      </div>
    </section>

    <details class="panel log-panel">
      <summary>Table talk</summary>
      <GameLog log={v.log} />
    </details>
  </div>

  {#if v.phase === 'roundEnd'}
    <div class="overlay fade-in">
      <div class="panel sheet">
        <h2>Round {v.round}</h2>
        <table class="score">
          <thead><tr><th>Player</th><th>Bid</th><th>Took</th><th>Round</th><th>Total</th></tr></thead>
          <tbody>
            {#each v.scoreboard[v.scoreboard.length - 1].bids as bid, i (i)}
              <tr>
                <td>{v.players[i].name}</td>
                <td class="num">{bid}</td>
                <td class="num">{v.scoreboard[v.scoreboard.length - 1].tricks[i]}</td>
                <td class="num" class:good={v.scoreboard[v.scoreboard.length - 1].deltas[i] > 0} class:bad={v.scoreboard[v.scoreboard.length - 1].deltas[i] < 0}>
                  {v.scoreboard[v.scoreboard.length - 1].deltas[i] > 0 ? '+' : ''}{v.scoreboard[v.scoreboard.length - 1].deltas[i]}
                </td>
                <td class="num strong">{v.scoreboard[v.scoreboard.length - 1].totals[i]}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <button class="btn primary" onclick={() => table.send({ type: 'continue' })}>
          {v.round >= v.rounds ? 'Final scores' : `Deal round ${v.round + 1}`}
        </button>
      </div>
    </div>
  {/if}

  {#if v.phase === 'gameOver'}
    <div class="overlay fade-in">
      <div class="panel sheet center">
        <div class="tag">Wizard</div>
        <h2>{v.winners.map((i) => v.players[i].name).join(' & ')} {v.winners.length > 1 ? 'tie' : 'wins'}</h2>
        <table class="score">
          <tbody>
            {#each [...v.players].sort((a, b) => b.score - a.score) as p (p.seat)}
              <tr><td>{p.name}</td><td class="num strong">{p.score}</td></tr>
            {/each}
          </tbody>
        </table>
        <button class="btn primary" onclick={onexit}>Back to the shelf</button>
      </div>
    </div>
  {/if}

  {#if table.curtain}
    <Curtain name={table.curtain.name} onreveal={() => table.reveal()} />
  {/if}
{/if}

<style>
  .table-shell { display: grid; gap: 0.9rem; }
  .top { align-items: flex-start; }
  .round { font-family: var(--serif); font-size: 1.15rem; }
  .status { font-size: 0.85rem; color: var(--ink-soft); }
  .tiny { font-size: 0.75rem; }
  .trump { gap: 0.6rem; }
  .trump-label { text-align: right; }
  .trump-name { font-family: var(--serif); }
  .red { color: var(--rose); }

  .seats { display: flex; gap: 0.6rem; flex-wrap: wrap; }
  :global(.seats .seat) { background: color-mix(in srgb, var(--ink) 8%, transparent); }

  .board {
    position: relative;
    min-height: 210px;
    display: grid;
    place-items: center;
    padding: 1.2rem;
  }
  .trick { display: flex; gap: 0.7rem; flex-wrap: wrap; justify-content: center; }
  .played { display: grid; justify-items: center; gap: 0.35rem; transition: transform 0.2s ease; }
  .played-name { font-size: 0.72rem; opacity: 0.75; }
  .played.winner { transform: translateY(-6px); }
  .played.winner :global(.card) { box-shadow: 0 0 0 2px var(--brass-soft), var(--shadow-2); }
  .empty { opacity: 0.5; font-size: 0.85rem; }

  .bid-summary { position: absolute; top: 0.7rem; left: 0.9rem; text-align: left; }
  .bid-total { font-family: var(--serif); font-size: 1.2rem; }
  .thinking { position: absolute; bottom: 0.6rem; right: 0.9rem; opacity: 0.6; font-style: italic; }

  .you { display: grid; gap: 0.6rem; }
  .you-head { align-items: baseline; }
  .actions { gap: 0.35rem; }
  .hand { display: flex; gap: 0.45rem; flex-wrap: wrap; min-height: 112px; align-items: flex-end; }
  .err { color: var(--rose); }

  .log-panel summary { cursor: pointer; font-size: 0.85rem; color: var(--ink-soft); }

  .overlay {
    position: fixed; inset: 0; z-index: 30;
    display: grid; place-items: center; padding: 1rem;
    background: color-mix(in srgb, var(--felt-deep) 78%, transparent);
    backdrop-filter: blur(4px);
  }
  .sheet { max-width: 460px; width: 100%; display: grid; gap: 0.9rem; justify-items: stretch; }
  .sheet.center { justify-items: center; }
  .score { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .score th { text-align: right; font-weight: 500; color: var(--ink-faint); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .score th:first-child, .score td:first-child { text-align: left; }
  .score td { text-align: right; padding: 0.25rem 0.3rem; border-top: 1px solid var(--paper-3); }
  .strong { font-weight: 700; }
  .good { color: #2f7d55; }
  .bad { color: var(--rose); }
</style>
