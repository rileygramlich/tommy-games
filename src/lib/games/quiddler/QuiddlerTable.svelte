<script>
  import LetterCard from '../../components/LetterCard.svelte';
  import Seat from '../../components/Seat.svelte';
  import GameLog from '../../components/GameLog.svelte';
  import Curtain from '../../components/Curtain.svelte';
  import { getDictionary } from './engine.js';
  import { planTurn } from './bot.js';

  let { table, onexit } = $props();

  const v = $derived(table.view);
  const me = $derived(v ? v.players[v.seat] : null);
  const myTurn = $derived(!!v && v.turn === v.seat && ['draw', 'discard'].includes(v.phase));
  const others = $derived(v ? v.players.filter((p) => p.seat !== v.seat) : []);

  // Turn workspace: one card goes to the discard slot, the rest can be spelled out.
  let held = $state(null);
  let discardId = $state(null);
  let words = $state([[]]);
  let notice = $state('');

  const byId = $derived(new Map((v?.hand ?? []).map((c) => [c.id, c])));
  const placed = $derived(new Set([...(discardId ? [discardId] : []), ...words.flat()]));
  const handCards = $derived((v?.hand ?? []).filter((c) => !placed.has(c.id)));
  const discardCard = $derived(discardId ? byId.get(discardId) : null);

  // Reset the workspace whenever the hand changes underneath us (new turn, new round).
  let signature = $derived(`${v?.round}:${v?.phase}:${(v?.hand ?? []).map((c) => c.id).join(',')}`);
  let lastSignature = '';
  $effect(() => {
    if (signature !== lastSignature) {
      lastSignature = signature;
      held = null;
      discardId = null;
      words = [[]];
      notice = '';
    }
  });

  function letters(ids) {
    return ids.map((id) => byId.get(id)?.letters ?? '').join('');
  }
  function wordValue(ids) {
    return ids.reduce((sum, id) => sum + (byId.get(id)?.value ?? 0), 0);
  }
  function wordState(ids) {
    if (!ids.length) return 'empty';
    const text = letters(ids);
    if (text.length < 2) return 'short';
    const dict = getDictionary();
    if (!dict) return 'unknown';
    return dict.has(text) ? 'valid' : 'invalid';
  }

  const filledWords = $derived(words.filter((w) => w.length));
  const allWordsValid = $derived(filledWords.every((w) => wordState(w) === 'valid'));
  const usesEverything = $derived(discardId != null && handCards.length === 0 && filledWords.length > 0);
  const leftoverValue = $derived(handCards.reduce((sum, c) => sum + c.value, 0));

  function pick(id) {
    held = held === id ? null : id;
    notice = '';
  }
  function slotClick() {
    if (held) {
      const previous = discardId; // swapping puts the old card back in your hand
      discardId = held;
      held = previous ?? null;
    } else if (discardId) {
      discardId = null;
    } else {
      notice = 'Pick a card first.';
    }
  }
  function toWord(index) {
    if (!held) { notice = 'Pick a card first.'; return; }
    words[index] = [...words[index], held];
    held = null;
    if (words[words.length - 1].length) words = [...words, []];
  }
  function removeFromWord(index, id) {
    words[index] = words[index].filter((c) => c !== id);
    words = words.filter((w, i) => w.length || i === words.length - 1);
    if (!words.length) words = [[]];
  }
  function clearWorkspace() {
    words = [[]];
    discardId = null;
    held = null;
    notice = '';
  }
  function arrangeForMe() {
    const dict = getDictionary();
    if (!dict) return;
    const plan = planTurn(v.hand, dict);
    discardId = plan.discardId;
    const chosen = plan.canGoOut && !v.mustLayDown ? plan.result.goOutWords : plan.result.words;
    words = [...chosen.map((w) => [...w.cardIds]), []];
    held = null;
    notice = v.mustLayDown
      ? 'Best arrangement for what you are holding.'
      : plan.canGoOut ? 'That hand can go out.' : 'Best arrangement — the rest would be left over.';
  }

  function submit(goOut) {
    if (!discardId) { notice = 'Choose a card to discard.'; return; }
    const move = { type: 'discard', cardId: discardId };
    if (goOut || v.mustLayDown) move.layout = { words: filledWords.map((w) => [...w]) };
    const result = table.send(move);
    if (result && !result.ok) notice = result.error;
  }

  function statusLine() {
    if (!v) return '';
    if (v.phase === 'gameOver') return 'Game over';
    if (v.phase === 'roundEnd') return `Round ${v.round} scored`;
    if (v.goneOut != null && v.goneOut !== v.seat) return `${v.players[v.goneOut].name} went out — last turn each`;
    if (!myTurn) return `${v.players[v.turn].name} is ${v.phase === 'draw' ? 'drawing' : 'thinking'}`;
    return v.phase === 'draw' ? 'Draw a card' : 'Discard one card — and spell out the rest if you can';
  }
</script>

