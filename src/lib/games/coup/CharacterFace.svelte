<script>
  // Simple engraved-looking portraits, one per character. Drawn rather than
  // photographic so they read at card size and in either theme: everything is
  // strokes in the character's own colour over the card face.
  let { character = null } = $props();
</script>

<svg class="face" viewBox="0 0 60 64" role="img" aria-hidden="true" focusable="false">
  <!-- shoulders, shared by every portrait -->
  <path class="line soft" d="M8 62c0-10 8-15 22-15s22 5 22 15" />

  {#if character === 'duke'}
    <!-- broad, bearded, wearing the crown -->
    <circle class="line" cx="30" cy="28" r="13" />
    <path class="line" d="M15 16l4 7 5-8 6 8 6-8 5 8 4-7v8H15z" />
    <path class="line soft" d="M22 32c2 6 14 6 16 0" />
    <circle class="ink" cx="25" cy="26" r="1.6" />
    <circle class="ink" cx="35" cy="26" r="1.6" />
  {:else if character === 'assassin'}
    <!-- hood pulled forward, only the eyes showing -->
    <path class="line" d="M30 13c10 0 15 8 15 17s-6 14-15 14-15-5-15-14 5-17 15-17z" />
    <path class="fill-dark" d="M18 26c3-7 8-10 12-10s9 3 12 10c-4 4-8 6-12 6s-8-2-12-6z" />
    <circle class="ink" cx="25" cy="27" r="1.8" />
    <circle class="ink" cx="35" cy="27" r="1.8" />
    <path class="line soft" d="M30 41v8" />
  {:else if character === 'captain'}
    <!-- peaked cap over a squared jaw -->
    <circle class="line" cx="30" cy="30" r="12" />
    <path class="line" d="M13 22h34l-3-6H16z" />
    <path class="line soft" d="M11 22h38" />
    <circle class="ink" cx="26" cy="29" r="1.6" />
    <circle class="ink" cx="34" cy="29" r="1.6" />
    <path class="line soft" d="M25 36c3 3 7 3 10 0" />
  {:else if character === 'ambassador'}
    <!-- laurel at the temples, a scroll held up -->
    <circle class="line" cx="30" cy="27" r="12" />
    <path class="line soft" d="M16 24c-3-4-2-8 1-10 2 3 3 7 2 10M44 24c3-4 2-8-1-10-2 3-3 7-2 10" />
    <circle class="ink" cx="26" cy="26" r="1.6" />
    <circle class="ink" cx="34" cy="26" r="1.6" />
    <path class="line soft" d="M25 33c3 2 7 2 10 0" />
    <rect class="line" x="20" y="45" width="20" height="9" rx="2" />
    <path class="line soft" d="M24 48h12M24 51h8" />
  {:else if character === 'contessa'}
    <!-- swept hair, a fan raised -->
    <circle class="line" cx="30" cy="27" r="11" />
    <path class="line" d="M19 24c0-9 5-13 11-13s11 4 11 13c-3-5-6-7-11-7s-8 2-11 7z" />
    <circle class="ink" cx="26" cy="27" r="1.5" />
    <circle class="ink" cx="34" cy="27" r="1.5" />
    <path class="line soft" d="M26 33c2 2 6 2 8 0" />
    <path class="line" d="M38 52l10-10 3 3-10 10z" />
    <path class="line soft" d="M40 50l3 3" />
  {:else if character === 'inquisitor'}
    <!-- deep cowl, a cross at the throat -->
    <path class="line" d="M30 12c11 0 16 9 16 19s-7 14-16 14-16-4-16-14 5-19 16-19z" />
    <path class="fill-dark" d="M19 27c2-8 7-11 11-11s9 3 11 11c-3 5-7 7-11 7s-8-2-11-7z" />
    <circle class="ink" cx="26" cy="28" r="1.6" />
    <circle class="ink" cx="34" cy="28" r="1.6" />
    <path class="line" d="M30 46v10M25 50h10" />
  {:else if character === 'embezzler'}
    <!-- top hat, monocle, and a coin -->
    <circle class="line" cx="30" cy="30" r="12" />
    <path class="line" d="M19 20h22M22 20V9h16v11" />
    <circle class="line" cx="35" cy="29" r="4" />
    <path class="line soft" d="M39 29l4 2" />
    <circle class="ink" cx="25" cy="29" r="1.6" />
    <path class="line soft" d="M25 37c3 2 6 2 9 0" />
    <circle class="line" cx="46" cy="50" r="6" />
    <path class="line soft" d="M46 47v6M44 49h4" />
  {:else}
    <circle class="line" cx="30" cy="28" r="12" />
    <circle class="ink" cx="26" cy="27" r="1.6" />
    <circle class="ink" cx="34" cy="27" r="1.6" />
  {/if}
</svg>

<style>
  .face { width: 100%; height: auto; display: block; }
  .line {
    fill: none;
    stroke: var(--ink-colour, #23201c);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .soft { opacity: 0.6; }
  .ink { fill: var(--ink-colour, #23201c); }
  .fill-dark { fill: color-mix(in srgb, var(--ink-colour, #23201c) 18%, transparent); stroke: none; }
</style>
