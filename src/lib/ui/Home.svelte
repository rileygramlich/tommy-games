<script>
  import { GAME_LIST } from '../games/registry.js';
  let { go } = $props();
</script>

<section class="hero">
  <div class="tag">Tommy Games</div>
  <h1>A shelf of card games,<br />always dealt and ready.</h1>
  <p>
    Play the bots on your own, pass one device around the table, or deal a hand with friends
    over the internet. No installs, no accounts unless you want one.
  </p>
</section>

<div class="grid">
  {#each GAME_LIST as game (game.id)}
    <article class="game panel" style="--accent: {game.accent}">
      <div class="spine" aria-hidden="true"></div>
      <div class="body">
        <h2>{game.name}</h2>
        <p class="tagline">{game.tagline}</p>
        <p class="blurb">{game.blurb}</p>
        <div class="meta tiny muted">
          {game.minPlayers === game.maxPlayers ? `${game.minPlayers} players` : `${game.minPlayers}–${game.maxPlayers} players`} · {game.length}
        </div>
        <div class="row wrap">
          <button class="btn primary" onclick={() => go(`#/play/${game.id}`)}>Play</button>
          <button class="btn ghost small" onclick={() => go(`#/rules/${game.id}`)}>How it works</button>
        </div>
      </div>
    </article>
  {/each}

  <article class="game panel coming">
    <div class="body">
      <h2>Something else</h2>
      <p class="blurb">
        The shelf has room. Each game is a rules engine plus a table screen, so the next one
        drops in beside these two.
      </p>
      <div class="meta tiny muted">Suggestions welcome</div>
    </div>
  </article>
</div>

<style>
  .hero { max-width: 40rem; margin: 2rem 0 2.4rem; }
  .hero h1 { margin: 0.5rem 0 0.8rem; }
  .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  .game { display: flex; padding: 0; overflow: hidden; }
  .spine { width: 10px; background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 55%, black)); }
  .body { padding: 1.1rem 1.2rem; display: grid; gap: 0.5rem; align-content: start; }
  .tagline { font-family: var(--serif); font-size: 1rem; color: var(--ink); margin: 0; }
  .blurb { margin: 0; font-size: 0.9rem; }
  .meta { margin-bottom: 0.3rem; }
  .tiny { font-size: 0.75rem; }
  .coming { border-style: dashed; background: transparent; box-shadow: none; }
</style>