{#if v}
  <div class="table-shell">
    <header class="spread top">
      <div class="row">
        <button class="btn ghost small" onclick={onexit}>← Leave</button>
        <div>
          <div class="round">Round {v.round} <span class="muted">of {v.rounds} · {v.handSize} cards</span></div>
          <div class="status">{statusLine()}</div>
        </div>
      </div>
      <div class="piles">
        <button
          class="pile"
          disabled={!(myTurn && v.phase === 'draw')}
          onclick={() => table.send({ type: 'draw', from: 'deck' })}
        >
          <LetterCard faceDown size="sm" />
          <span class="tiny">Deck · {v.drawPile}</span>
        </button>
        <button
          class="pile"
          disabled={!(myTurn && v.phase === 'draw' && v.discardTop)}
          onclick={() => table.send({ type: 'draw', from: 'discard' })}
        >
          <LetterCard card={v.discardTop} size="sm" />
          <span class="tiny">Discard</span>
        </button>
      </div>
    </header>

    <div class="seats">
      {#each others as p (p.seat)}
        <Seat
          player={p}
          active={v.turn === p.seat && v.phase !== 'roundEnd'}
          dealer={v.dealer === p.seat}
          detail={p.finished ? (p.layout?.words.map((w) => w.word).join(' · ') || 'laid down') : `${p.cards} cards · ${p.score} pts`}
        />
      {/each}
    </div>

    <section class="felt board">
      <div class="zones">
        <div class="zone">
          <div class="zone-head tiny">Discard</div>
          <button class="slot" class:armed={!!held} onclick={slotClick}>
            {#if discardCard}
              <LetterCard card={discardCard} />
            {:else}
              <span class="placeholder">drop one card</span>
            {/if}
          </button>
        </div>

        <div class="zone grow">
          <div class="zone-head tiny">
            Words
            {#if filledWords.length}
              <span class="muted">· {filledWords.reduce((s, w) => s + wordValue(w), 0)} pts</span>
            {/if}
            {#if handCards.length && filledWords.length}
              <span class="muted">· {leftoverValue} left over</span>
            {/if}
          </div>
          <div class="words">
            {#each words as word, i (i)}
              <button class="wordrow {wordState(word)}" class:armed={!!held} onclick={() => toWord(i)}>
                {#if word.length}
                  <span class="wordcards">
                    {#each word as id (id)}
                      <span
                        class="chip"
                        role="button"
                        tabindex="0"
                        onclick={(e) => { e.stopPropagation(); removeFromWord(i, id); }}
                        onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); removeFromWord(i, id); } }}
                      >{byId.get(id)?.letters.toUpperCase()}</span>
                    {/each}
                  </span>
                  <span class="wordtext">{letters(word)} <span class="num">{wordValue(word)}</span></span>
                {:else}
                  <span class="placeholder">{words.length > 1 ? 'another word' : 'tap a card, then tap here'}</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      </div>
      {#if table.thinking}<div class="thinking tiny">thinking…</div>{/if}
    </section>

    <section class="you">
      <div class="spread you-head">
        <div class="row">
          <strong>{me.name}</strong>
          <span class="muted tiny">{me.score} pts{v.mustLayDown ? ' · last turn' : ''}</span>
        </div>
        <span class="tiny" class:err={!!table.error}>{notice || table.error}</span>
      </div>

      <div class="hand">
        {#each handCards as card (card.id)}
          <LetterCard
            {card}
            size="lg"
            playable={myTurn}
            selected={held === card.id}
            onclick={() => pick(card.id)}
          />
        {/each}
        {#if !handCards.length}<div class="muted tiny">Every card is placed.</div>{/if}
      </div>

      {#if myTurn && v.phase === 'discard'}
        <div class="row wrap actions">
          {#if v.mustLayDown}
            <button class="btn primary" disabled={!discardId || !allWordsValid} onclick={() => submit(false)}>
              {filledWords.length ? `Lay down ${filledWords.length} word${filledWords.length > 1 ? 's' : ''}` : 'Lay down nothing'}
            </button>
          {:else if usesEverything && allWordsValid}
            <button class="btn brass" onclick={() => submit(true)}>Go out!</button>
          {:else}
            <button class="btn primary" disabled={!discardId} onclick={() => submit(false)}>Discard &amp; pass</button>
          {/if}
          <button class="btn small" onclick={arrangeForMe}>Arrange for me</button>
          <button class="btn ghost small" onclick={clearWorkspace}>Clear</button>
          {#if filledWords.length && !usesEverything && !v.mustLayDown}
            <span class="tiny muted">Going out needs every card in a word.</span>
          {/if}
          {#if !allWordsValid}
            <span class="tiny err">Not every word is in the word list.</span>
          {/if}
        </div>
      {/if}
    </section>

    <details class="panel log-panel">
      <summary>Table talk</summary>
      <GameLog log={v.log} />
    </details>
  </div>

  {#if v.phase === 'roundEnd' && v.roundSummary}
    <div class="overlay fade-in">
      <div class="panel sheet">
        <h2>Round {v.roundSummary.round}</h2>
        {#if v.roundSummary.goneOut != null}
          <p class="tiny muted">{v.players[v.roundSummary.goneOut].name} went out first.</p>
        {/if}
        <div class="summary">
          {#each v.roundSummary.rows as row (row.seat)}
            <div class="srow">
              <div class="spread">
                <strong>{row.name}</strong>
                <span class="num" class:good={row.delta > 0} class:bad={row.delta < 0}>
                  {row.delta > 0 ? '+' : ''}{row.delta} → {row.total}
                </span>
              </div>
              <div class="tiny muted">
                {#if row.words.length}{row.words.map((w) => `${w.word} (${w.value})`).join(', ')}{:else}no words{/if}
                {#if row.leftoverValue}· −{row.leftoverValue} left over{/if}
                {#if row.bonus}· +{row.bonus} bonus{/if}
              </div>
            </div>
          {/each}
        </div>
        <button class="btn primary" onclick={() => table.send({ type: 'continue' })}>
          {v.round >= v.rounds ? 'Final scores' : `Deal round ${v.round + 1}`}
        </button>
      </div>
    </div>
  {/if}

  {#if v.phase === 'gameOver'}
    <div class="overlay fade-in">
      <div class="panel sheet center">
        <div class="tag">Quiddler</div>
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
  .err { color: var(--rose); }

  .piles { display: flex; gap: 0.5rem; }
  .pile {
    display: grid; justify-items: center; gap: 0.3rem;
    background: none; border: 0; padding: 0.2rem; border-radius: var(--radius-sm); cursor: pointer;
  }
  .pile:disabled { cursor: default; opacity: 0.75; }
  .pile:not(:disabled):hover { background: color-mix(in srgb, var(--brass) 16%, transparent); }

  .seats { display: flex; gap: 0.6rem; flex-wrap: wrap; }
  :global(.seats .seat) { background: color-mix(in srgb, var(--ink) 8%, transparent); }

  .board { position: relative; padding: 1rem; min-height: 180px; }
  .zones { display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
  .zone { display: grid; gap: 0.35rem; }
  .zone.grow { flex: 1; min-width: 260px; }
  .zone-head { opacity: 0.7; letter-spacing: 0.08em; text-transform: uppercase; }

  .slot {
    display: grid; place-items: center;
    min-width: 84px; min-height: 100px;
    border: 1px dashed color-mix(in srgb, #f0e6d2 40%, transparent);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, black 12%, transparent);
    color: inherit; cursor: pointer;
  }
  .slot.armed, .wordrow.armed { border-color: var(--brass-soft); background: color-mix(in srgb, var(--brass) 14%, transparent); }
  .placeholder { font-size: 0.72rem; opacity: 0.55; padding: 0 0.6rem; }

  .words { display: grid; gap: 0.4rem; }
  .wordrow {
    display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
    min-height: 44px; padding: 0.35rem 0.6rem;
    border: 1px dashed color-mix(in srgb, #f0e6d2 34%, transparent);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, black 12%, transparent);
    color: inherit; cursor: pointer; text-align: left;
  }
  .wordrow.valid { border-style: solid; border-color: #6fbf94; background: color-mix(in srgb, #6fbf94 16%, transparent); }
  .wordrow.invalid, .wordrow.short { border-style: solid; border-color: color-mix(in srgb, var(--rose) 70%, white 10%); }
  .wordcards { display: flex; gap: 0.25rem; flex-wrap: wrap; }
  .chip {
    display: inline-block; padding: 0.15em 0.45em; border-radius: 6px;
    background: var(--card-face); color: #23201c; font-family: var(--serif); font-size: 0.85rem;
  }
  .chip:hover { background: color-mix(in srgb, var(--rose) 30%, var(--card-face)); }
  .wordtext { font-family: var(--serif); font-size: 0.9rem; opacity: 0.85; }

  .thinking { position: absolute; bottom: 0.6rem; right: 0.9rem; opacity: 0.6; font-style: italic; }

  .you { display: grid; gap: 0.6rem; }
  .you-head { align-items: baseline; }
  .hand { display: flex; gap: 0.4rem; flex-wrap: wrap; min-height: 100px; align-items: flex-end; }
  .actions { gap: 0.4rem; }

  .log-panel summary { cursor: pointer; font-size: 0.85rem; color: var(--ink-soft); }

  .overlay {
    position: fixed; inset: 0; z-index: 30;
    display: grid; place-items: center; padding: 1rem;
    background: color-mix(in srgb, var(--felt-deep) 78%, transparent);
    backdrop-filter: blur(4px);
  }
  .sheet { max-width: 520px; width: 100%; max-height: 86vh; overflow: auto; display: grid; gap: 0.8rem; }
  .sheet.center { justify-items: center; }
  .summary { display: grid; gap: 0.6rem; }
  .srow { border-top: 1px solid var(--paper-3); padding-top: 0.5rem; }
  .score { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  .score td { padding: 0.25rem 0.3rem; border-top: 1px solid var(--paper-3); }
  .score td:last-child { text-align: right; }
  .strong { font-weight: 700; }
  .good { color: #2f7d55; }
  .bad { color: var(--rose); }

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
    .zone.grow { min-width: 0; flex-basis: 100%; }
    .slot { min-width: 68px; min-height: 84px; }
    .wordrow { min-height: 46px; }
    .actions { gap: 0.35rem; }
  }
</style>
