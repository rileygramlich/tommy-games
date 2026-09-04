<script>
  import { onMount } from 'svelte';
  import { getGame } from './lib/games/registry.js';
  import { LocalTable } from './lib/stores/localTable.svelte.js';
  import { settings, saveSettings, applyTheme } from './lib/stores/settings.svelte.js';
  import Home from './lib/ui/Home.svelte';
  import Setup from './lib/ui/Setup.svelte';
  import Rules from './lib/ui/Rules.svelte';
  import Settings from './lib/ui/Settings.svelte';
  import Online from './lib/ui/Online.svelte';
  import WizardTable from './lib/games/wizard/WizardTable.svelte';
  import QuiddlerTable from './lib/games/quiddler/QuiddlerTable.svelte';

  const TABLES = { wizard: WizardTable, quiddler: QuiddlerTable };

  let route = $state(parse(location.hash));
  let table = $state(null);
  let tableGame = $state(null);
  let loading = $state(false);
  let loadError = $state('');

  function parse(hash) {
    const parts = (hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean);
    return { screen: parts[0] ?? 'home', arg: parts[1] ?? null };
  }

  function go(hash) {
    if (location.hash === hash) route = parse(hash);
    else location.hash = hash;
  }

  onMount(() => {
    applyTheme();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => { if (settings.theme === 'auto') applyTheme(); };
    media.addEventListener('change', onScheme);
    const onHash = () => { route = parse(location.hash); };
    window.addEventListener('hashchange', onHash);
    return () => {
      media.removeEventListener('change', onScheme);
      window.removeEventListener('hashchange', onHash);
    };
  });

  // Leaving the play screen tears the table down.
  $effect(() => {
    if (route.screen !== 'play' && table) {
      table.destroy();
      table = null;
      tableGame = null;
    }
  });

  async function startLocal(game, { players, options }) {
    loading = true;
    loadError = '';
    try {
      const dict = await game.ready();
      table = new LocalTable({ game, players, options, dict });
      tableGame = game;
    } catch (err) {
      loadError = err.message ?? 'Could not start that game.';
    } finally {
      loading = false;
    }
  }

  const game = $derived(route.arg ? getGame(route.arg) : null);
  const inGame = $derived(route.screen === 'play' && !!table);

  function toggleTheme() {
    const order = ['auto', 'light', 'dark'];
    saveSettings({ theme: order[(order.indexOf(settings.theme) + 1) % order.length] });
  }
</script>

<div class="shell">
  {#if !inGame}
    <header class="masthead spread">
      <button class="brand" onclick={() => go('#/')}>
        <span class="mark" aria-hidden="true">T</span>
        <span>Tommy Games</span>
      </button>
      <nav class="row">
        <button class="btn ghost small" onclick={() => go('#/online')}>Online</button>
        <button class="btn ghost small" onclick={() => go('#/settings')}>Settings</button>
        <button class="btn ghost small" onclick={toggleTheme} aria-label="Change theme">
          {settings.theme === 'dark' ? 'Dark' : settings.theme === 'light' ? 'Light' : 'Auto'}
        </button>
      </nav>
    </header>
  {/if}

  <main class="fade-in">
    {#if route.screen === 'home'}
      <Home {go} />
    {:else if route.screen === 'rules' && game}
      <Rules {game} {go} />
    {:else if route.screen === 'settings'}
      <Settings {go} />
    {:else if route.screen === 'online'}
      <Online {go} />
    {:else if route.screen === 'play' && game}
      {#if table && tableGame?.id === game.id}
        {@const Table = TABLES[game.id]}
        <Table {table} onexit={() => { table.destroy(); table = null; go('#/'); }} />
      {:else if loading}
        <p class="muted center loading">Shuffling…</p>
      {:else}
        {#key game.id}
          <Setup {game} onstart={(config) => startLocal(game, config)} oncancel={() => go('#/')} />
        {/key}
        {#if loadError}<p class="err center">{loadError}</p>{/if}
      {/if}
    {:else}
      <div class="center stack lost">
        <h1>Nothing dealt here</h1>
        <button class="btn primary" onclick={() => go('#/')}>Back to the shelf</button>
      </div>
    {/if}
  </main>

  {#if !inGame}
    <footer class="foot muted">
      <span>Tommy Games</span>
      <span>·</span>
      <span>Quiddler and Wizard are the property of their respective publishers; this is a fan-made table for playing them.</span>
    </footer>
  {/if}
</div>

<style>
  .masthead { padding: 0.5rem 0 1rem; }
  .brand {
    display: flex; align-items: center; gap: 0.55rem;
    background: none; border: 0; cursor: pointer; padding: 0;
    font-family: var(--serif); font-size: 1.1rem; color: var(--ink);
  }
  .mark {
    display: grid; place-items: center;
    width: 30px; height: 30px; border-radius: 8px;
    background: linear-gradient(160deg, var(--felt-line), var(--felt-deep));
    color: var(--brass-soft); font-weight: 600;
  }
  .loading { padding: 4rem 0; font-style: italic; }
  .err { color: var(--rose); }
  .lost { padding: 4rem 0; justify-items: center; }
  .foot {
    margin-top: 3rem; padding-top: 1rem;
    border-top: 1px solid var(--paper-3);
    font-size: 0.74rem; display: flex; gap: 0.4rem; flex-wrap: wrap;
  }
</style>
