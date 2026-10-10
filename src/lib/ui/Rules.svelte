<script>
  import { LETTERS } from '../games/quiddler/deck.js';
  import { SETS, CHARACTER_LIST } from '../games/coup/characters.js';
  import CheatSheet from '../games/coup/CheatSheet.svelte';
  import { ART } from '../art.js';
  let { game, go } = $props();

  // Who painted the pictures on this game's cards.
  const ART_FOR = {
    coup: CHARACTER_LIST.map((c) => [c.name, c.key]),
    wizard: [['Wizard', 'wizard'], ['Jester', 'jester']]
  };
  const credits = $derived((ART_FOR[game.id] ?? []).map(([role, key]) => ({ role, ...ART[key] })));
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

  {#if game.id === 'coup'}
    <section>
      <h2>Cheat sheet</h2>
      <CheatSheet characters={SETS.classic.characters} />
    </section>
  {/if}

  {#if credits.length}
    <section class="credits">
      <h2>The pictures on the cards</h2>
      <p class="muted">Public-domain paintings, cropped to fit. None of them is the art of the published game.</p>
      <ul>
        {#each credits as c (c.role)}
          <li><b>{c.role}</b> — <a href={c.page} target="_blank" rel="noopener">{c.title}</a>, {c.artist}, {c.year}. {c.museum}.</li>
        {/each}
      </ul>
    </section>
  {/if}

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
  .credits ul { margin: 0.2rem 0 0; padding-left: 1.1rem; display: grid; gap: 0.25rem; font-size: 0.8rem; }
  .credits p { margin: 0; font-size: 0.8rem; }
</style>
