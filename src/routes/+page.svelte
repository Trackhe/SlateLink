<script lang="ts">
  import { onMount } from "svelte";
  import { invalidateAll } from "$app/navigation";

  /** From +page.server.ts load() */
  export let data: {
    data: Record<string, unknown> | null;
    stats: unknown;
    error: string | null;
    statsError: string | null;
    rawStats?: unknown;
  };
  let showRaw = false;
  let showStatsDebug = false;

  const LIVE_REFRESH_MS = 5000;

  onMount(() => {
    const t = setInterval(() => invalidateAll(), LIVE_REFRESH_MS);
    return () => clearInterval(t);
  });

  /** Nach Normalisierung: Array mit { type, name, req_tot, scur, bin, bout, status, … } */
  const statsRows = Array.isArray(data.stats) ? data.stats : [];
  const metricKeys = [
    "req_tot",
    "scur",
    "stot",
    "bin",
    "bout",
    "hrsp_2xx",
    "hrsp_4xx",
    "hrsp_5xx",
    "status",
  ];
  function getLabel(key: string): string {
    const labels: Record<string, string> = {
      req_tot: "Requests",
      scur: "Sessions",
      stot: "Conn total",
      bin: "Bytes in",
      bout: "Bytes out",
      hrsp_2xx: "2xx",
      hrsp_4xx: "4xx",
      hrsp_5xx: "5xx",
      status: "Status",
    };
    return labels[key] ?? key;
  }
  function getVal(row: unknown, key: string): string {
    if (row === null || typeof row !== "object") return "–";
    const r = row as Record<string, unknown>;
    const v = r[key];
    if (v === undefined || v === null) return "–";
    if (typeof v === "number") return String(v);
    return String(v);
  }
  function getDisplayName(row: unknown): string {
    if (row === null || typeof row !== "object") return "–";
    const r = row as Record<string, unknown>;
    return String(r.name ?? r.pxname ?? r.svname ?? "–");
  }
  function getType(row: unknown): string {
    if (row === null || typeof row !== "object") return "–";
    return String((row as Record<string, unknown>).type ?? "–");
  }
</script>

<div class="page-header">
  <h1 class="page-title">SlateLink</h1>
  <p class="page-intro">
    Willkommen. Anbindung an die HAProxy Data Plane API (Control Plane).
    Statistiken unten zeigen den aktuellen Laufzeitstand von Frontends, Backends
    und Servern.
    <span class="block mt-2 text-sm opacity-90"
      >Du musst diese App (SlateLink) aufrufen, z. B. <code class="gh-code"
        >http://localhost:3001</code
      >. Wenn du nur über HAProxy (z. B. localhost:80) gehst und dort ein anderer
      Dienst (z. B. Port 3000) hängt, siehst du dort nicht dieses Dashboard.</span
    >
  </p>
</div>

{#if data.error}
  <div class="gh-alert config-section">
    <p class="font-medium mb-2">Control Plane nicht erreichbar</p>
    <p>{data.error}</p>
    <p class="text-sm mt-2">
      Prüfe <code class="gh-code">DATAPLANE_API_URL</code> in .env (z. B. http://localhost:5555) und ob die Data Plane API läuft.
    </p>
  </div>
{:else if data.data}
  <div class="gh-alert-success config-section">
    <p class="font-medium mb-2">Control Plane erreichbar</p>
    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {#if data.data.version}
        <dt class="text-[var(--gh-fg-muted)]">Version</dt>
        <dd>{data.data.version}</dd>
      {/if}
      {#if data.data.api_version}
        <dt class="text-[var(--gh-fg-muted)]">API</dt>
        <dd>{data.data.api_version}</dd>
      {/if}
    </dl>
    <button
      type="button"
      class="mt-3 text-sm text-[var(--gh-accent)] hover:underline"
      on:click={() => (showRaw = !showRaw)}
    >
      {showRaw ? "Raw JSON ausblenden" : "Raw JSON anzeigen"}
    </button>
    {#if showRaw}
      <pre
        class="mt-2 text-xs overflow-auto rounded bg-[var(--gh-canvas-subtle)] p-3 border border-[var(--gh-border)]">{JSON.stringify(
          data.data,
          null,
          2,
        )}</pre>
    {/if}
  </div>

  <section class="config-section">
    <h2 class="config-section-title">
      HAProxy-Statistiken (Live)
      <span class="text-[var(--gh-fg-muted)] font-normal text-sm"
        >– Aktualisierung alle {LIVE_REFRESH_MS / 1000} s</span
      >
    </h2>
    {#if data.statsError}
      <div class="gh-alert-warning">
        <p>Statistiken nicht verfügbar: {data.statsError}</p>
        <p class="text-sm mt-2">
          Prüfe: Data Plane API läuft (z. B. im HAProxy-Container), <code class="gh-code">DATAPLANE_API_URL</code> in .env zeigt auf die DPA (z. B. http://localhost:5555).
        </p>
      </div>
    {:else if statsRows.length === 0}
      <p class="config-section-intro" style="margin-bottom: 0;">
        Keine Statistik-Einträge (DPA /stats/native lieferte leeres oder anderes Format).
      </p>
      {#if data.rawStats != null}
        <button
          type="button"
          class="mt-2 text-sm text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg)] underline"
          on:click={() => (showStatsDebug = !showStatsDebug)}
        >
          {showStatsDebug ? "Roh-Antwort ausblenden" : "Roh-Antwort der DPA anzeigen"}
        </button>
        {#if showStatsDebug}
          <pre
            class="mt-2 text-xs overflow-auto rounded bg-[var(--gh-canvas-subtle)] p-3 border border-[var(--gh-border)] max-h-64">{JSON.stringify(
              data.rawStats,
              null,
              2,
            )}</pre>
        {/if}
      {/if}
    {:else}
      <div class="gh-tile-grid">
        {#each statsRows as row}
          {@const type = getType(row)}
          {@const status = getVal(row, "status")}
          <article class="gh-tile-static">
            <div class="flex items-center justify-between gap-2">
              <span class="gh-badge">{type}</span>
              {#if status && status !== "–"}
                <span
                  class="text-xs font-medium"
                  style={status === 'OPEN' || status === 'UP' ? 'color: var(--gh-success);' : status === 'DOWN' || status === 'MAINT' ? 'color: var(--gh-danger);' : 'color: var(--gh-fg-muted);'}
                >
                  {status}
                </span>
              {/if}
            </div>
            <h3 class="gh-tile-title mb-2" title={getDisplayName(row)}>
              {getDisplayName(row)}
            </h3>
            <dl
              class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--gh-fg-muted)]"
            >
              {#each metricKeys as key}
                {#if key !== "status"}
                  <dt class="opacity-90">{getLabel(key)}</dt>
                  <dd class="tabular-nums text-right">{getVal(row, key)}</dd>
                {/if}
              {/each}
            </dl>
          </article>
        {/each}
      </div>
      <p class="text-[var(--gh-fg-muted)] text-xs mt-3">
        Wenn die App über HAProxy erreichbar ist, erscheinen hier die
        Frontends/Backends inkl. Requests und Sessions.
      </p>
    {/if}
  </section>
{:else}
  <div
    class="rounded-lg border border-[var(--gh-border)] bg-[var(--gh-canvas-subtle)] p-4 flex items-center gap-2"
  >
    <span
      class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--gh-border)] border-t-[var(--gh-accent)]"
    ></span>
    <span class="text-[var(--gh-fg-muted)]">Status wird geladen …</span>
  </div>
{/if}
