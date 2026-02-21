<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import { onMount } from "svelte";

  /** Aktive Menü-Tabs – explizit reaktiv aus $page, damit alle Routen (nicht nur Dashboard) aktualisieren. */
  $: path = $page.url.pathname;
  $: activeDashboard = path === "/";
  $: activeConfig = path === "/config" || path.startsWith("/config/");
  $: activeAudit = path === "/audit" || path.startsWith("/audit/");
  $: configSubNav = [
    { href: "/config", label: "Übersicht" },
    { href: "/config/acme", label: "ACME-Provider" },
    { href: "/config/crt-stores", label: "Zertifikate & Stores" },
  ];
  $: isConfigOverview = path === "/config";
  $: isConfigAcme = path === "/config/acme" || path.startsWith("/config/acme/");
  $: isConfigCrtStores = path === "/config/crt-stores" || path.startsWith("/config/crt-stores/");

  let theme: "light" | "dark" = "light";

  function applyTheme(next: "light" | "dark") {
    theme = next;
    const html = document.documentElement;
    html.setAttribute("data-theme", next);
    if (next === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
    try {
      localStorage.setItem("theme", next);
    } catch (_) {}
  }

  onMount(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next =
      stored === "dark" || stored === "light"
        ? stored
        : prefersDark
          ? "dark"
          : "light";
    applyTheme(next);
  });
</script>

<svelte:head>
  <script>
    (function () {
      const stored = localStorage.getItem("theme");
      const prefersDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme =
        stored === "dark" || stored === "light"
          ? stored
          : prefersDark
            ? "dark"
            : "light";
      document.documentElement.setAttribute("data-theme", theme);
      if (theme === "dark") document.documentElement.classList.add("dark");
    })();
  </script>
</svelte:head>

<header class="gh-header">
  <div class="gh-header-brand">
    <h1 class="gh-header-title">SlateLink</h1>
    <span class="gh-header-made">HAProxy Management</span>
  </div>
  <nav class="gh-header-nav" aria-label="Hauptnavigation">
    <a
      href="/"
      class="nav-link"
      class:active={activeDashboard}
      aria-current={activeDashboard ? "page" : undefined}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="w-4 h-4"
      >
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
      Dashboard
    </a>
    <a
      href="/config"
      class="nav-link"
      class:active={activeConfig}
      aria-current={activeConfig ? "page" : undefined}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="w-4 h-4"
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
      Config
    </a>
    <a
      href="/audit"
      class="nav-link"
      class:active={activeAudit}
      aria-current={activeAudit ? "page" : undefined}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="w-4 h-4"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </svg>
      Audit
    </a>
  </nav>
  <div class="gh-header-actions">
    <button
      type="button"
      class="theme-toggle"
      title="Dark/Light umschalten"
      aria-label="Theme umschalten"
      on:click={() => applyTheme(theme === "dark" ? "light" : "dark")}
    >
      <span
        class="theme-toggle-icon theme-icon-light"
        aria-hidden="true"
        style={theme === "dark" ? "" : "display:none"}>☀</span
      >
      <span
        class="theme-toggle-icon theme-icon-dark"
        aria-hidden="true"
        style={theme === "dark" ? "display:none" : ""}>☽</span
      >
    </button>
  </div>
</header>

{#if activeConfig}
  <nav class="config-subnav" aria-label="Config-Bereiche">
    {#each configSubNav as item}
      <a
        href={item.href}
        class="config-subnav-link"
        class:active={
          item.href === "/config" ? isConfigOverview
          : item.href === "/config/acme" ? isConfigAcme
          : isConfigCrtStores
        }
        aria-current={
          (item.href === "/config" && isConfigOverview) ||
          (item.href === "/config/acme" && isConfigAcme && path === "/config/acme") ||
          (item.href === "/config/crt-stores" && isConfigCrtStores)
            ? "page"
            : undefined
        }
      >
        {item.label}
      </a>
    {/each}
  </nav>
{/if}

<div class="app-layout">
  <main class="app-content">
    <slot />
  </main>
</div>
