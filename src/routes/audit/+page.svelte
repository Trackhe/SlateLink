<script lang="ts">
  export let data: {
    entries: { id: number; created_at: string; action: string; resource_type: string | null; resource_id: string | null; details: string | null }[];
  };
</script>

<h1 class="text-2xl font-semibold mb-2">Audit</h1>
<p class="text-slate-600 mb-4">Audit-Log (Aktionen & Ressourcen).</p>

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
