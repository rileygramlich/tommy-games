<script>
  // A game's house rules, shared by local setup and the online lobby. Choices are
  // cards rather than dropdowns: a label like "Classic — 20 + 10 a trick" shows its
  // name big and the explanation under it, so the difference is readable at a glance.
  let { game, options, editable = true, onchange } = $props();

  function set(key, value) {
    if (!editable) return;
    onchange?.({ ...options, [key]: value }, { [key]: value });
  }

  function split(label) {
    const i = label.indexOf(' — ');
    return i === -1 ? { name: label, detail: '' } : { name: label.slice(0, i), detail: label.slice(i + 3) };
  }
</script>

{#if game.options.length}
  <div class="panel stack rules">
    <div class="spread">
      <strong class="small-head">House rules</strong>
      {#if !editable}<span class="muted tiny">Set by the host</span>{/if}
    </div>
    {#each game.options as option (option.key)}
      {#if option.type === 'toggle'}
        <button type="button" class="switchrow" role="switch" aria-checked={!!options[option.key]}
          disabled={!editable} onclick={() => set(option.key, !options[option.key])}>
          <span class="text">
            <span class="name">{option.label}</span>
            {#if option.help}<span class="detail">{option.help}</span>{/if}
          </span>
          <span class="switch" class:on={!!options[option.key]} aria-hidden="true"><span class="knob"></span></span>
        </button>
      {:else}
        <fieldset class="choices" disabled={!editable}>
          <legend>{option.label}</legend>
          <div class="grid" style:--n={option.choices.length}>
            {#each option.choices as choice (choice.value)}
              {@const c = split(choice.label)}
              <label class="choice" class:on={options[option.key] === choice.value}>
                <input type="radio" name={option.key} value={choice.value}
                  checked={options[option.key] === choice.value}
                  onchange={() => set(option.key, choice.value)} />
                <span class="name">{c.name}</span>
                {#if c.detail}<span class="detail">{c.detail}</span>{/if}
              </label>
            {/each}
          </div>
        </fieldset>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .rules { gap: 0.9rem; }
  .small-head { font-family: var(--serif); font-size: 1rem; }
  .tiny { font-size: 0.75rem; }
  .name { font-weight: 600; color: var(--ink); font-size: 0.92rem; }
  .detail { color: var(--ink-soft); font-size: 0.8rem; line-height: 1.35; }

  .switchrow {
    all: unset; box-sizing: border-box; cursor: pointer;
    display: flex; align-items: center; justify-content: space-between; gap: 0.8rem;
    padding: 0.55rem 0.7rem; border-radius: 10px; border: 1px solid var(--paper-3);
  }
  .switchrow:focus-visible { outline: 2px solid var(--brass); outline-offset: 2px; }
  .switchrow:disabled { cursor: default; }
  .switchrow .text { display: grid; gap: 0.15rem; }
  .switch {
    flex: none; width: 2.6rem; height: 1.5rem; border-radius: 999px; position: relative;
    background: var(--paper-3); transition: background 0.15s;
  }
  .switch .knob {
    position: absolute; top: 0.18rem; left: 0.18rem; width: 1.14rem; height: 1.14rem;
    border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 0.3); transition: transform 0.15s;
  }
  .switch.on { background: var(--felt-line); }
  .switch.on .knob { transform: translateX(1.1rem); }

  .choices { border: 0; margin: 0; padding: 0; min-width: 0; }
  .choices legend { padding: 0; margin-bottom: 0.4rem; font-size: 0.82rem; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.06em; }
  .grid { display: grid; gap: 0.45rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr)); }
  .choice {
    position: relative; cursor: pointer; display: grid; gap: 0.2rem; align-content: start;
    padding: 0.6rem 0.75rem; border-radius: 10px; border: 1.5px solid var(--paper-3);
    background: var(--paper); transition: border-color 0.12s, background 0.12s;
  }
  .choice:hover { border-color: var(--ink-faint); }
  .choice.on { border-color: var(--felt-line); background: color-mix(in srgb, var(--felt-line) 14%, var(--paper)); }
  .choice.on .name::after { content: " ✓"; color: var(--felt-line); }
  .choice input { position: absolute; opacity: 0; pointer-events: none; }
  .choice:has(input:focus-visible) { outline: 2px solid var(--brass); outline-offset: 2px; }
  .choices:disabled .choice { cursor: default; }
  .choices:disabled .choice:not(.on) { opacity: 0.55; }
</style>
