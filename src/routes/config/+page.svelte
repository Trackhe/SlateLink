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
          <li>{typeof f === 'object' && f !== null && 'name' in f ? (f as { name: string }).name : JSON.stringify(f)}</li>
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
          <li>{typeof b === 'object' && b !== null && 'name' in b ? (b as { name: string }).name : JSON.stringify(b)}</li>
        {/each}
      </ul>
    {:else}
      <p class="text-slate-500 text-sm">Keine Backends.</p>
    {/if}
  </section>
{/if}
