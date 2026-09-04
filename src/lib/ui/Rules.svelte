<script>
  import { LETTERS } from '../games/quiddler/deck.js';
  let { game, go } = $props();
</script>

<article class="rules">
  <div class="spread">
    <div>
      <div class="tag">{game.name}</div>
      <h1>{game.tagline}</h1>
    </div>
    <button class="btn ghost small" onclick={() => go('#/')}>← Shelf</button>
  </div>

  {#if game.id === 'wizard'}
    <section>
      <h2>The deck</h2>
      <p>Sixty cards: a standard fifty-two, plus four Wizards and four Jesters. A Wizard beats
        everything; a Jester loses to everything.</p>
    </section>
    <section>
      <h2>The rounds</h2>
      <p>Round one deals one card each, round two deals two, and so on until the deck runs out —
        twenty rounds with three players, ten with six. After the deal, the next card is turned up
        to set trump. A Jester means no trump; a Wizard means the dealer calls it.</p>
    </section>
    <section>
      <h2>Bidding</h2>
      <p>Starting left of the dealer, everyone announces exactly how many tricks they will take.
        The bids do not have to add up — that is the whole game.</p>
    </section>
    <section>
      <h2>Playing</h2>
      <p>Follow the suit that was led if you can. Wizards and Jesters are always legal. The first
        Wizard played wins the trick; otherwise the highest trump wins, or the highest card of the
        led suit. If a Jester leads, the next real card sets the suit. Four Jesters? The lead wins.</p>
    </section>
    <section>
      <h2>Scoring</h2>
      <p>Hit your bid exactly: <strong>20 points, plus 10 per trick taken</strong>. Miss it by any
        amount: <strong>10 points off for every trick over or under</strong>. Highest score after
        the last round wins.</p>
    </section>
  {:else}
    <section>
      <h2>The deck</h2>
      <p>118 letter cards. Ten of them carry two letters — <em>cl, er, in, qu, th</em> — and still
        count as one card. Every card is worth points:</p>
      <div class="values">
        {#each LETTERS as l (l.letters)}
          <span class="val"><b>{l.letters.toUpperCase()}</b>{l.value}</span>
        {/each}
      </div>
    </section>
    <section>
      <h2>The rounds</h2>
      <p>Eight rounds. The first deals three cards each, the last deals ten. On your turn, draw
        one card — from the deck or the top of the discard pile — then discard one.</p>
    </section>
    <section>
      <h2>Going out</h2>
      <p>When every card left in your hand after discarding can be arranged into words of two
        letters or more, lay them all down and go out. Everyone else gets one final turn, then
        lays down whatever they can.</p>
    </section>
    <section>
      <h2>Scoring</h2>
      <p>Add up the cards in the words you laid down, then subtract the cards you were left
        holding. Two bonuses of <strong>10 points</strong> each round: the longest word, and the
        most words. Highest score after round eight wins.</p>
      <p class="muted tiny">This table judges words against a 52,000-word list of ordinary English —
        no proper nouns, no abbreviations. Two-letter words come from the standard tournament set,
        so <em>qi</em>, <em>za</em> and <em>xu</em> all play.</p>
    </section>
  {/if}

  <div class="row">
    <button class="btn primary" onclick={() => go(`#/play/${game.id}`)}>Play {game.name}</button>
  </div>
</article>

<style>
  .rules { max-width: 640px; margin: 1.5rem auto; display: grid; gap: 1.4rem; }
  .rules h1 { font-size: clamp(1.5rem, 4vw, 2.1rem); margin-top: 0.4rem; }
  section { display: grid; gap: 0.3rem; }
  section h2 { font-size: 1.05rem; }
  .values { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem; }
  .val {
    display: inline-flex; gap: 0.35em; align-items: baseline;
    background: var(--paper-2); border: 1px solid var(--card-edge); border-radius: 6px;
    padding: 0.15em 0.45em; font-size: 0.78rem; font-family: var(--tabular);
  }
  .val b { font-family: var(--serif); font-size: 0.9rem; }
  .tiny { font-size: 0.78rem; }
</style>
