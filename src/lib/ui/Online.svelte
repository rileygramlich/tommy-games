<script>
  import { onMount, onDestroy } from 'svelte';
  import { Online, RemoteTable } from '../net/online.svelte.js';
  import { settings } from '../stores/settings.svelte.js';
  import { GAMES, GAME_LIST, getGame } from '../games/registry.js';

  let { go } = $props();

  const online = new Online();
  const table = new RemoteTable(online);

  let username = $state(settings.name ?? '');
  let password = $state('');
  let mode = $state('login');       // login | register
  let newGame = $state('wizard');
  let newName = $state('');
  let joinCode = $state('');
  let chatText = $state('');

  onMount(() => {
    if (settings.serverUrl) online.connect(settings.serverUrl);
  });
  onDestroy(() => online.close());

  // Quiddler needs its word list in the browser too, for live word checking.
  // Some games need to load something before they can render — Quiddler's word list.
  $effect(() => {
    const game = online.room ? getGame(online.room.game) : null;
    if (game) game.ready();
  });

  const room = $derived(online.room);
  const isHost = $derived(!!room && !!online.user && room.hostId === online.user.id);
  const canStart = $derived(!!room && room.seats.length >= room.minSeats);

  function submitAuth(e) {
    e.preventDefault();
    if (mode === 'register') online.register(username, password);
    else online.login(username, password);
    password = '';
  }
  function sendChat(e) {
    e.preventDefault();
    if (chatText.trim()) online.chat(chatText);
    chatText = '';
  }
</script>

