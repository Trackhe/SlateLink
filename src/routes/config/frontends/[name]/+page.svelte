<script lang="ts">
  import { goto } from "$app/navigation";
  import { invalidateAll } from "$app/navigation";

  export let data: {
    frontend: Record<string, unknown> | null;
    binds: { name?: string; address?: string; port?: number }[];
    backends: { name: string }[];
    error: string | null;
  };

  let deleting = false;
  let deleteError = "";
  let defaultBackend = (data.frontend?.default_backend as string) ?? "";
  let saveError = "";
  let saving = false;
  let addBindAddress = "*";
  let addBindPort = 80;
  let addBindName = "";
  let addBindError = "";
  let addingBind = false;

  async function saveFrontend() {
    if (!data.frontend?.name) return;
    if (!defaultBackend.trim()) {
      saveError = "Bitte ein Backend wählen.";
      return;
    }
    saving = true;
    saveError = "";
    try {
      const res = await fetch(
        `/api/config/frontends/${encodeURIComponent(String(data.frontend.name))}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data.frontend,
            default_backend: defaultBackend.trim(),
          }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        saveError = j.error || res.statusText;
        return;
      }
      await invalidateAll();
    } catch (e) {
      saveError = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  async function addBind() {
    if (!data.frontend?.name) return;
    const port = Number(addBindPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      addBindError = "Port 1–65535 angeben.";
      return;
    }
    addingBind = true;
    addBindError = "";
    try {
      const res = await fetch(
        `/api/config/frontends/${encodeURIComponent(String(data.frontend.name))}/binds`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: addBindName.trim() || `bind_${port}`,
            address: addBindAddress.trim() || "*",
            port,
          }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        addBindError = j.error || res.statusText;
        return;
      }
      addBindAddress = "*";
      addBindPort = 80;
      addBindName = "";
      await invalidateAll();
    } catch (e) {
      addBindError = e instanceof Error ? e.message : String(e);
    } finally {
      addingBind = false;
    }
  }

  async function removeBind(bindName: string) {
    if (!data.frontend?.name || !confirm(`Bind „${bindName}“ entfernen?`))
      return;
    try {
      const res = await fetch(
        `/api/config/frontends/${encodeURIComponent(String(data.frontend.name))}/binds/${encodeURIComponent(bindName)}`,
        { method: "DELETE" },
      );
      if (res.ok) await invalidateAll();
    } catch {
      // ignore
    }
  }

  async function doDelete() {
    if (!data.frontend?.name) return;
    if (!confirm(`Frontend „${data.frontend.name}“ wirklich löschen?`)) return;
    deleting = true;
    deleteError = "";
    try {
      const res = await fetch(
        `/api/config/frontends/${encodeURIComponent(String(data.frontend.name))}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        deleteError = j.error || res.statusText;
        return;
      }
      await goto("/config");
    } catch (e) {
      deleteError = e instanceof Error ? e.message : String(e);
    } finally {
      deleting = false;
    }
  }
</script>

<div class="page-header">
  <a href="/config" class="text-sm text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg)]">← Config</a>
  <h1 class="page-title">Frontend: {data.frontend?.name ?? data.error ?? "—"}</h1>
</div>

{#if data.error}
  <p class="gh-error">{data.error}</p>
{:else if data.frontend}
  <section class="config-section">
    <div class="gh-form-section">
      <h3>Frontend bearbeiten</h3>
      <div class="flex flex-wrap items-end gap-3">
        <label class="block">
          <span class="text-sm text-[var(--gh-fg-muted)]">Name (nur Anzeige)</span>
          <input type="text" value={data.frontend.name} disabled class="gh-input mt-1 block w-48" />
        </label>
        <label class="block">
          <span class="text-sm text-[var(--gh-fg-muted)]">Backend</span>
          <select bind:value={defaultBackend} class="gh-select mt-1 block">
            <option value="">– wählen –</option>
            {#each data.backends as b}
              <option value={b.name}>{b.name}</option>
            {/each}
          </select>
        </label>
        <button type="button" class="btn btn-primary" disabled={saving} on:click={saveFrontend}>
          {saving ? "Speichern …" : "Speichern"}
        </button>
      </div>
      {#if saveError}
        <p class="gh-error">{saveError}</p>
      {/if}
    </div>
  </section>

  <section class="config-section">
    <h2 class="config-section-title">Binds (Listen-Adressen)</h2>
    {#if data.binds.length > 0}
      <ul class="border border-[var(--gh-border)] rounded-lg divide-y divide-[var(--gh-border)] mb-3 overflow-hidden">
        {#each data.binds as bind}
          {@const bindName = bind.name ?? `bind_${bind.port ?? ""}`}
          <li class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm bg-[var(--gh-canvas)] hover:bg-[var(--gh-canvas-subtle)]">
            <span class="font-medium text-[var(--gh-fg)]">{bindName}</span>
            <span class="text-[var(--gh-fg-muted)]">{bind.address ?? "*"}:{bind.port ?? ""}</span>
            <button
              type="button"
              class="text-[var(--gh-fg-muted)] hover:text-[var(--gh-danger)] text-xs ml-auto"
              on:click={() => removeBind(String(bindName))}
              title="Bind entfernen"
            >
              Entfernen
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="config-section-intro" style="margin-bottom: 0;">Keine Binds. Mindestens einen hinzufügen (Adresse:Port).</p>
    {/if}
    <div class="flex flex-wrap gap-2 items-end">
      <input type="text" bind:value={addBindName} placeholder="Name (optional)" class="gh-input w-32" />
      <input type="text" bind:value={addBindAddress} placeholder="Adresse" class="gh-input w-32" />
      <input type="number" bind:value={addBindPort} min="1" max="65535" class="gh-input w-24" />
      <button type="button" class="btn btn-secondary" disabled={addingBind} on:click={addBind}>
        {addingBind ? "Hinzufügen …" : "Bind hinzufügen"}
      </button>
    </div>
    {#if addBindError}
      <p class="gh-error">{addBindError}</p>
    {/if}
  </section>

  {#if deleteError}
    <p class="gh-error">{deleteError}</p>
  {/if}
  <button type="button" class="btn btn-delete" disabled={deleting} on:click={doDelete}>
    {deleting ? "Wird gelöscht …" : "Frontend löschen"}
  </button>
{:else}
  <p class="config-section-intro" style="margin-bottom: 0;">Nicht gefunden.</p>
{/if}
