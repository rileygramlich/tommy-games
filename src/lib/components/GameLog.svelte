<script>
  let { log = [] } = $props();
  let box = $state(null);
  $effect(() => {
    log.length;
    if (box) box.scrollTop = box.scrollHeight;
  });
</script>

<div class="log" bind:this={box}>
  {#each log as entry, i (i)}
    <div class="line">{entry.text}</div>
  {/each}
</div>

<style>
  .log {
    max-height: 150px;
    overflow-y: auto;
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--ink-soft);
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .line { padding-left: 0.6em; text-indent: -0.6em; }
  .line:last-child { color: var(--ink); }
</style>
