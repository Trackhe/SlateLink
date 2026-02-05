<script lang="ts">
  export let data: {
    frontends: unknown[];
    backends: unknown[];
    error: string | null;
  };
</script>

<h1 class="text-2xl font-semibold mb-2">Config</h1>
<p class="text-slate-600 mb-4">Frontends & Backends aus der HAProxy-Konfiguration (Data Plane API).</p>

{#if data.error}
  <p class="text-red-600 text-sm">Fehler: {data.error}</p>
{:else}
  <section class="mb-6">
    <h2 class="font-medium mb-2">Frontends</h2>
    {#if Array.isArray(data.frontends) && data.frontends.length > 0}
      <ul class="list-disc list-inside text-sm text-slate-700">
        {#each data.frontends as f}
          <li>
            {#if typeof f === 'object' && f !== null && 'name' in f}
              <a href="/config/frontends/{(f as { name: string }).name}" class="text-slate-800 hover:underline">{(f as { name: string }).name}</a>
            {:else}
              {JSON.stringify(f)}
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-slate-500 text-sm">Keine Frontends.</p>
    {/if}
  </section>
  <section>
    <h2 class="font-medium mb-2">Backends</h2>
    {#if Array.isArray(data.backends) && data.backends.length > 0}
      <ul class="list-disc list-inside text-sm text-slate-700">
        {#each data.backends as b}
          <li>
            {#if typeof b === 'object' && b !== null && 'name' in b}
              <a href="/config/backends/{(b as { name: string }).name}" class="text-slate-800 hover:underline">{(b as { name: string }).name}</a>
            {:else}
              {JSON.stringify(b)}
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-slate-500 text-sm">Keine Backends.</p>
    {/if}
  </section>
{/if}