<div class="online stack">
  <div class="spread">
    <div>
      <div class="tag">Online</div>
      <h1>Play with friends</h1>
    </div>
    <button class="btn ghost small" onclick={() => go('#/')}>← Shelf</button>
  </div>

  {#if !settings.serverUrl}
    <div class="panel stack">
      <p>
        Online play needs a game server — GitHub Pages can only hand out files, so the rules have
        to run somewhere that stays awake. Add the address of yours and it will show up here.
      </p>
      <div class="row wrap">
        <button class="btn primary" onclick={() => go('#/settings')}>Add a server</button>
        <span class="muted tiny">Running locally? <code>npm run server</code>, then use <code>ws://localhost:8787</code>.</span>
      </div>
    </div>
  {:else if !online.user}
    <div class="panel stack auth">
      <div class="spread">
        <strong class="small-head">{mode === 'register' ? 'Make an account' : 'Sign in'}</strong>
        <span class="status {online.status}">{online.status}</span>
      </div>
      <form class="stack" onsubmit={submitAuth}>
        <label class="field"><span>Name</span>
          <input type="text" bind:value={username} autocomplete="username" placeholder="tommy" />
        </label>
        <label class="field"><span>Password</span>
          <input type="password" bind:value={password} autocomplete="current-password" />
        </label>
        <div class="row wrap">
          <button class="btn primary" type="submit" disabled={online.status !== 'online'}>
            {mode === 'register' ? 'Create account' : 'Sign in'}
          </button>
          <button class="btn ghost small" type="button" onclick={() => (mode = mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'I need an account' : 'I already have one'}
          </button>
        </div>
      </form>
      {#if online.error}<p class="err tiny">{online.error}</p>{/if}
      <p class="muted tiny">
        Accounts live on your game server and only exist to remember your name and record. Do not
        reuse a password you care about.
      </p>
    </div>
  {:else if room && room.started && online.view}
    {@const Table = getGame(room.game).component}
    <Table {table} onexit={() => online.leaveRoom()} />
  {:else if room}
    <div class="panel stack">
      <div class="spread">
        <div>
          <h2>{room.name}</h2>
          <div class="muted tiny">{room.gameName} · table code <strong class="code">{room.id}</strong></div>
        </div>
        <button class="btn ghost small" onclick={() => online.leaveRoom()}>Leave</button>
      </div>

      <div class="seats">
        {#each room.seats as seat (seat.userId)}
          <div class="seat" class:off={!seat.connected}>
            <span>{seat.name}</span>
            {#if seat.isBot}<span class="tiny muted">bot</span>
            {:else if seat.userId === room.hostId}<span class="tiny muted">host</span>{/if}
            {#if isHost && seat.userId !== online.user.id}
              <button class="btn ghost small" onclick={() => online.removeSeat(seat.userId)} aria-label="Remove">✕</button>
            {/if}
          </div>
        {/each}
      </div>

      {#if isHost}
        <div class="row wrap">
          <button class="btn small" disabled={room.seats.length >= room.maxSeats} onclick={() => online.addBot()}>+ Add bot</button>
          <button class="btn primary" disabled={!canStart} onclick={() => online.start()}>Deal</button>
          {#if !canStart}<span class="tiny muted">Needs {room.minSeats} seats.</span>{/if}
        </div>
      {:else}
        <p class="muted tiny">Waiting for the host to deal.</p>
      {/if}

      <div class="chat">
        {#each room.chat as line, i (i)}
          <div class="line"><strong>{line.from}</strong> {line.text}</div>
        {/each}
      </div>
      <form class="row" onsubmit={sendChat}>
        <input type="text" bind:value={chatText} placeholder="Say something" />
        <button class="btn small" type="submit">Send</button>
      </form>
      {#if online.error}<p class="err tiny">{online.error}</p>{/if}
    </div>
  {:else}
    <div class="spread">
      <span class="muted tiny">Signed in as <strong>{online.user.name}</strong></span>
      <button class="btn ghost small" onclick={() => online.logout()}>Sign out</button>
    </div>

    <div class="panel stack">
      <strong class="small-head">Open tables</strong>
      {#if online.rooms.length}
        <div class="rooms">
          {#each online.rooms as r (r.id)}
            <div class="roomrow">
              <div>
                <strong>{r.name}</strong>
                <div class="tiny muted">{r.game} · {r.host} · {r.players}/{r.maxSeats} players</div>
              </div>
              <button class="btn small" disabled={r.started} onclick={() => online.joinRoom(r.id)}>
                {r.started ? 'In play' : 'Join'}
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <p class="muted tiny">Nobody is waiting. Start a table and share the code.</p>
      {/if}
      <form class="row wrap" onsubmit={(e) => { e.preventDefault(); online.joinRoom(joinCode.trim().toUpperCase()); joinCode = ''; }}>
        <input type="text" bind:value={joinCode} placeholder="Table code" maxlength="4" style="width:8rem" />
        <button class="btn small" type="submit">Join by code</button>
      </form>
    </div>

    <div class="panel stack">
      <strong class="small-head">Start a table</strong>
      <div class="row wrap">
        <select bind:value={newGame}>
          {#each GAME_LIST as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
        </select>
        <input type="text" bind:value={newName} placeholder="Table name (optional)" />
        <button class="btn primary" onclick={() => online.createRoom(newGame, newName, {})}>Create</button>
      </div>
    </div>

    {#if online.error}<p class="err tiny">{online.error}</p>{/if}
    {#if online.user.stats && Object.keys(online.user.stats).length}
      <div class="panel">
        <strong class="small-head">Your record</strong>
        <div class="tiny muted">
          {#each Object.entries(online.user.stats) as [game, s] (game)}
            <div>{game}: {s.won} of {s.played}</div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .online { max-width: 680px; margin: 1.5rem auto; }
  .small-head { font-family: var(--serif); font-size: 1rem; }
  .tiny { font-size: 0.76rem; }
  .err { color: var(--rose); }
  .field { display: grid; gap: 0.25rem; font-size: 0.88rem; }
  .field > span { color: var(--ink-soft); }
  .status { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-faint); }
  .status.online { color: #2f7d55; }
  .status.error, .status.closed { color: var(--rose); }
  .code { font-family: var(--tabular); letter-spacing: 0.12em; }
  .seats { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .seat {
    display: flex; align-items: center; gap: 0.4rem;
    background: var(--paper-3); border-radius: 999px; padding: 0.3em 0.7em; font-size: 0.9rem;
  }
  .seat.off { opacity: 0.5; }
  .rooms { display: grid; gap: 0.4rem; }
  .roomrow { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; border-top: 1px solid var(--paper-3); padding-top: 0.4rem; }
  .chat { max-height: 130px; overflow-y: auto; font-size: 0.84rem; display: grid; gap: 0.15rem; }
  .chat .line strong { color: var(--brass); }
  code { background: var(--paper-3); padding: 0.1em 0.35em; border-radius: 4px; }

  @media (max-width: 480px) {
    .roomrow { flex-wrap: wrap; }
    .online form.row { flex-wrap: wrap; }
    .online input[type="text"] { flex: 1 1 8rem; min-width: 0; }
  }
</style>
