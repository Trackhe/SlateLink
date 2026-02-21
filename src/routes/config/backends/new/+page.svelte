<script lang="ts">
  import { goto } from "$app/navigation";

  let busy = false;
  let error = "";
  let backendName = "";
  let servers: { name: string; address: string; port: number }[] = [
    { name: "srv1", address: "host.docker.internal", port: 3000 },
  ];

  function addServer() {
    servers = [
      ...servers,
      { name: `srv${servers.length + 1}`, address: "", port: 80 },
    ];
  }
  function removeServer(i: number) {
    servers = servers.filter((_, idx) => idx !== i);
  }

  async function submit() {
    error = "";
    if (!backendName.trim()) {
      error = "Backend-Name ist Pflicht.";
      return;
    }
    const valid = servers.filter((s) => s.address.trim());
    if (valid.length === 0) {
      error = "Mindestens ein Server (Adresse) ist nötig.";
      return;
    }
    busy = true;
    try {
      const res = await fetch("/api/config/backends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: backendName.trim(),
          servers: valid.map((s) => ({
            name: s.name.trim() || s.address.replace(/[.:]/g, "_"),
            address: s.address.trim(),
            port: Number(s.port) || 80,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        error = data.error || res.statusText;
        return;
      }
      await goto("/config");
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<div class="page-header">
  <a href="/config" class="text-sm text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg)]">← Config</a>
  <h1 class="page-title">Backend anlegen</h1>
  <p class="page-intro">
    Backend mit Namen und mindestens einem Server. Danach kannst du ein Frontend
    anlegen und dieses Backend im Dropdown auswählen.
  </p>
</div>

{#if error}
  <div class="gh-alert config-section">{error}</div>
{/if}

<form on:submit|preventDefault={submit} class="space-y-6 max-w-2xl">
  <section class="gh-form-section">
    <h3>Backend</h3>
    <label class="block">
      <span class="text-sm text-[var(--gh-fg-muted)]">Name</span>
      <input
        type="text"
        bind:value={backendName}
        class="gh-input mt-1 block w-full"
        placeholder="z. B. myapp_back"
      />
    </label>
  </section>

  <section class="gh-form-section">
    <h3>Server</h3>
    <p class="text-sm text-[var(--gh-fg-muted)] mb-2">
      Adresse:Port, z. B. host.docker.internal:3000
    </p>
    {#each servers as srv, i}
      <div class="flex gap-2 items-end mb-2">
        <input type="text" bind:value={srv.name} placeholder="Name" class="gh-input w-24" />
        <input type="text" bind:value={srv.address} placeholder="Adresse" class="gh-input flex-1" />
        <input type="number" bind:value={srv.port} min="1" max="65535" class="gh-input w-20" />
        <button
          type="button"
          on:click={() => removeServer(i)}
          class="text-[var(--gh-fg-muted)] hover:text-[var(--gh-danger)] text-sm"
          title="Server entfernen">✕</button
        >
      </div>
    {/each}
    <button
      type="button"
      on:click={addServer}
      class="text-sm text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg)] underline"
      >+ Server hinzufügen</button
    >
  </section>

  <div class="flex gap-3">
    <button type="submit" disabled={busy} class="btn btn-primary">
      {busy ? "Wird angelegt …" : "Backend anlegen"}
    </button>
    <a href="/config" class="btn btn-secondary">Abbrechen</a>
  </div>
</form>
