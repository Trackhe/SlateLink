<script>
  import { onMount } from "svelte";
  import { getBackendUrl } from "$lib/api/client";

  let info = null;
  let error = null;

  onMount(async () => {
    try {
      const response = await fetch(`${getBackendUrl()}/api/info`);
      if (response.ok) {
        info = await response.json();
      } else {
        error = `Backend: ${response.status}`;
      }
    } catch (e) {
      error = (e instanceof Error ? e.message : String(e));
    }
  });
</script>

<h1 class="text-2xl font-semibold mb-4">Dashboard</h1>

{#if error}
  <p class="text-red-600">Fehler: {error}</p>
  <p class="text-slate-600 text-sm mt-2">
    Stellen Sie sicher, dass das Backend unter {getBackendUrl()} läuft.
  </p>
{:else if info}
  <div class="rounded border border-slate-200 p-4 bg-slate-50">
    <h2 class="font-medium mb-2">Data Plane API Info</h2>
    <pre class="text-sm overflow-auto">{JSON.stringify(info, null, 2)}</pre>
  </div>
{:else}
  <p class="text-slate-600">Lade …</p>
{/if}
