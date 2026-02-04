<script>
  import { onMount } from "svelte";
  import { fetchApi } from "$lib/api/client";

  let frontends = [];
  let backends = [];
  let error = null;

  onMount(async () => {
    try {
      const [frontendsResponse, backendsResponse] = await Promise.all([
        fetchApi("/api/frontends"),
        fetchApi("/api/backends"),
      ]);
      if (frontendsResponse.ok) {
        const data = await frontendsResponse.json();
        frontends = data.frontends ?? [];
      }
      if (backendsResponse.ok) {
        const data = await backendsResponse.json();
        backends = data.backends ?? [];
      }
      if (!frontendsResponse.ok) error = `Frontends: ${frontendsResponse.status}`;
      if (!backendsResponse.ok) error = `Backends: ${backendsResponse.status}`;
    } catch (e) {
      error = (e instanceof Error ? e.message : String(e));
    }
  });
</script>

<h1 class="text-2xl font-semibold mb-4">Konfiguration</h1>

{#if error}
  <p class="text-red-600">{error}</p>
{:else}
  <section class="mb-6">
    <h2 class="text-lg font-medium mb-2">Frontends</h2>
    {#if frontends.length === 0}
      <p class="text-slate-600">Keine Frontends.</p>
    {:else}
      <ul class="list-disc pl-6">
        {#each frontends as frontend}
          <li>{frontend.name ?? frontend}</li>
        {/each}
      </ul>
    {/if}
  </section>
  <section>
    <h2 class="text-lg font-medium mb-2">Backends</h2>
    {#if backends.length === 0}
      <p class="text-slate-600">Keine Backends.</p>
    {:else}
      <ul class="list-disc pl-6">
        {#each backends as backend}
          <li>{backend.name ?? backend}</li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}
