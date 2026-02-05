<script lang="ts">
  /** From +page.server.ts load() */
  export let data: { data: Record<string, unknown> | null; error: string | null };
  let showRaw = false;
</script>

<h1 class="text-2xl font-semibold mb-2">SlateLink</h1>
<p class="text-slate-600 mb-6">
  Willkommen. Anbindung an die HAProxy Data Plane API (Control Plane).
</p>

{#if data.error}
  <div class="rounded-lg border border-red-200 bg-red-50 p-4">
    <div class="flex items-center gap-2 mb-2">
      <span class="inline-flex h-3 w-3 rounded-full bg-red-500" aria-hidden="true"></span>
      <span class="font-medium text-red-800">Control Plane nicht erreichbar</span>
    </div>
    <p class="text-red-700 text-sm">{data.error}</p>
    <p class="text-red-600 text-xs mt-2">
      Prüfe <code class="bg-red-100 px-1 rounded">DATAPLANE_API_URL</code> in .env (z. B. http://localhost:5555) und ob die Data Plane API läuft.
    </p>
  </div>
{:else if data.data}
  <div class="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
    <div class="flex items-center gap-2 mb-3">
      <span class="inline-flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true"></span>
      <span class="font-medium text-emerald-800">Control Plane erreichbar</span>
    </div>
    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-emerald-900">
      {#if data.data.version}
        <dt class="text-emerald-700">Version</dt>
        <dd>{data.data.version}</dd>
      {/if}
      {#if data.data.api_version}
        <dt class="text-emerald-700">API</dt>
        <dd>{data.data.api_version}</dd>
      {/if}
    </dl>
    <button
      type="button"
      class="mt-3 text-sm text-emerald-700 hover:text-emerald-900 underline"
      on:click={() => (showRaw = !showRaw)}
    >
      {showRaw ? 'Raw JSON ausblenden' : 'Raw JSON anzeigen'}
    </button>
    {#if showRaw}
      <pre class="mt-2 text-xs overflow-auto rounded bg-white/60 p-3 border border-emerald-100">{JSON.stringify(data.data, null, 2)}</pre>
    {/if}
  </div>
{:else}
  <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 flex items-center gap-2">
    <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></span>
    <span class="text-slate-600">Status wird geladen …</span>
  </div>
{/if}
