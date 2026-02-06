<script lang="ts">
  import { onMount } from 'svelte';

  export let data: {
    entries: { id: number; created_at: string; action: string; resource_type: string | null; resource_id: string | null; details: string | null }[];
  };

  let haproxyLines: string[] = [];
  let haproxyError: string | null = null;
  let haproxyLoading = true;
  let haproxyTail = 200;

  async function loadHaproxyLog() {
    haproxyLoading = true;
    haproxyError = null;
    try {
      const r = await fetch(`/api/audit/haproxy-log?tail=${haproxyTail}`);
      const j = await r.json();
      if (!r.ok) {
        haproxyError = j.error ?? 'Unbekannter Fehler';
        haproxyLines = j.lines ?? [];
      } else {
        haproxyLines = j.lines ?? [];
      }
    } catch (e) {
      haproxyError = e instanceof Error ? e.message : String(e);
      haproxyLines = [];
    } finally {
      haproxyLoading = false;
    }
  }

  onMount(() => {
    loadHaproxyLog();
  });
</script>

<h1 class="text-2xl font-semibold mb-2">Audit & Log</h1>
<p class="text-slate-600 mb-4">Audit-Log (Aktionen & Ressourcen) und HAProxy-Container-Log.</p>

<section class="mb-8">
  <h2 class="text-lg font-medium mb-2">Audit-Log</h2>
  {#if data.entries.length === 0}
    <p class="text-slate-500 text-sm">Keine Einträge.</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm border border-slate-200">
        <thead class="bg-slate-100">
          <tr>
            <th class="text-left p-2">Zeit</th>
            <th class="text-left p-2">Aktion</th>
            <th class="text-left p-2">Ressource</th>
            <th class="text-left p-2">Details</th>
          </tr>
        </thead>
        <tbody>
          {#each data.entries as row}
            <tr class="border-t border-slate-200">
              <td class="p-2 text-slate-600">{row.created_at}</td>
              <td class="p-2">{row.action}</td>
              <td class="p-2">{row.resource_type ?? '—'}{#if row.resource_id} / {row.resource_id}{/if}</td>
              <td class="p-2 text-slate-600">{row.details ?? '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<section>
  <h2 class="text-lg font-medium mb-2">HAProxy-Log</h2>
  <p class="text-slate-500 text-sm mb-2">
    Container-Log von HAProxy (inkl. Data Plane API). In <code class="bg-slate-100 px-1 rounded">.env</code> <code class="bg-slate-100 px-1 rounded">HAPROXY_CONTAINER_NAME=haproxy_main</code> setzen, damit die App <code class="bg-slate-100 px-1 rounded">docker logs</code> auslesen kann.
  </p>
  <div class="flex items-center gap-2 mb-2">
    <label for="haproxy-tail" class="text-sm text-slate-600">Zeilen:</label>
    <input
      id="haproxy-tail"
      type="number"
      min="50"
      max="2000"
      bind:value={haproxyTail}
      class="border border-slate-300 rounded px-2 py-1 w-20 text-sm"
    />
    <button
      type="button"
      class="px-3 py-1.5 bg-slate-700 text-white rounded text-sm hover:bg-slate-600 disabled:opacity-50"
      disabled={haproxyLoading}
      on:click={loadHaproxyLog}
    >
      {haproxyLoading ? 'Laden…' : 'Aktualisieren'}
    </button>
  </div>
  {#if haproxyError}
    <p class="text-amber-700 text-sm mb-2">{haproxyError}</p>
  {/if}
  <div class="border border-slate-200 rounded bg-slate-50 overflow-auto max-h-[420px]">
    <pre class="p-3 text-xs text-slate-800 font-mono whitespace-pre-wrap break-all">{haproxyLines.join('\n') || (haproxyLoading ? '…' : 'Keine Log-Zeilen.')}</pre>
  </div>
</section>
