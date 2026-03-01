<script lang="ts">
  /** Erlaubte Keys müssen mit API /api/config/files/[key] übereinstimmen. */
  const FILE_OPTIONS: { key: string; label: string }[] = [
    { key: "domain_mapping", label: "domain_mapping.txt (crt_list)" },
    { key: "haproxy_cfg", label: "haproxy.cfg" },
    { key: "dataplaneapi_yml", label: "dataplaneapi.yml" },
  ];

  let selectedKey = FILE_OPTIONS[0].key;
  let content = "";
  let filePath = "";
  let loadError = "";
  let loadLoading = false;
  let saveError = "";
  let saveSuccess = false;
  let saving = false;

  async function loadFile() {
    loadError = "";
    loadLoading = true;
    content = "";
    filePath = "";
    try {
      const res = await fetch(`/api/config/files/${encodeURIComponent(selectedKey)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        loadError = (data as { error?: string }).error || res.statusText;
        return;
      }
      content = typeof (data as { content?: string }).content === "string"
        ? (data as { content: string }).content
        : "";
      filePath = (data as { path?: string }).path ?? "";
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    } finally {
      loadLoading = false;
    }
  }

  async function saveFile() {
    saveError = "";
    saveSuccess = false;
    saving = true;
    try {
      const res = await fetch(`/api/config/files/${encodeURIComponent(selectedKey)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        saveError = (data as { error?: string }).error || res.statusText;
        return;
      }
      saveSuccess = true;
      filePath = (data as { path?: string }).path ?? filePath;
    } catch (e) {
      saveError = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  $: if (selectedKey) loadFile();
</script>

<svelte:head>
  <title>Konfigurationsdateien – SlateLink</title>
</svelte:head>

<div class="page-header">
  <h1 class="page-title">Konfigurationsdateien</h1>
  <p class="page-intro">
    Bearbeite <strong>domain_mapping.txt</strong> (crt_list für HTTPS-Binds),
    <strong>haproxy.cfg</strong> und <strong>dataplaneapi.yml</strong> direkt.
    Änderungen an haproxy.cfg/dataplaneapi.yml können Konflikte mit der Data Plane API verursachen, wenn sie gleichzeitig die Dateien verwaltet.
  </p>
</div>

<div class="config-section">
  <div class="flex flex-wrap items-center gap-3 mb-4">
    <label class="flex items-center gap-2">
      <span class="text-sm text-[var(--gh-fg-muted)]">Datei:</span>
      <select
        bind:value={selectedKey}
        class="gh-select"
        style="min-width: 260px;"
      >
        {#each FILE_OPTIONS as opt}
          <option value={opt.key}>{opt.label}</option>
        {/each}
      </select>
    </label>
    <button
      type="button"
      class="btn btn-secondary"
      disabled={loadLoading}
      on:click={loadFile}
    >
      {loadLoading ? "Laden …" : "Aktualisieren"}
    </button>
  </div>

  {#if loadError}
    <p class="gh-error mb-3">{loadError}</p>
  {/if}
  {#if filePath}
    <p class="text-sm text-[var(--gh-fg-muted)] mb-2">Pfad: <code class="gh-code">{filePath}</code></p>
  {/if}

  <div class="mb-3">
    <textarea
      bind:value={content}
      class="file-editor-textarea"
      placeholder={loadLoading ? "Wird geladen …" : "Inhalt der Datei"}
      spellcheck="false"
      data-gramm="false"
    />
  </div>

  <div class="flex flex-wrap items-center gap-3">
    <button
      type="button"
      class="btn btn-primary"
      disabled={saving || loadLoading}
      on:click={saveFile}
    >
      {saving ? "Speichern …" : "Speichern"}
    </button>
    {#if saveSuccess}
      <span class="text-sm text-[var(--gh-success)]">Gespeichert.</span>
    {/if}
    {#if saveError}
      <span class="text-sm text-[var(--gh-danger)]">{saveError}</span>
    {/if}
  </div>
</div>

<style>
  .file-editor-textarea {
    width: 100%;
    min-height: 420px;
    padding: 12px;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 13px;
    line-height: 1.5;
    color: var(--gh-fg);
    background: var(--gh-canvas-subtle);
    border: 1px solid var(--gh-border);
    border-radius: 6px;
    resize: vertical;
  }
  .file-editor-textarea:focus {
    outline: none;
    border-color: var(--gh-accent);
    box-shadow: 0 0 0 2px rgba(9, 105, 218, 0.2);
  }
  :global(html[data-theme="dark"]) .file-editor-textarea:focus {
    box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.25);
  }
</style>
