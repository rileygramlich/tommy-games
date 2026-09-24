<script>
  import { settings, saveSettings } from '../stores/settings.svelte.js';
  import { defaultOptions } from '../games/registry.js';

  let { game, onstart, oncancel } = $props();

  const BOT_NAMES = ['Marigold', 'Bishop', 'Juniper', 'Vex', 'Clementine', 'Sable', 'Orrin'];

  function buildSeats(n) {
    const you = settings.name || 'You';
    return Array.from({ length: n }, (_, i) => ({
      name: i === 0 ? you : BOT_NAMES[(i - 1) % BOT_NAMES.length],
      isBot: i !== 0
    }));
  }

  // svelte-ignore state_referenced_locally
  let seats = $state(buildSeats(game.defaultPlayers));
  // svelte-ignore state_referenced_locally
  let options = $state(defaultOptions(game));

  const fixedSeats = $derived(game.minPlayers === game.maxPlayers);
  const solitaire = $derived(game.maxPlayers === 1);
  const humans = $derived(seats.filter((s) => !s.isBot).length);

  function addSeat() {
    if (seats.length >= game.maxPlayers) return;
    seats = [...seats, { name: BOT_NAMES[(seats.length - 1) % BOT_NAMES.length], isBot: true }];
  }
  function removeSeat(i) {
    if (seats.length <= game.minPlayers) return;
    seats = seats.filter((_, idx) => idx !== i);
  }
  function start() {
    const human = seats.find((s) => !s.isBot);
    if (human && human.name.trim()) saveSettings({ name: human.name.trim() });
    const players = seats.map((s, i) => ({ name: s.name.trim() || `Seat ${i + 1}`, isBot: s.isBot }));
    onstart({ players, options: { ...options } });
  }
</script>

<div class="setup stack">
  <div class="spread">
    <div>
      <div class="tag">{game.name}</div>
      <h1>Set the table</h1>
    </div>
    <button class="btn ghost small" onclick={oncancel}>← Back</button>
  </div>

  <p class="muted">
    {#if solitaire}
      {game.name} is played on your own.
    {:else}
      {#if fixedSeats}
        {game.name} takes exactly {game.minPlayers} players.
      {:else}
        {game.minPlayers}–{game.maxPlayers} seats.
      {/if}
      Mark a seat as a bot to play against the house, or leave several as people and pass the
      device around — hands stay hidden between turns.
    {/if}
  </p>

  <div class="panel stack">
    {#each seats as seat, i (i)}
      <div class="seatrow">
        <span class="idx num">{i + 1}</span>
        <input type="text" bind:value={seat.name} aria-label={`Name for seat ${i + 1}`} />
        <div class="toggle" role="group" aria-label="Seat type">
          <button class="btn small" class:on={!seat.isBot} onclick={() => (seat.isBot = false)}>Person</button>
          <button class="btn small" class:on={seat.isBot} onclick={() => (seat.isBot = true)}>Bot</button>
        </div>
        {#if !fixedSeats}
          <button class="btn ghost small" disabled={seats.length <= game.minPlayers}
            onclick={() => removeSeat(i)} aria-label={`Remove seat ${i + 1}`}>✕</button>
        {/if}
      </div>
    {/each}
    {#if !fixedSeats}
      <button class="btn small" disabled={seats.length >= game.maxPlayers} onclick={addSeat}>+ Add seat</button>
    {/if}
  </div>

  {#if game.options.length}
    <div class="panel stack">
      <strong class="small-head">House rules</strong>
      {#each game.options as option (option.key)}
        {#if option.type === 'toggle'}
          <label class="check">
            <input type="checkbox" bind:checked={options[option.key]} />
            <span>{option.label}{option.help ? ' — ' : ''}{#if option.help}<span class="muted">{option.help}</span>{/if}</span>
          </label>
        {:else}
          <label class="check">
            <span>{option.label}</span>
            <select bind:value={options[option.key]}>
              {#each option.choices as choice (choice.value)}
                <option value={choice.value}>{choice.label}</option>
              {/each}
            </select>
          </label>
        {/if}
      {/each}
    </div>
  {/if}

  <div class="row wrap">
    <button class="btn primary" onclick={start}>Deal</button>
    <span class="muted tiny">
      {seats.length} seats · {humans} {humans === 1 ? 'person' : 'people'} · {seats.length - humans} bots
    </span>
  </div>
</div>

<style>
  .setup { max-width: 620px; margin: 1.5rem auto; }
  .seatrow { display: grid; grid-template-columns: 1.6rem 1fr auto auto; gap: 0.5rem; align-items: center; }
  .idx { color: var(--ink-faint); font-size: 0.8rem; }
  .toggle { display: flex; gap: 0.25rem; }
  .toggle .on { background: var(--felt); color: #f2e9d6; border-color: var(--felt-deep); }
  .check { display: flex; gap: 0.5rem; align-items: center; font-size: 0.88rem; color: var(--ink-soft); }
  .small-head { font-family: var(--serif); font-size: 1rem; }
  .tiny { font-size: 0.75rem; }

  @media (max-width: 480px) {
    /* The name field gets a line of its own rather than being squeezed. */
    .seatrow { display: flex; flex-wrap: wrap; align-items: center; }
    .seatrow input { flex: 1 1 7rem; min-width: 0; }
    .check { flex-wrap: wrap; }
  }
</style>
