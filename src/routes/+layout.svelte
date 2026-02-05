<script>
  import "../app.css";
  import { page } from "$app/stores";
</script>

<header class="border-b border-slate-200 bg-white">
  <nav class="flex gap-4 p-4" aria-label="Hauptnavigation">
    <a
      href="/"
      class="font-medium {$page.url.pathname === '/' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}"
    >
      Dashboard
    </a>
    <a
      href="/config"
      class="font-medium {$page.url.pathname === '/config' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}"
    >
      Config
    </a>
    <a
      href="/certificates"
      class="font-medium {$page.url.pathname === '/certificates' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}"
    >
      Certificates
    </a>
    <a
      href="/audit"
      class="font-medium {$page.url.pathname === '/audit' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}"
    >
      Audit
    </a>
  </nav>
</header>

<main class="p-4">
  <slot />
</main>
