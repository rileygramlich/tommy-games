<script>
  import InfluenceCard from './InfluenceCard.svelte';
  import GameLog from '../../components/GameLog.svelte';
  import Curtain from '../../components/Curtain.svelte';
  import { CHARACTERS, ACTIONS } from './characters.js';

  let { table, onexit } = $props();
  const v = $derived(table.view);
  const me = $derived(v ? v.players[v.seat] : null);
  const myTurn = $derived(!!v && v.phase === 'action' && v.turn === v.seat);
  const myResponse = $derived(v?.myResponses ?? []);

  let armed = $state(null);        // an action waiting for a target
  let keeping = $state([]);        // exchange selection

  const signature = $derived(`${v?.phase}:${v?.turn}:${v?.log.length}`);
  let lastSignature = '';
  $effect(() => {
    if (signature !== lastSignature) { lastSignature = signature; armed = null; keeping = []; }
  });

  // One button per action; targets are picked afterwards.
  const actionKeys = $derived([...new Set((v?.actions ?? []).map((a) => a.action))]);
  const targetsFor = (key) => (v.actions.filter((a) => a.action === key && a.target != null).map((a) => a.target));
  const needsTarget = (key) => v.actions.some((a) => a.action === key && a.target != null);

  function tapAction(key) {
    if (!needsTarget(key)) { table.send({ type: 'action', action: key }); return; }
    armed = armed === key ? null : key;
  }
  function tapTarget(seat) {
    if (!armed) return;
    table.send({ type: 'action', action: armed, target: seat });
    armed = null;
  }
  function toggleKeep(id) {
    if (keeping.includes(id)) keeping = keeping.filter((k) => k !== id);
    else if (keeping.length < v.exchange.keep) keeping = [...keeping, id];
  }

  function actionLabel(key) {
    if (key === 'convert') return 'Convert';
    return ACTIONS[key].label;
  }
  function actionCost(key) {
    if (key === 'coup') return '7';
    if (key === 'assassinate') return '3';
    if (key === 'convert') return '1 / 2';
    return null;
  }

  function status() {
    if (!v) return '';
    if (v.phase === 'gameOver') {
      return v.winners.length > 1
        ? `${v.winners.map((i) => v.players[i].name).join(' & ')} win together`
        : `${v.players[v.winners[0]].name} takes it`;
    }
    if (v.losing) return 'Choose a card to give up';
    if (v.exchange) return `Keep ${v.exchange.keep}`;
    if (v.interrogation) return `${v.players[v.interrogation.target].name} is holding the ${CHARACTERS[v.interrogation.character].name}`;
    if (myResponse.length) return 'Do you believe them?';
    if (v.phase === 'respond') return `Waiting on ${v.players[v.pending.waitingOn].name}`;
    if (v.phase === 'lose') return `${v.players[v.losingSeat].name} is giving up a card`;
    if (myTurn) return armed ? 'Pick a target' : 'Your move';
    return `${v.players[v.turn].name} to move`;
  }

  function claimLine(p) {
    const actor = v.players[p.actor].name;
    const target = p.target != null ? v.players[p.target].name : null;
    if (p.blocker != null) {
      return `${v.players[p.blocker].name} blocks with the ${CHARACTERS[p.blockClaim].name}`;
    }
    if (p.claim) return `${actor} claims the ${CHARACTERS[p.claim].name} — ${p.label}${target ? ` on ${target}` : ''}`;
    return `${actor} asks for ${p.label}`;
  }
</script>

