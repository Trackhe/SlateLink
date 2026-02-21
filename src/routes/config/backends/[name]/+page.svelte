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

<div class="page-header">
  <a href="/config" class="text-sm text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg)]">← Config</a>
  <h1 class="page-title">Backend: {data.backend?.name ?? data.error ?? '—'}</h1>
</div>

{#if data.error}
  <p class="gh-error">{data.error}</p>
{:else if data.backend}
  <section class="config-section">
    <div class="gh-form-section">
      <h3>Backend bearbeiten</h3>
      <div class="flex flex-wrap items-end gap-3">
        <label class="block">
          <span class="text-sm text-[var(--gh-fg-muted)]">Name (nur Anzeige)</span>
          <input type="text" value={data.backend.name} disabled class="gh-input mt-1 block w-48" />
        </label>
        <label class="block">
          <span class="text-sm text-[var(--gh-fg-muted)]">Mode</span>
          <select bind:value={backendMode} class="gh-select mt-1 block">
            <option value="http">http</option>
            <option value="tcp">tcp</option>
          </select>
        </label>
        <button type="button" class="btn btn-primary" disabled={saving} on:click={saveBackend}>
          {saving ? 'Speichern …' : 'Speichern'}
        </button>
      </div>
      {#if saveError}
        <p class="gh-error">{saveError}</p>
      {/if}
    </div>
  </section>

  <section class="config-section">
    <h2 class="config-section-title">Server</h2>
    {#if disableCheckError}
      <p class="gh-error">{disableCheckError}</p>
    {/if}
    {#if data.servers.length > 0}
      <ul class="border border-[var(--gh-border)] rounded-lg divide-y divide-[var(--gh-border)] mb-3 overflow-hidden">
        {#each data.servers as srv}
          {@const srvName = srv.name ?? srv.address ?? ''}
          <li class="flex items-center justify-between gap-2 px-4 py-3 text-sm bg-[var(--gh-canvas)] hover:bg-[var(--gh-canvas-subtle)]">
            <span class="text-[var(--gh-fg)]">{srvName}</span>
            <span class="text-[var(--gh-fg-muted)]">{srv.address ?? ''}:{srv.port ?? 80}</span>
            <span class="flex gap-1">
              {#if srv.check !== 'disabled'}
                <button
                  type="button"
                  class="text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg)] text-xs"
                  on:click={() => disableCheck(srv)}
                  disabled={disablingCheck === String(srvName)}
                  title="Health-Check deaktivieren (Server sonst DOWN bei fehlgeschlagenem Check)"
                >
                  {disablingCheck === String(srvName) ? '…' : 'Check deaktivieren'}
                </button>
              {/if}
              <button
                type="button"
                class="text-[var(--gh-fg-muted)] hover:text-[var(--gh-danger)] text-xs"
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
      <p class="config-section-intro" style="margin-bottom: 0;">Keine Server. Mindestens einen hinzufügen.</p>
    {/if}
    <div class="flex flex-wrap gap-2 items-end">
      <input type="text" bind:value={addServerName} placeholder="Name (optional)" class="gh-input w-32" />
      <input type="text" bind:value={addServerAddress} placeholder="Adresse" class="gh-input w-48" />
      <input type="number" bind:value={addServerPort} min="1" max="65535" class="gh-input w-20" />
      <button type="button" class="btn btn-secondary" disabled={adding} on:click={addServer}>
        {adding ? 'Hinzufügen …' : 'Server hinzufügen'}
      </button>
    </div>
    {#if addServerError}
      <p class="gh-error">{addServerError}</p>
    {/if}
  </section>

  {#if data.frontendsUsingThis.length > 0}
    <p class="gh-alert-warning config-section">
      Dieses Backend kann nicht gelöscht werden: folgende Frontends verweisen darauf:
      <strong>{data.frontendsUsingThis.join(', ')}</strong>.
    </p>
  {:else}
    {#if deleteError}
      <p class="gh-error">{deleteError}</p>
    {/if}
    <button type="button" class="btn btn-delete" disabled={deleting} on:click={doDelete}>
      {deleting ? 'Wird gelöscht …' : 'Backend löschen'}
    </button>
  {/if}
{:else}
  <p class="config-section-intro" style="margin-bottom: 0;">Nicht gefunden.</p>
{/if}
