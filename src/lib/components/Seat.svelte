<script>
  let { player, active = false, dealer = false, you = false, detail = '', badge = null } = $props();
</script>

<div class="seat" class:active class:you>
  <div class="row">
    <span class="name">{player.name}</span>
    {#if player.isBot}<span class="bot" title="Bot">◆</span>{/if}
    {#if dealer}<span class="dealer" title="Dealer">D</span>{/if}
  </div>
  <div class="detail">{detail}</div>
  {#if badge != null}<div class="badge num">{badge}</div>{/if}
</div>

<style>
  .seat {
    position: relative;
    min-width: 108px;
    padding: 0.5rem 0.7rem;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, black 14%, transparent);
    border: 1px solid transparent;
    transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
  }
  .seat.active {
    border-color: var(--brass);
    background: color-mix(in srgb, var(--brass) 16%, transparent);
    transform: translateY(-2px);
  }
  .seat.you .name { color: var(--brass-soft); }
  .name { font-family: var(--serif); font-size: 0.98rem; }
  .bot { font-size: 0.6rem; opacity: 0.65; }
  .dealer {
    font-size: 0.58rem; font-weight: 700; letter-spacing: 0.05em;
    border: 1px solid currentColor; border-radius: 999px; padding: 0 0.35em; opacity: 0.7;
  }
  .detail { font-size: 0.78rem; opacity: 0.75; font-variant-numeric: tabular-nums; }
  .badge {
    position: absolute; top: -8px; right: -8px;
    min-width: 26px; text-align: center;
    background: var(--brass); color: #2b2110;
    border-radius: 999px; font-size: 0.75rem; font-weight: 700; padding: 0.1em 0.4em;
  }
</style>
