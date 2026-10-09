import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { settings } from './lib/stores/settings.svelte.js';

// A free game server sleeps when nobody is playing. Nudge it awake as soon as
// the shelf opens, so it is ready by the time anyone reaches Online.
if (settings.serverUrl) {
  const health = settings.serverUrl.replace(/^ws(s?):/, 'http$1:').replace(/\/$/, '') + '/health';
  fetch(health, { mode: 'no-cors' }).catch(() => {});
}

export default mount(App, { target: document.getElementById('app') });
