<script lang="ts">
  type Named = { name: string };
  export let data: {
    frontends: Named[];
    backends: Named[];
    error: string | null;
  };
</script>

<h1 class="text-2xl font-semibold mb-2">Config</h1>
<p class="text-slate-600 mb-4">Frontends & Backends aus der HAProxy-Konfiguration (Data Plane API). Backends zuerst anlegen, dann Frontends mit Backend-Auswahl.</p>
<p class="mb-4 flex flex-wrap gap-2">
  <a href="/config/backends/new" class="inline-flex items-center rounded-lg bg-slate-800 text-white px-3 py-2 text-sm font-medium hover:bg-slate-700">+ Backend anlegen</a>
  <a href="/config/frontends/new" class="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">+ Frontend anlegen</a>
</p>

{#if data.error}
  <p class="text-red-600 text-sm">Fehler: {data.error}</p>
{:else}
  <section class="mb-8">
    <h2 class="font-medium text-slate-800 mb-3">Frontends</h2>
    {#if Array.isArray(data.frontends) && data.frontends.length > 0}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {#each data.frontends as f}
          <a
            href="/config/frontends/{f.name}"
            class="block rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-4 group"
          >
            <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">frontend</span>
            <h3 class="font-semibold text-slate-800 mt-2 group-hover:text-blue-700 truncate">{f.name}</h3>
            <p class="text-slate-500 text-xs mt-1">Details & Bearbeiten →</p>
          </a>
        {/each}
      </div>
    {:else}
      <p class="text-slate-500 text-sm">Keine Frontends.</p>
    {/if}
  </section>
  <section>
    <h2 class="font-medium text-slate-800 mb-3">Backends</h2>
    {#if Array.isArray(data.backends) && data.backends.length > 0}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {#each data.backends as b}
          <a
            href="/config/backends/{b.name}"
            class="block rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-violet-200 transition-all p-4 group"
          >
            <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">backend</span>
            <h3 class="font-semibold text-slate-800 mt-2 group-hover:text-violet-700 truncate">{b.name}</h3>
            <p class="text-slate-500 text-xs mt-1">Details & Bearbeiten →</p>
          </a>
        {/each}
      </div>
    {:else}
      <p class="text-slate-500 text-sm">Keine Backends.</p>
    {/if}
  </section>
{/if}
