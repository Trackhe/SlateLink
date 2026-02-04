<script>
  import { onMount } from "svelte";
  import { fetchApi } from "$lib/api/client";

  let entries = [];
  let error = null;

  onMount(async () => {
    try {
      const response = await fetchApi("/api/audit?limit=50");
      if (response.ok) {
        const data = await response.json();
        entries = data.entries ?? [];
      } else {
        error = `Backend: ${response.status}`;
      }
    } catch (e) {
      error = (e instanceof Error ? e.message : String(e));
    }
  });
</script>

<h1 class="text-2xl font-semibold mb-4">Audit-Log</h1>

{#if error}
  <p class="text-red-600">{error}</p>
{:else if entries.length === 0}
  <p class="text-slate-600">Keine Einträge.</p>
{:else}
  <div class="overflow-x-auto">
    <table class="min-w-full border border-slate-200">
      <thead class="bg-slate-100">
        <tr>
          <th class="text-left p-2 border-b">Zeitpunkt</th>
          <th class="text-left p-2 border-b">Aktion</th>
          <th class="text-left p-2 border-b">Ressource</th>
          <th class="text-left p-2 border-b">Details</th>
        </tr>
      </thead>
      <tbody>
        {#each entries as entry}
          <tr class="border-b border-slate-100">
            <td class="p-2">{entry.timestamp}</td>
            <td class="p-2">{entry.action}</td>
            <td class="p-2">{entry.resource_type}{#if entry.resource_id} / {entry.resource_id}{/if}</td>
            <td class="p-2 text-sm text-slate-600">{entry.details ?? "–"}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
