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

  <p class="muted lead">
    {game.minPlayers === game.maxPlayers ? `${game.minPlayers} players` : `${game.minPlayers}–${game.maxPlayers} players`}
    · {game.length}
  </p>

  {#each game.rules as section (section.title)}
    <section>
      <h2>{section.title}</h2>
      <p>{section.text}</p>
      {#if game.id === 'quiddler' && section.title === 'The deck'}
        <div class="values">
          {#each LETTERS as l (l.letters)}
            <span class="val"><b>{l.letters.toUpperCase()}</b>{l.value}</span>
          {/each}
        </div>
      {/if}
    </section>
  {/each}

  <div class="row wrap">
    <button class="btn primary" onclick={() => go(`#/play/${game.id}`)}>Play {game.name}</button>
    <button class="btn ghost small" onclick={() => go('#/')}>Something else</button>
  </div>
</article>

<style>
  .rules { max-width: 640px; margin: 1.5rem auto; display: grid; gap: 1.3rem; }
  .rules h1 { font-size: clamp(1.4rem, 4vw, 2rem); margin-top: 0.4rem; }
  .lead { margin: 0; font-size: 0.85rem; }
  section { display: grid; gap: 0.3rem; }
  section h2 { font-size: 1.05rem; }
  .values { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem; }
  .val {
    display: inline-flex; gap: 0.35em; align-items: baseline;
    background: var(--paper-2); border: 1px solid var(--card-edge); border-radius: 6px;
    padding: 0.15em 0.45em; font-size: 0.78rem; font-family: var(--tabular);
  }
  .val b { font-family: var(--serif); font-size: 0.9rem; }
</style>
