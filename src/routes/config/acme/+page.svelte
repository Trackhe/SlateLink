<script lang="ts">
  import { invalidateAll } from "$app/navigation";

  export let data: {
    providers: { name: string; directory?: string }[];
    error: string | null;
  };

  let name = "";
  let directory = "https://acme-v02.api.letsencrypt.org/directory";
  let keytype = "RSA";
  let submitError = "";
  let submitting = false;
  let deleteName: string | null = null;
  let deleteError = "";
  let deleting = false;

  // Bearbeiten-Modal
  let editModalOpen = false;
  let editProvider: { name: string; directory: string; keytype: string } | null = null;
  let editDirectory = "";
  let editKeytype = "RSA";
  let editSaveError = "";
  let editSaving = false;
  let editLoading = false;
  let editFetchError = "";

  async function openEditModal(providerName: string) {
    editModalOpen = true;
    editProvider = null;
    editFetchError = "";
    editSaveError = "";
    editLoading = true;
    try {
      const res = await fetch(`/api/config/acme/${encodeURIComponent(providerName)}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        editFetchError = (j as { error?: string }).error || res.statusText;
        return;
      }
      const p = j as { name?: string; directory?: string; keytype?: string };
      editProvider = {
        name: String(p.name ?? providerName),
        directory: String(p.directory ?? ""),
        keytype: String(p.keytype ?? "RSA")
      };
      editDirectory = editProvider.directory;
      editKeytype = editProvider.keytype;
    } catch (e) {
      editFetchError = e instanceof Error ? e.message : String(e);
    } finally {
      editLoading = false;
    }
  }

  function closeEditModal() {
    editModalOpen = false;
    editProvider = null;
    editSaveError = "";
    editFetchError = "";
  }

  function handleEditModalKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") closeEditModal();
  }

  function handleEditModalOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).getAttribute("data-modal-overlay") === "true") closeEditModal();
  }

  async function saveEdit() {
    if (!editProvider) return;
    if (!editDirectory.trim()) {
      editSaveError = "Directory-URL ist Pflicht.";
      return;
    }
    if (!editDirectory.trim().toLowerCase().startsWith("https://")) {
      editSaveError = "Die Data Plane API akzeptiert nur HTTPS-URLs.";
      return;
    }
    editSaving = true;
    editSaveError = "";
    try {
      const res = await fetch(
        `/api/config/acme/${encodeURIComponent(editProvider.name)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editProvider.name,
            directory: editDirectory.trim(),
            keytype: editKeytype || undefined
          })
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        editSaveError = (j as { error?: string }).error || res.statusText;
        return;
      }
      await invalidateAll();
      closeEditModal();
    } catch (e) {
      editSaveError = e instanceof Error ? e.message : String(e);
    } finally {
      editSaving = false;
    }
  }

  async function submit() {
    if (!name.trim()) {
      submitError = "Name ist Pflicht.";
      return;
    }
    if (!directory.trim()) {
      submitError = "ACME Directory-URL ist Pflicht.";
      return;
    }
    if (!directory.trim().toLowerCase().startsWith("https://")) {
      submitError = "Die Data Plane API akzeptiert nur HTTPS-URLs. Für HTTP-ACME-Server einen lokalen HTTPS-Proxy verwenden.";
      return;
    }
    submitting = true;
    submitError = "";
    try {
      const res = await fetch("/api/config/acme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          directory: directory.trim(),
          keytype: keytype || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        submitError = j.error || res.statusText;
        return;
      }
      name = "";
      directory = "https://acme-v02.api.letsencrypt.org/directory";
      await invalidateAll();
    } catch (e) {
      submitError = e instanceof Error ? e.message : String(e);
    } finally {
      submitting = false;
    }
  }

  async function doDelete(providerName: string) {
    if (!confirm(`ACME-Provider „${providerName}“ wirklich löschen?`)) return;
    deleteName = providerName;
    deleteError = "";
    try {
      const res = await fetch(
        `/api/config/acme/${encodeURIComponent(providerName)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        deleteError = j.error || res.statusText;
        return;
      }
      await invalidateAll();
      deleteName = null;
    } catch (e) {
      deleteError = e instanceof Error ? e.message : String(e);
    } finally {
      deleting = false;
    }
  }
</script>

<svelte:head>
  <title>ACME-Provider – SlateLink</title>
</svelte:head>

<h1 class="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">
  ACME-Provider
</h1>
<p class="text-sm text-slate-600 dark:text-slate-400 mb-6">
  Automatische TLS-Zertifikate (z. B. Let's Encrypt). Ein ACME-Provider wird in einem
  Zertifikat-Store (CrtLoad) referenziert. Die Data Plane API akzeptiert nur
  <strong>HTTPS</strong>-Directory-URLs. Für einen HTTP-ACME-Server (z. B. lokaler Pebble/ACME-Test)
  einen lokalen HTTPS-Proxy vorschalten (z. B. Caddy/nginx mit Proxy zu <code>http://…</code>).
</p>

{#if data.error}
  <p class="text-red-600 dark:text-red-400 text-sm mb-4">{data.error}</p>
{/if}

<section class="mb-8">
  <h2 class="font-medium text-slate-800 dark:text-slate-100 mb-2">Neuer ACME-Provider</h2>
  <form
    on:submit|preventDefault={submit}
    class="flex flex-wrap gap-3 items-end"
  >
    <div>
      <label class="block text-xs text-slate-500 mb-1">Name</label>
      <input
        type="text"
        bind:value={name}
        placeholder="z. B. letsencrypt"
        class="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm w-40"
      />
    </div>
    <div class="flex-1 min-w-[280px]">
      <label class="block text-xs text-slate-500 mb-1">Directory-URL</label>
      <input
        type="url"
        bind:value={directory}
        placeholder="https://acme-v02.api.letsencrypt.org/directory"
        class="w-full rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
      />
    </div>
    <div>
      <label class="block text-xs text-slate-500 mb-1">Key-Typ</label>
      <select
        bind:value={keytype}
        class="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
      >
        <option value="RSA">RSA</option>
        <option value="ECDSA">ECDSA</option>
      </select>
    </div>
    <button
      type="submit"
      disabled={submitting}
      class="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
    >
      {submitting ? "Wird angelegt …" : "Anlegen"}
    </button>
  </form>
  {#if submitError}
    <p class="text-red-600 dark:text-red-400 text-sm mt-2">{submitError}</p>
  {/if}
</section>

<section>
  <h2 class="font-medium text-slate-800 dark:text-slate-100 mb-2">Vorhandene ACME-Provider</h2>
  {#if data.providers.length === 0}
    <p class="text-slate-500 dark:text-slate-400 text-sm">Keine ACME-Provider angelegt.</p>
  {:else}
    <ul class="border border-slate-200 dark:border-slate-600 rounded divide-y divide-slate-200 dark:divide-slate-600">
      {#each data.providers as p}
        <li class="flex items-center justify-between px-3 py-2 text-sm">
          <span class="font-medium">{p.name}</span>
          <span class="text-slate-500 dark:text-slate-400 truncate ml-2">{p.directory ?? ""}</span>
          <button
            type="button"
            class="text-slate-600 dark:text-slate-300 hover:underline ml-2"
            on:click={() => openEditModal(p.name)}
          >
            Bearbeiten
          </button>
          <button
            type="button"
            class="text-red-600 dark:text-red-400 hover:underline ml-2"
            on:click={() => doDelete(p.name)}
            disabled={deleteName === p.name}
          >
            Löschen
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if deleteError}
    <p class="text-red-600 dark:text-red-400 text-sm mt-2">{deleteError}</p>
  {/if}
</section>

<!-- Modal: ACME-Provider bearbeiten (gleiche Optik wie Config Backend/Frontend Modals) -->
{#if editModalOpen}
  <!-- svelte-ignore a11y-no-static-element-interactions a11y-no-noninteractive-element-interactions a11y-click-events-have-key-events -->
  <div
    data-modal-overlay="true"
    role="dialog"
    aria-modal="true"
    aria-labelledby="acme-edit-modal-title"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
    on:click={handleEditModalOverlayClick}
    on:keydown={handleEditModalKeydown}
    tabindex="-1"
  >
    <!-- svelte-ignore a11y-no-static-element-interactions a11y-no-noninteractive-element-interactions a11y-click-events-have-key-events -->
    <div
      class="bg-[var(--gh-canvas)] border border-[var(--gh-border)] rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      on:click|stopPropagation
      role="document"
    >
      <div class="p-6">
        <div class="flex items-center justify-between gap-4 mb-4">
          <h2
            id="acme-edit-modal-title"
            class="text-xl font-semibold text-[var(--gh-fg)]"
          >
            ACME-Provider bearbeiten: {editProvider?.name ?? "…"}
          </h2>
          <button
            type="button"
            class="text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg)] p-1"
            on:click={closeEditModal}
            aria-label="Schließen"
          >✕</button>
        </div>

        {#if editLoading}
          <p class="text-[var(--gh-fg-muted)] text-sm">Wird geladen …</p>
        {:else if editFetchError}
          <p class="text-red-600 dark:text-red-400 text-sm mb-2">{editFetchError}</p>
          <button
            type="button"
            class="rounded-lg border border-[var(--gh-border)] px-3 py-2 text-sm text-[var(--gh-fg)] bg-[var(--gh-canvas-subtle)] hover:bg-[var(--gh-btn-hover)]"
            on:click={closeEditModal}
          >
            Schließen
          </button>
        {:else if editProvider}
          <form on:submit|preventDefault={saveEdit} class="space-y-5">
            {#if editSaveError}
              <div
                class="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300 text-sm"
              >
                {editSaveError}
              </div>
            {/if}
            <section
              class="rounded-lg border border-[var(--gh-border)] p-4 bg-[var(--gh-canvas-subtle)]"
            >
              <h3 class="font-medium text-[var(--gh-fg)] mb-3">ACME-Provider</h3>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="block">
                  <span class="text-sm text-[var(--gh-fg-muted)]">Name (nur Anzeige)</span>
                  <input
                    type="text"
                    value={editProvider.name}
                    disabled
                    class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas-subtle)] px-3 py-2 text-sm text-[var(--gh-fg)]"
                  />
                </label>
                <label class="block">
                  <span class="text-sm text-[var(--gh-fg-muted)]">Key-Typ</span>
                  <select
                    bind:value={editKeytype}
                    class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-3 py-2 text-sm"
                  >
                    <option value="RSA">RSA</option>
                    <option value="ECDSA">ECDSA</option>
                  </select>
                </label>
              </div>
              <label class="block mt-3">
                <span class="text-sm text-[var(--gh-fg-muted)]">Directory-URL</span>
                <input
                  type="url"
                  bind:value={editDirectory}
                  class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-3 py-2 text-sm"
                />
              </label>
              {#if editDirectory && /localhost|127\.0\.0\.1/i.test(editDirectory)}
                <p class="mt-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-sm px-3 py-2">
                  <strong>Hinweis:</strong> HAProxy läuft im Container. Dort ist <code>localhost</code> der Container, nicht dein Rechner. Statt <code>https://localhost:3001/…</code> z. B. <code>https://host.docker.internal:3001/acme/directory</code> verwenden.
                </p>
              {/if}
              <p class="mt-2 text-[var(--gh-fg-muted)] text-xs">
                Wenn der ACME-Server mit <strong>401</strong> antwortet (z. B. bei <code>new-account</code>): Prüfen Sie serverseitig Authentifizierung, External Account Binding (EAB) und ob die Directory-URL exakt dem vom Server angebotenen Verzeichnis entspricht.
              </p>
            </section>
            <div class="flex gap-2">
              <button
                type="submit"
                disabled={editSaving}
                class="rounded-lg border border-[var(--gh-border)] px-3 py-2 text-sm text-[var(--gh-fg)] bg-[var(--gh-canvas-subtle)] hover:bg-[var(--gh-btn-hover)] disabled:opacity-50"
              >
                {editSaving ? "Speichern …" : "Speichern"}
              </button>
              <button
                type="button"
                class="rounded-lg border border-[var(--gh-border)] px-3 py-2 text-sm text-[var(--gh-fg)] bg-[var(--gh-canvas-subtle)] hover:bg-[var(--gh-btn-hover)]"
                on:click={closeEditModal}
              >
                Abbrechen
              </button>
            </div>
          </form>
        {/if}
      </div>
    </div>
  </div>
{/if}
