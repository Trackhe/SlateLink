<script lang="ts">
  import { onMount } from "svelte";

  export let data: {
    entries: {
      id: number;
      created_at: string;
      action: string;
      resource_type: string | null;
      resource_id: string | null;
      details: string | null;
    }[];
  };

  let haproxyLines: string[] = [];
  let haproxyError: string | null = null;
  let haproxyLoading = true;
  let haproxyTail = 200;

  async function loadHaproxyLog() {
    haproxyLoading = true;
    haproxyError = null;
    try {
      const r = await fetch(`/api/audit/haproxy-log?tail=${haproxyTail}`);
      const j = await r.json();
      if (!r.ok) {
        haproxyError = j.error ?? "Unbekannter Fehler";
        haproxyLines = j.lines ?? [];
      } else {
        haproxyLines = j.lines ?? [];
      }
    } catch (e) {
      haproxyError = e instanceof Error ? e.message : String(e);
      haproxyLines = [];
    } finally {
      haproxyLoading = false;
    }
  }

  onMount(() => {
    loadHaproxyLog();
  });
</script>

<h1 class="text-2xl font-semibold mb-2 text-[var(--gh-fg)]">Audit & Log</h1>
<p class="text-[var(--gh-fg-muted)] mb-4">
  Audit-Log (Aktionen & Ressourcen) und HAProxy-Container-Log.
</p>

<section class="mb-8">
  <h2 class="text-lg font-medium mb-2 text-[var(--gh-fg)]">Audit-Log</h2>
  {#if data.entries.length === 0}
    <p class="text-[var(--gh-fg-muted)] text-sm">Keine Einträge.</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm border border-[var(--gh-border)]">
        <thead class="bg-[var(--gh-canvas-subtle)]">
          <tr>
            <th class="text-left p-2 text-[var(--gh-fg-muted)] font-medium"
              >Zeit</th
            >
            <th class="text-left p-2 text-[var(--gh-fg-muted)] font-medium"
              >Aktion</th
            >
            <th class="text-left p-2 text-[var(--gh-fg-muted)] font-medium"
              >Ressource</th
            >
            <th class="text-left p-2 text-[var(--gh-fg-muted)] font-medium"
              >Details</th
            >
          </tr>
        </thead>
        <tbody>
          {#each data.entries as row}
            <tr class="border-t border-[var(--gh-border)]">
              <td class="p-2 text-[var(--gh-fg-muted)]">{row.created_at}</td>
              <td class="p-2 text-[var(--gh-fg)]">{row.action}</td>
              <td class="p-2 text-[var(--gh-fg)]"
                >{row.resource_type ?? "—"}{#if row.resource_id}
                  / {row.resource_id}{/if}</td
              >
              <td class="p-2 text-[var(--gh-fg-muted)]">{row.details ?? "—"}</td
              >
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<section>
  <h2 class="text-lg font-medium mb-2 text-[var(--gh-fg)]">HAProxy-Log</h2>
  <p class="text-[var(--gh-fg-muted)] text-sm mb-2">
    Container-Log von HAProxy (inkl. Data Plane API). In <code
      class="bg-[var(--gh-canvas-subtle)] border border-[var(--gh-border)] px-1 rounded"
      >.env</code
    >
    <code
      class="bg-[var(--gh-canvas-subtle)] border border-[var(--gh-border)] px-1 rounded"
      >HAPROXY_CONTAINER_NAME=haproxy_main</code
    >
    setzen, damit die App
    <code
      class="bg-[var(--gh-canvas-subtle)] border border-[var(--gh-border)] px-1 rounded"
      >docker logs</code
    > auslesen kann.
  </p>
  <div class="flex items-center gap-2 mb-2">
    <label for="haproxy-tail" class="text-sm text-[var(--gh-fg-muted)]"
      >Zeilen:</label
    >
    <input
      id="haproxy-tail"
      type="number"
      min="50"
      max="2000"
      bind:value={haproxyTail}
      class="border border-[var(--gh-border)] rounded px-2 py-1 w-20 text-sm bg-[var(--gh-canvas)] text-[var(--gh-fg)]"
    />
    <button
      type="button"
      class="px-3 py-1.5 bg-[var(--gh-accent)] text-white rounded text-sm hover:opacity-90 disabled:opacity-50"
      disabled={haproxyLoading}
      on:click={loadHaproxyLog}
    >
      {haproxyLoading ? "Laden…" : "Aktualisieren"}
    </button>
  </div>
  {#if haproxyError}
    <p class="text-amber-700 dark:text-amber-400 text-sm mb-2">
      {haproxyError}
    </p>
  {/if}
  <div
    class="border border-[var(--gh-border)] rounded bg-[var(--gh-canvas-subtle)] overflow-auto max-h-[420px]"
  >
    <pre
      class="p-3 text-xs text-[var(--gh-fg)] font-mono whitespace-pre-wrap break-all">{haproxyLines.join(
        "\n",
      ) || (haproxyLoading ? "…" : "Keine Log-Zeilen.")}</pre>
  </div>
</section>
