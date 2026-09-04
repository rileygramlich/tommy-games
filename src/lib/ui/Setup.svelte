<script>
  import { settings, saveSettings } from '../stores/settings.svelte.js';

  let { game, onstart, oncancel } = $props();

  const BOT_NAMES = ['Marigold', 'Bishop', 'Juniper', 'Vex', 'Clementine', 'Sable', 'Orrin'];

  // App remounts this screen per game, so seeding state from the prop is safe.
  // svelte-ignore state_referenced_locally
  let seats = $state(buildSeats(game.defaultPlayers));
  let hookRule = $state(false);
  let bonuses = $state(true);
  // svelte-ignore state_referenced_locally
  let rounds = $state(game.id === 'quiddler' ? 8 : null);

  function buildSeats(n) {
    const you = settings.name || 'You';
    return Array.from({ length: n }, (_, i) => ({
      name: i === 0 ? you : BOT_NAMES[(i - 1) % BOT_NAMES.length],
      isBot: i !== 0
    }));
  }

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
    const options = game.id === 'wizard' ? { hookRule } : { bonuses, rounds: Number(rounds) };
    onstart({ players, options });
  }

  const humans = $derived(seats.filter((s) => !s.isBot).length);
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
    {game.minPlayers}–{game.maxPlayers} seats. Mark a seat as a bot to play against the house, or
    leave several as people and pass the device around — hands stay hidden between turns.
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
        <button
          class="btn ghost small"
          disabled={seats.length <= game.minPlayers}
          onclick={() => removeSeat(i)}
          aria-label={`Remove seat ${i + 1}`}
        >✕</button>
      </div>
    {/each}
    <button class="btn small" disabled={seats.length >= game.maxPlayers} onclick={addSeat}>+ Add seat</button>
  </div>

  <div class="panel stack">
    <strong class="small-head">House rules</strong>
    {#if game.id === 'wizard'}
      <label class="check">
        <input type="checkbox" bind:checked={hookRule} />
        <span>Screw the dealer — the dealer may not make the bids add up to the tricks available.</span>
      </label>
    {:else}
      <label class="check">
        <input type="checkbox" bind:checked={bonuses} />
        <span>Round bonuses — 10 points each for the longest word and the most words.</span>
      </label>
      <label class="check">
        <span>Rounds</span>
        <select bind:value={rounds}>
          {#each [4, 6, 8] as n (n)}<option value={n}>{n} (up to {n + 2} cards)</option>{/each}
        </select>
      </label>
    {/if}
  </div>

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
</style>
