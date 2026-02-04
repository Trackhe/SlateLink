<script>
  import "../app.css";
</script>

<nav class="bg-slate-800 text-white px-4 py-2 flex gap-4">
  <a href="/" class="hover:underline">Dashboard</a>
  <a href="/config" class="hover:underline">Konfiguration</a>
  <a href="/certificates" class="hover:underline">Zertifikate</a>
  <a href="/audit" class="hover:underline">Audit-Log</a>
</nav>

<main class="p-4">
  <slot />
</main>
