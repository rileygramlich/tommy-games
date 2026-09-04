<script>
  import { settings, saveSettings } from '../stores/settings.svelte.js';
  let { go } = $props();

  let serverUrl = $state(settings.serverUrl);
  let saved = $state(false);

  function save() {
    saveSettings({ serverUrl: serverUrl.trim() });
    saved = true;
    setTimeout(() => (saved = false), 1600);
  }
</script>

<div class="stack settings">
  <div class="spread">
    <h1>Settings</h1>
    <button class="btn ghost small" onclick={() => go('#/')}>← Shelf</button>
  </div>

  <div class="panel stack">
    <label class="field">
      <span>Your name</span>
      <input type="text" value={settings.name} oninput={(e) => saveSettings({ name: e.currentTarget.value })} placeholder="You" />
    </label>

    <label class="field">
      <span>Theme</span>
      <select value={settings.theme} onchange={(e) => saveSettings({ theme: e.currentTarget.value })}>
        <option value="auto">Match my device</option>
        <option value="light">Warm paper</option>
        <option value="dark">Lamplit felt</option>
      </select>
    </label>

    <label class="field">
      <span>Bot pace</span>
      <select value={settings.botSpeed} onchange={(e) => saveSettings({ botSpeed: e.currentTarget.value })}>
        <option value="brisk">Brisk</option>
        <option value="normal">Normal</option>
        <option value="relaxed">Relaxed</option>
      </select>
    </label>
  </div>

  <div class="panel stack">
    <div>
      <strong class="small-head">Online play</strong>
      <p class="muted tiny">
        GitHub Pages can only serve files, so games with friends need a small game server running
        somewhere. Point this at yours — <code>wss://your-server</code> — or run
        <code>npm run server</code> and use <code>ws://localhost:8787</code>.
      </p>
    </div>
    <label class="field">
      <span>Server address</span>
      <input type="text" bind:value={serverUrl} placeholder="wss://tommy-games.example.com" />
    </label>
    <div class="row">
      <button class="btn primary" onclick={save}>Save</button>
      {#if saved}<span class="tiny muted fade-in">Saved.</span>{/if}
    </div>
  </div>
</div>

<style>
  .settings { max-width: 560px; margin: 1.5rem auto; }
  .field { display: grid; gap: 0.3rem; font-size: 0.88rem; }
  .field > span { color: var(--ink-soft); }
  .small-head { font-family: var(--serif); font-size: 1rem; }
  .tiny { font-size: 0.78rem; }
  code { background: var(--paper-3); padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.9em; }
</style>
