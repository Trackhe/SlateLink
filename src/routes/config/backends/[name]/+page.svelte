<script lang="ts">
  import { goto } from '$app/navigation';
  import { invalidateAll } from '$app/navigation';

  export let data: {
    backend: Record<string, unknown> | null;
    servers: { name?: string; address?: string; port?: number; check?: string }[];
    frontendsUsingThis: string[];
    canDelete: boolean;
    error: string | null;
  };

  let deleting = false;
  let deleteError = '';
  let saveError = '';
  let saving = false;
  let backendMode = (data.backend?.mode as string) ?? 'http';
  let addServerName = '';
  let addServerAddress = '';
  let addServerPort = 80;
  let addServerError = '';
  let adding = false;
  let disablingCheck: string | null = null;
  let disableCheckError = '';

  async function disableCheck(srv: (typeof data.servers)[number]) {
    const name = String(srv.name ?? '');
    if (!data.backend?.name || !name) return;
    disablingCheck = name;
    disableCheckError = '';
    try {
      const res = await fetch(
        `/api/config/backends/${encodeURIComponent(String(data.backend.name))}/servers/${encodeURIComponent(name)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ check: 'disabled' })
        }
      );
      if (res.ok) {
        await invalidateAll();
      } else {
        const j = await res.json().catch(() => ({}));
        disableCheckError = j.error || res.statusText;
      }
    } catch (e) {
      disableCheckError = e instanceof Error ? e.message : String(e);
    } finally {
      disablingCheck = null;
    }
  }

  async function saveBackend() {
    if (!data.backend?.name) return;
    saving = true;
    saveError = '';
    try {
      const res = await fetch(`/api/config/backends/${encodeURIComponent(String(data.backend.name))}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data.backend,
          mode: backendMode
        })
      });
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

  async function addServer() {
    if (!data.backend?.name || !addServerAddress.trim()) {
      addServerError = 'Adresse ist Pflicht.';
      return;
    }
    adding = true;
    addServerError = '';
    try {
      const res = await fetch(`/api/config/backends/${encodeURIComponent(String(data.backend.name))}/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addServerName.trim() || addServerAddress.replace(/[.:]/g, '_'),
          address: addServerAddress.trim(),
          port: addServerPort
        })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        addServerError = j.error || res.statusText;
        return;
      }
      addServerName = '';
      addServerAddress = '';
      addServerPort = 80;
      await invalidateAll();
    } catch (e) {
      addServerError = e instanceof Error ? e.message : String(e);
    } finally {
      adding = false;
    }
  }

  async function removeServer(serverName: string) {
    if (!data.backend?.name || !confirm(`Server „${serverName}“ entfernen?`)) return;
    try {
      const res = await fetch(
        `/api/config/backends/${encodeURIComponent(String(data.backend.name))}/servers/${encodeURIComponent(serverName)}`,
        { method: 'DELETE' }
      );
      if (res.ok) await invalidateAll();
    } catch {
      // ignore
    }
  }

  async function doDelete() {
    if (!data.canDelete || !data.backend?.name) return;
    if (!confirm(`Backend „${data.backend.name}“ wirklich löschen?`)) return;
    deleting = true;
    deleteError = '';
    try {
      const res = await fetch(`/api/config/backends/${encodeURIComponent(String(data.backend.name))}`, {
        method: 'DELETE'
      });
      if (res.status === 409) {
        const j = await res.json();
        deleteError = j.error || 'Löschen nicht möglich.';
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        deleteError = j.error || res.statusText;
        return;
      }
      await goto('/config');
    } catch (e) {
      deleteError = e instanceof Error ? e.message : String(e);
    } finally {
      deleting = false;
    }
  }
</script>

<div class="mb-4">
  <a href="/config" class="text-slate-600 hover:text-slate-900 text-sm">← Config</a>
</div>

<h1 class="text-2xl font-semibold mb-2">Backend: {data.backend?.name ?? data.error ?? '—'}</h1>

{#if data.error}
  <p class="text-red-600 text-sm">{data.error}</p>
{:else if data.backend}
  <section class="mb-6">
    <h2 class="font-medium text-slate-800 mb-2">Backend bearbeiten</h2>
    <div class="flex flex-wrap items-end gap-3">
      <label class="block">
        <span class="text-sm text-slate-600">Name (nur Anzeige)</span>
        <input type="text" value={data.backend.name} disabled class="mt-1 block w-48 rounded border border-slate-300 bg-slate-100 px-2 py-1.5 text-sm" />
      </label>
      <label class="block">
        <span class="text-sm text-slate-600">Mode</span>
        <select bind:value={backendMode} class="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="http">http</option>
          <option value="tcp">tcp</option>
        </select>
      </label>
      <button
        type="button"
        class="rounded-lg bg-slate-800 text-white px-3 py-2 text-sm hover:bg-slate-700 disabled:opacity-50"
        disabled={saving}
        on:click={saveBackend}
      >
        {saving ? 'Speichern …' : 'Speichern'}
      </button>
    </div>
    {#if saveError}
      <p class="text-red-600 text-sm mt-2">{saveError}</p>
    {/if}
  </section>

  <section class="mb-6">
    <h2 class="font-medium text-slate-800 mb-2">Server</h2>
    {#if disableCheckError}
      <p class="text-red-600 text-sm mb-2">{disableCheckError}</p>
    {/if}
    {#if data.servers.length > 0}
      <ul class="border border-slate-200 rounded divide-y divide-slate-200 mb-3">
        {#each data.servers as srv}
          {@const srvName = srv.name ?? srv.address ?? ''}
          <li class="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span>{srvName}</span>
            <span class="text-slate-500">{srv.address ?? ''}:{srv.port ?? 80}</span>
            <span class="flex gap-1">
              {#if srv.check !== 'disabled'}
                <button
                  type="button"
                  class="text-amber-700 hover:text-amber-800 text-xs"
                  on:click={() => disableCheck(srv)}
                  disabled={disablingCheck === String(srvName)}
                  title="Health-Check deaktivieren (Server sonst DOWN bei fehlgeschlagenem Check)"
                >
                  {disablingCheck === String(srvName) ? '…' : 'Check deaktivieren'}
                </button>
              {/if}
              <button
                type="button"
                class="text-slate-500 hover:text-red-600 text-xs"
                on:click={() => removeServer(String(srvName))}
                title="Server entfernen"
              >
                Entfernen
              </button>
            </span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-slate-500 text-sm mb-2">Keine Server. Mindestens einen hinzufügen.</p>
    {/if}
    <div class="flex flex-wrap gap-2 items-end">
      <input type="text" bind:value={addServerName} placeholder="Name (optional)" class="w-32 rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <input type="text" bind:value={addServerAddress} placeholder="Adresse" class="w-48 rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <input type="number" bind:value={addServerPort} min="1" max="65535" class="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <button
        type="button"
        class="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        disabled={adding}
        on:click={addServer}
      >
        {adding ? 'Hinzufügen …' : 'Server hinzufügen'}
      </button>
    </div>
    {#if addServerError}
      <p class="text-red-600 text-sm mt-2">{addServerError}</p>
    {/if}
  </section>

  {#if data.frontendsUsingThis.length > 0}
    <p class="text-amber-700 text-sm mb-2">
      Dieses Backend kann nicht gelöscht werden: folgende Frontends verweisen darauf:
      <strong>{data.frontendsUsingThis.join(', ')}</strong>.
    </p>
  {:else}
    {#if deleteError}
      <p class="text-red-600 text-sm mb-2">{deleteError}</p>
    {/if}
    <button
      type="button"
      class="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 hover:bg-red-100 disabled:opacity-50"
      disabled={deleting}
      on:click={doDelete}
    >
      {deleting ? 'Wird gelöscht …' : 'Backend löschen'}
    </button>
  {/if}
{:else}
  <p class="text-slate-500">Nicht gefunden.</p>
{/if}
