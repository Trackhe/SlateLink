<script lang="ts">
  export let data: {
    certificates: { storage_name?: string; file?: string; description?: string }[];
    error: string | null;
  };
</script>

<h1 class="text-2xl font-semibold mb-2">Certificates</h1>
<p class="text-slate-600 mb-4">SSL-Zertifikate (Data Plane API Storage).</p>

{#if data.error}
  <p class="text-red-600 text-sm">Fehler: {data.error}</p>
{:else}
  {#if Array.isArray(data.certificates) && data.certificates.length > 0}
    <ul class="space-y-2">
      {#each data.certificates as cert}
        <li class="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <span class="font-medium">{cert.storage_name ?? '—'}</span>
          {#if cert.file}
            <span class="text-slate-500 ml-2">{cert.file}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-slate-500 text-sm">Keine Zertifikate.</p>
  {/if}
{/if}
