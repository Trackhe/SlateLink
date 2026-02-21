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

<div class="mb-4">
  <a href="/config" class="text-slate-600 hover:text-slate-900 text-sm"
    >← Config</a
  >
</div>

<h1 class="text-2xl font-semibold mb-2">
  Frontend: {data.frontend?.name ?? data.error ?? "—"}
</h1>

{#if data.error}
  <p class="text-red-600 text-sm">{data.error}</p>
{:else if data.frontend}
  <section class="mb-6">
    <h2 class="font-medium text-slate-800 mb-2">Frontend bearbeiten</h2>
    <div class="flex flex-wrap items-end gap-3">
      <label class="block">
        <span class="text-sm text-slate-600">Name (nur Anzeige)</span>
        <input
          type="text"
          value={data.frontend.name}
          disabled
          class="mt-1 block w-48 rounded border border-slate-300 bg-slate-100 px-2 py-1.5 text-sm"
        />
      </label>
      <label class="block">
        <span class="text-sm text-slate-600">Backend</span>
        <select
          bind:value={defaultBackend}
          class="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
        >
          <option value="">– wählen –</option>
          {#each data.backends as b}
            <option value={b.name}>{b.name}</option>
          {/each}
        </select>
      </label>
      <button
        type="button"
        class="rounded-lg bg-slate-800 text-white px-3 py-2 text-sm hover:bg-slate-700 disabled:opacity-50"
        disabled={saving}
        on:click={saveFrontend}
      >
        {saving ? "Speichern …" : "Speichern"}
      </button>
    </div>
    {#if saveError}
      <p class="text-red-600 text-sm mt-2">{saveError}</p>
    {/if}
  </section>

  <section class="mb-6">
    <h2 class="font-medium text-slate-800 mb-2">Binds (Listen-Adressen)</h2>
    {#if data.binds.length > 0}
      <ul
        class="border border-slate-200 rounded divide-y divide-slate-200 mb-3"
      >
        {#each data.binds as bind}
          {@const bindName = bind.name ?? `bind_${bind.port ?? ""}`}
          <li
            class="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm"
          >
            <span class="font-medium">{bindName}</span>
            <span class="text-slate-500"
              >{bind.address ?? "*"}:{bind.port ?? ""}</span
            >
            <button
              type="button"
              class="text-slate-500 hover:text-red-600 text-xs ml-auto"
              on:click={() => removeBind(String(bindName))}
              title="Bind entfernen"
            >
              Entfernen
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-slate-500 text-sm mb-2">
        Keine Binds. Mindestens einen hinzufügen (Adresse:Port).
      </p>
    {/if}
    <div class="flex flex-wrap gap-2 items-end">
      <input
        type="text"
        bind:value={addBindName}
        placeholder="Name (optional)"
        class="w-32 rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <input
        type="text"
        bind:value={addBindAddress}
        placeholder="Adresse"
        class="w-32 rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <input
        type="number"
        bind:value={addBindPort}
        min="1"
        max="65535"
        class="w-24 rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        class="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        disabled={addingBind}
        on:click={addBind}
      >
        {addingBind ? "Hinzufügen …" : "Bind hinzufügen"}
      </button>
    </div>
    {#if addBindError}
      <p class="text-red-600 text-sm mt-2">{addBindError}</p>
    {/if}
  </section>

  {#if deleteError}
    <p class="text-red-600 text-sm mb-2">{deleteError}</p>
  {/if}
  <button
    type="button"
    class="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 hover:bg-red-100 disabled:opacity-50"
    disabled={deleting}
    on:click={doDelete}
  >
    {deleting ? "Wird gelöscht …" : "Frontend löschen"}
  </button>
{:else}
  <p class="text-slate-500">Nicht gefunden.</p>
{/if}
