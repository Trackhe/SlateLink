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

<div class="mb-4">
  <a
    href="/config"
    class="text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg)] text-sm"
    >← Config</a
  >
</div>

<h1 class="text-2xl font-semibold mb-2 text-[var(--gh-fg)]">Backend anlegen</h1>
<p class="text-[var(--gh-fg-muted)] mb-6">
  Backend mit Namen und mindestens einem Server. Danach kannst du ein Frontend
  anlegen und dieses Backend im Dropdown auswählen.
</p>

{#if error}
  <div
    class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300 text-sm"
  >
    {error}
  </div>
{/if}

<form on:submit|preventDefault={submit} class="space-y-6 max-w-2xl">
  <section
    class="rounded-lg border border-[var(--gh-border)] p-4 bg-[var(--gh-canvas-subtle)]"
  >
    <h2 class="font-medium text-[var(--gh-fg)] mb-3">Backend</h2>
    <label class="block">
      <span class="text-sm text-[var(--gh-fg-muted)]">Name</span>
      <input
        type="text"
        bind:value={backendName}
        class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-3 py-2 text-sm"
        placeholder="z. B. myapp_back"
      />
    </label>
  </section>

  <section
    class="rounded-lg border border-[var(--gh-border)] p-4 bg-[var(--gh-canvas-subtle)]"
  >
    <h2 class="font-medium text-[var(--gh-fg)] mb-3">Server</h2>
    <p class="text-sm text-[var(--gh-fg-muted)] mb-2">
      Adresse:Port, z. B. host.docker.internal:3000
    </p>
    {#each servers as srv, i}
      <div class="flex gap-2 items-end mb-2">
        <input
          type="text"
          bind:value={srv.name}
          placeholder="Name"
          class="w-24 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-2 py-1.5 text-sm"
        />
        <input
          type="text"
          bind:value={srv.address}
          placeholder="Adresse"
          class="flex-1 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          bind:value={srv.port}
          min="1"
          max="65535"
          class="w-20 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          on:click={() => removeServer(i)}
          class="text-[var(--gh-fg-muted)] hover:text-red-500 dark:hover:text-red-400 text-sm"
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
    <button
      type="submit"
      disabled={busy}
      class="rounded-lg bg-[var(--gh-accent)] text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
    >
      {busy ? "Wird angelegt …" : "Backend anlegen"}
    </button>
    <a
      href="/config"
      class="rounded-lg border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-4 py-2 text-sm hover:bg-[var(--gh-btn-hover)]"
      >Abbrechen</a
    >
  </div>
</form>
