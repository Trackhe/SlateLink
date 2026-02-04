<script>
  import { onMount } from "svelte";
  import { fetchApi } from "$lib/api/client";

  let certificates = [];
  let error = null;

  onMount(async () => {
    try {
      const response = await fetchApi("/api/certificates");
      if (response.ok) {
        const data = await response.json();
        certificates = data.certificates ?? [];
      } else {
        error = `Backend: ${response.status}`;
      }
    } catch (e) {
      error = (e instanceof Error ? e.message : String(e));
    }
  });
</script>

<h1 class="text-2xl font-semibold mb-4">Zertifikate</h1>

{#if error}
  <p class="text-red-600">{error}</p>
{:else if certificates.length === 0}
  <p class="text-slate-600">Keine Zertifikate.</p>
{:else}
  <ul class="space-y-2">
    {#each certificates as certificate}
      <li class="rounded border border-slate-200 p-2 bg-slate-50">
        {certificate.storage_name ?? certificate.file ?? JSON.stringify(certificate)}
      </li>
    {/each}
  </ul>
{/if}
