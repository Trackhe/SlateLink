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

<h1 class="text-2xl font-semibold mb-2 text-[var(--gh-fg)]">SlateLink</h1>
<p class="text-[var(--gh-fg-muted)] mb-6">
  Willkommen. Anbindung an die HAProxy Data Plane API (Control Plane).
  Statistiken unten zeigen den aktuellen Laufzeitstand von Frontends, Backends
  und Servern.
  <span class="block mt-2 text-sm opacity-90"
    >Du musst diese App (SlateLink) aufrufen, z. B. <code
      class="bg-[var(--gh-canvas-subtle)] px-1 rounded border border-[var(--gh-border)]"
      >http://localhost:3001</code
    >. Wenn du nur über HAProxy (z. B. localhost:80) gehst und dort ein anderer
    Dienst (z. B. Port 3000) hängt, siehst du dort nicht dieses Dashboard.</span
  >
</p>

{#if data.error}
  <div
    class="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4"
  >
    <div class="flex items-center gap-2 mb-2">
      <span
        class="inline-flex h-3 w-3 rounded-full bg-red-500"
        aria-hidden="true"
      ></span>
      <span class="font-medium text-red-800 dark:text-red-300"
        >Control Plane nicht erreichbar</span
      >
    </div>
    <p class="text-red-700 dark:text-red-400 text-sm">{data.error}</p>
    <p class="text-red-600 dark:text-red-500 text-xs mt-2">
      Prüfe <code class="bg-red-100 dark:bg-red-900/50 px-1 rounded"
        >DATAPLANE_API_URL</code
      > in .env (z. B. http://localhost:5555) und ob die Data Plane API läuft.
    </p>
  </div>
{:else if data.data}
  <div
    class="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 mb-6"
  >
    <div class="flex items-center gap-2 mb-3">
      <span
        class="inline-flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse"
        aria-hidden="true"
      ></span>
      <span class="font-medium text-emerald-800 dark:text-emerald-300"
        >Control Plane erreichbar</span
      >
    </div>
    <dl
      class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-emerald-900 dark:text-emerald-200"
    >
      {#if data.data.version}
        <dt class="text-emerald-700 dark:text-emerald-400">Version</dt>
        <dd>{data.data.version}</dd>
      {/if}
      {#if data.data.api_version}
        <dt class="text-emerald-700 dark:text-emerald-400">API</dt>
        <dd>{data.data.api_version}</dd>
      {/if}
    </dl>
    <button
      type="button"
      class="mt-3 text-sm text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 underline"
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

  <section class="mb-6">
    <h2 class="text-lg font-medium mb-2 text-[var(--gh-fg)]">
      HAProxy-Statistiken (Live)
      <span class="text-[var(--gh-fg-muted)] font-normal text-sm"
        >– Aktualisierung alle {LIVE_REFRESH_MS / 1000} s</span
      >
    </h2>
    {#if data.statsError}
      <p
        class="text-amber-700 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3"
      >
        Statistiken nicht verfügbar: {data.statsError}
      </p>
      <p class="text-[var(--gh-fg-muted)] text-xs mt-2">
        Prüfe: Data Plane API läuft (z. B. im HAProxy-Container), <code
          class="bg-[var(--gh-canvas-subtle)] px-1 rounded border border-[var(--gh-border)]"
          >DATAPLANE_API_URL</code
        > in .env zeigt auf die DPA (z. B. http://localhost:5555).
      </p>
    {:else if statsRows.length === 0}
      <p class="text-[var(--gh-fg-muted)] text-sm">
        Keine Statistik-Einträge (DPA /stats/native lieferte leeres oder anderes
        Format).
      </p>
      {#if data.rawStats != null}
        <button
          type="button"
          class="mt-2 text-sm text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg)] underline"
          on:click={() => (showStatsDebug = !showStatsDebug)}
        >
          {showStatsDebug
            ? "Roh-Antwort ausblenden"
            : "Roh-Antwort der DPA anzeigen"}
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
      <div
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
      >
        {#each statsRows as row}
          {@const type = getType(row)}
          {@const status = getVal(row, "status")}
          <article
            class="rounded-xl border border-[var(--gh-border)] bg-[var(--gh-canvas-subtle)] shadow-sm hover:shadow-md transition-shadow p-4"
          >
            <div class="flex items-center justify-between gap-2 mb-3">
              <span
                class="text-xs font-medium px-2 py-0.5 rounded-full {type ===
                'frontend'
                  ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'
                  : type === 'backend'
                    ? 'bg-violet-100 dark:bg-violet-900/60 text-violet-800 dark:text-violet-200'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}"
              >
                {type}
              </span>
              {#if status && status !== "–"}
                <span
                  class="text-xs font-medium {status === 'OPEN' ||
                  status === 'UP'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : status === 'DOWN' || status === 'MAINT'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-[var(--gh-fg-muted)]'}"
                >
                  {status}
                </span>
              {/if}
            </div>
            <h3
              class="font-semibold text-[var(--gh-fg)] truncate mb-3"
              title={getDisplayName(row)}
            >
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
