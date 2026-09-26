<script>
  // The shelf's suggestion box.
  //
  // The site is static, so there is no same-origin place to post. It sends to
  // the game server — the process that already exists for online play — and
  // falls back to the issue tracker whenever that server is unset or
  // unreachable, so the button never just fails quietly.
  import { settings } from '../stores/settings.svelte.js';

  const ISSUES = 'https://github.com/rileygramlich/tommy-games/issues/new';
  const MAX = 1000;

  let open = $state(false);
  let text = $state('');
  let from = $state('');
  let website = $state(''); // honeypot: hidden, so only a bot fills it in
  let state_ = $state('idle'); // idle | sending | sent | failed
  let problem = $state('');

  /** The server is a ws:// address; its HTTP side is the same host. */
  const endpoint = $derived(
    settings.serverUrl
      ? settings.serverUrl.replace(/^ws/, 'http').replace(/\/+$/, '') + '/suggest'
      : ''
  );
  const remaining = $derived(MAX - text.length);

  function show() {
    open = true;
    state_ = 'idle';
    problem = '';
  }

  async function send() {
    const body = text.trim();
    if (!body || state_ === 'sending') return;
    if (!endpoint) {
      state_ = 'failed';
      problem = 'No game server is configured, so this cannot send from here.';
      return;
    }
    state_ = 'sending';
    problem = '';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: body, from: from.trim(), website })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        state_ = 'sent';
        text = '';
        from = '';
      } else {
        state_ = 'failed';
        problem = data.error || `The server said no (${res.status}).`;
      }
    } catch {
      state_ = 'failed';
      problem = 'Could not reach the server.';
    }
  }

  // Carry whatever was typed over to the issue form rather than losing it.
  const issueLink = $derived(
    `${ISSUES}?title=${encodeURIComponent('Suggestion')}&body=${encodeURIComponent(text.trim())}`
  );
</script>

<article class="game panel coming">
  <div class="body">
    <h2>Something else</h2>
    <p class="blurb">
      The shelf has room. Each game is a rules engine plus a table screen, so the next one
      drops in beside these.
    </p>

    {#if !open}
      <button class="btn small" onclick={show}>Suggest a game</button>
    {:else if state_ === 'sent'}
      <p class="sent">Sent — thank you. <button class="linkish" onclick={show}>Send another</button></p>
    {:else}
      <div class="form">
        <label class="field">
          <span class="tiny muted">What should go on the shelf?</span>
          <textarea
            bind:value={text}
            maxlength={MAX}
            rows="3"
            placeholder="A game, a rule that feels wrong, anything really."
          ></textarea>
        </label>
        <label class="field">
          <span class="tiny muted">Your name (optional)</span>
          <input bind:value={from} maxlength="80" />
        </label>

        <!-- Honeypot. Hidden from people, irresistible to bots. -->
        <label class="trap" aria-hidden="true">
          Website<input bind:value={website} tabindex="-1" autocomplete="off" />
        </label>

        <div class="row actions">
          <button class="btn primary small" disabled={!text.trim() || state_ === 'sending'} onclick={send}>
            {state_ === 'sending' ? 'Sending…' : 'Send'}
          </button>
          <button class="btn ghost small" onclick={() => (open = false)}>Cancel</button>
          <span class="tiny muted count" class:low={remaining < 100}>{remaining}</span>
        </div>

        {#if state_ === 'failed'}
          <p class="tiny problem">
            {problem}
            <a href={issueLink} target="_blank" rel="noopener">Open an issue instead</a>
            — your text carries over.
          </p>
        {/if}
      </div>
    {/if}
  </div>
</article>

<style>
  .form { display: grid; gap: 0.6rem; margin-top: 0.4rem; }
  .field { display: grid; gap: 0.2rem; }
  .field textarea, .field input {
    width: 100%; font: inherit; padding: 0.4rem 0.5rem;
    border: 1px solid var(--card-edge); border-radius: 6px;
    background: color-mix(in srgb, var(--felt-deep) 18%, transparent); color: inherit;
  }
  .field textarea { resize: vertical; min-height: 4.2rem; }
  .actions { gap: 0.5rem; align-items: center; }
  .count { margin-left: auto; font-variant-numeric: tabular-nums; }
  .count.low { color: var(--brass); }
  .sent { font-size: 0.9rem; }
  .problem { color: var(--brass); }
  .problem a { color: inherit; }
  .linkish {
    background: none; border: 0; padding: 0; font: inherit;
    color: var(--brass); text-decoration: underline; cursor: pointer;
  }
  /* Off-screen rather than display:none — some bots skip hidden inputs. */
  .trap {
    position: absolute; left: -9999px; width: 1px; height: 1px;
    overflow: hidden; opacity: 0;
  }
  .tiny { font-size: 0.75rem; }
</style>
