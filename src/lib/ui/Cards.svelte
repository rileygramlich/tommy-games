<script>
  // A gallery of every card face on the shelf. Not linked from anywhere — it is
  // here so card art can be checked without dealing hands until one shows up.
  import PlayingCard from '../components/PlayingCard.svelte';
  import LetterCard from '../components/LetterCard.svelte';
  import { buildDeck as wizardDeck } from '../games/wizard/deck.js';
  import { LETTERS } from '../games/quiddler/deck.js';

  let { go } = $props();

  const deck = wizardDeck();
  const specials = [deck.find((c) => c.kind === 'wizard'), deck.find((c) => c.kind === 'jester')];
  const court = ['S14', 'H13', 'D12', 'C11', 'H10', 'S2'].map((id) => deck.find((c) => c.id === id));
  const letters = LETTERS.map((l, i) => ({ id: `g${i}`, letters: l.letters, value: l.value }));
</script>

<div class="gallery stack">
  <div class="spread">
    <h1>Card gallery</h1>
    <button class="btn ghost small" onclick={() => go('#/')}>← Shelf</button>
  </div>

  <section class="stack">
    <h2>Wizard deck</h2>
    <div class="row wrap">
      {#each specials as card (card.id)}<PlayingCard {card} size="lg" />{/each}
      {#each court as card (card.id)}<PlayingCard {card} size="lg" />{/each}
      <PlayingCard faceDown size="lg" />
    </div>
    <div class="row wrap">
      {#each specials as card (card.id)}<PlayingCard {card} size="sm" />{/each}
      {#each court as card (card.id)}<PlayingCard {card} size="sm" />{/each}
    </div>
  </section>

  <section class="stack">
    <h2>Quiddler deck</h2>
    <div class="row wrap">
      {#each letters as card (card.id)}<LetterCard {card} />{/each}
      <LetterCard faceDown />
    </div>
  </section>
</div>

<style>
  .gallery { max-width: 900px; margin: 1.5rem auto; }
  h2 { font-size: 1.05rem; }
  section { padding-top: 0.8rem; border-top: 1px solid var(--paper-3); }

  @media (max-width: 640px) {
    .gallery { gap: 0.6rem; }
  }
</style>