{#if v}
  <div class="stack">
    <header class="spread">
      <div class="row">
        <button class="btn ghost small" onclick={onexit}>← Leave</button>
        <div>
          <div class="title">Coup</div>
          <div class="status">{status()}</div>
        </div>
      </div>
      <div class="row meta tiny muted">
        <span>{v.deckSize} in the deck</span>
        {#if v.factions}<span>· reserve {v.reserve}</span>{/if}
      </div>
    </header>

    <div class="table-seats">
      {#each v.players as p (p.seat)}
        <button
          class="seatcard"
          class:turn={v.turn === p.seat && v.phase !== 'gameOver'}
          class:out={p.out}
          class:you={p.seat === v.seat}
          class:targetable={!!armed && targetsFor(armed).includes(p.seat)}
          disabled={!armed || !targetsFor(armed).includes(p.seat)}
          onclick={() => tapTarget(p.seat)}
        >
          <div class="spread head">
            <span class="name">{p.name}</span>
            <span class="coins num" title="coins">◉ {p.coins}</span>
          </div>
          {#if v.factions}
            <div class="faction f{p.allegiance}">{v.factionNames[p.allegiance]}</div>
          {/if}
          <div class="influences">
            {#each Array(p.influence) as _, i (i)}
              <InfluenceCard faceDown size="sm" />
            {/each}
            {#each p.revealed as character, i (`r${i}`)}
              <InfluenceCard {character} size="sm" dead />
            {/each}
          </div>
          {#if p.out}<span class="tiny muted">out</span>{/if}
        </button>
      {/each}
    </div>

    <section class="felt board">
      {#if v.pending}
        <div class="claim fade-in">
          {#if v.pending.claim && v.pending.blocker == null}
            <InfluenceCard character={v.pending.claim} />
          {:else if v.pending.blockClaim}
            <InfluenceCard character={v.pending.blockClaim} />
          {/if}
          <div class="claim-text">{claimLine(v.pending)}</div>
        </div>
      {:else if v.phase === 'action'}
        <div class="empty muted">{myTurn ? 'Say something.' : 'Watching.'}</div>
      {/if}

      {#if myResponse.length}
        <div class="row wrap responses">
          {#each myResponse as response, i (i)}
            {#if response.type === 'challenge'}
              <button class="btn danger" onclick={() => table.send(response)}>Call the bluff</button>
            {:else if response.type === 'block'}
              <button class="btn" onclick={() => table.send(response)}>Block as {CHARACTERS[response.claim].name}</button>
            {:else}
              <button class="btn primary" onclick={() => table.send(response)}>Let it go</button>
            {/if}
          {/each}
        </div>
      {/if}

      {#if v.losing}
        <div class="prompt">
          <div class="tiny">Which one goes face up?</div>
          <div class="row">
            {#each v.hand as card (card.id)}
              <InfluenceCard character={card.character} onclick={() => table.send({ type: 'reveal', cardId: card.id })} />
            {/each}
          </div>
        </div>
      {/if}

      {#if v.exchange}
        <div class="prompt">
          <div class="tiny">Keep {v.exchange.keep} of these</div>
          <div class="row wrap">
            {#each v.exchange.cards as card (card.id)}
              <InfluenceCard
                character={card.character}
                selected={keeping.includes(card.id)}
                onclick={() => toggleKeep(card.id)}
              />
            {/each}
          </div>
          <button class="btn primary" disabled={keeping.length !== v.exchange.keep}
            onclick={() => table.send({ type: 'keep', cardIds: keeping })}>
            Keep {keeping.length}/{v.exchange.keep}
          </button>
        </div>
      {/if}

      {#if v.interrogation}
        <div class="prompt">
          <div class="tiny">{v.players[v.interrogation.target].name} is holding this</div>
          <InfluenceCard character={v.interrogation.character} />
          <div class="row wrap">
            <button class="btn" onclick={() => table.send({ type: 'interrogation', swap: false })}>Let them keep it</button>
            <button class="btn primary" onclick={() => table.send({ type: 'interrogation', swap: true })}>Make them swap</button>
          </div>
        </div>
      {/if}

      {#if table.thinking}<div class="thinking tiny">thinking…</div>{/if}
    </section>

    <section class="you stack">
      <div class="spread">
        <div class="row">
          <strong>{me.name}</strong>
          <span class="tiny muted">◉ {me.coins} coins</span>
        </div>
        {#if table.error}<span class="tiny err">{table.error}</span>{/if}
      </div>

      <div class="row hand">
        {#each v.hand as card (card.id)}
          <InfluenceCard character={card.character} size="lg" />
        {/each}
        {#each me.revealed as character, i (`r${i}`)}
          <InfluenceCard {character} size="lg" dead />
        {/each}
      </div>

      {#if myTurn}
        <div class="row wrap actions">
          {#each actionKeys as key (key)}
            <button class="btn" class:on={armed === key} onclick={() => tapAction(key)}>
              {actionLabel(key)}
              {#if actionCost(key)}<span class="cost num">◉{actionCost(key)}</span>{/if}
            </button>
          {/each}
        </div>
        {#if armed}
          <div class="tiny muted">Pick who — tap a player above.</div>
        {/if}
      {/if}
    </section>

    <details class="panel log-panel">
      <summary>What was said</summary>
      <GameLog log={v.log} />
    </details>
  </div>

  {#if v.phase === 'gameOver'}
    <div class="overlay fade-in">
      <div class="panel result center">
        <div class="tag">Coup</div>
        <h2>
          {v.winners.map((i) => v.players[i].name).join(' & ')}
          {v.winners.length > 1 ? 'win together' : 'wins'}
        </h2>
        {#if v.factions && v.winners.length > 1}
          <p class="tiny muted">{v.factionNames[v.players[v.winners[0]].allegiance]} — the last side standing.</p>
        {/if}
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

  .table-seats { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .seatcard {
    flex: 1 1 150px;
    display: grid; gap: 0.3rem;
    padding: 0.5rem 0.6rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--card-edge);
    background: var(--paper-2);
    color: inherit;
    text-align: left;
    cursor: default;
  }
  .seatcard.turn { border-color: var(--brass); box-shadow: 0 0 0 1px var(--brass); }
  .seatcard.you { background: color-mix(in srgb, var(--brass) 8%, var(--paper-2)); }
  .seatcard.out { opacity: 0.45; }
  .seatcard.targetable { cursor: pointer; border-color: var(--rose); box-shadow: 0 0 0 2px color-mix(in srgb, var(--rose) 45%, transparent); }
  .seatcard .name { font-family: var(--serif); font-size: 0.95rem; }
  .coins { font-size: 0.82rem; color: var(--brass); }
  .influences { display: flex; gap: 0.2rem; }
  .faction { font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase; }
  .faction.f0 { color: #2f6f9f; }
  .faction.f1 { color: #a8433a; }

  .board { position: relative; min-height: 170px; display: grid; place-items: center; gap: 0.7rem; padding: 1rem; }
  .claim { display: flex; align-items: center; gap: 0.7rem; }
  .claim-text { font-family: var(--serif); font-size: 1rem; max-width: 24rem; }
  .empty { opacity: 0.5; font-size: 0.85rem; }
  .responses { justify-content: center; }
  .prompt { display: grid; gap: 0.5rem; justify-items: center; }
  .thinking { position: absolute; bottom: 0.5rem; right: 0.8rem; opacity: 0.6; font-style: italic; }

  .hand { gap: 0.4rem; flex-wrap: wrap; }
  .actions .on { background: var(--felt); color: #f2e9d6; border-color: var(--felt-deep); }
  .cost { font-size: 0.7rem; opacity: 0.7; margin-left: 0.25em; }

  .log-panel summary { cursor: pointer; font-size: 0.85rem; color: var(--ink-soft); }
  .overlay {
    position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: 1rem;
    background: color-mix(in srgb, var(--felt-deep) 78%, transparent); backdrop-filter: blur(4px);
  }
  .result { max-width: 420px; width: 100%; display: grid; gap: 0.9rem; justify-items: center; }

  @media (max-width: 640px) {
    .seatcard { flex-basis: calc(50% - 0.25rem); padding: 0.4rem 0.5rem; }
    .board { min-height: 0; padding: 0.7rem; }
    .claim-text { font-size: 0.9rem; }
    .overlay { padding: 0.6rem; }
    .result { max-height: 88dvh; overflow-y: auto; }
  }
</style>
