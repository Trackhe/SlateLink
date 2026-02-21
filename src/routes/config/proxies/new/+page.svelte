<script lang="ts">
  import { goto } from '$app/navigation';

  let busy = false;
  let error = '';
  let frontendName = '';
  let bindAddress = '*';
  let bindPort = 80;
  let backendName = '';
  let servers: { name: string; address: string; port: number }[] = [
    { name: 'srv1', address: 'host.docker.internal', port: 3000 }
  ];
  let forwardClientIp = true;
  let websocketSupport = false;
  let forwardProto = true;

  function addServer() {
    servers = [...servers, { name: `srv${servers.length + 1}`, address: '', port: 80 }];
  }
  function removeServer(i: number) {
    servers = servers.filter((_, idx) => idx !== i);
  }

  async function submit() {
    error = '';
    if (!frontendName.trim() || !backendName.trim()) {
      error = 'Frontend- und Backend-Name sind Pflicht.';
      return;
    }
    const valid = servers.filter((s) => s.address.trim());
    if (valid.length === 0) {
      error = 'Mindestens ein Server (Adresse) ist nötig.';
      return;
    }
    busy = true;
    try {
      const res = await fetch('/api/config/proxies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frontendName: frontendName.trim(),
          bindAddress: bindAddress.trim() || '*',
          bindPort: Number(bindPort) || 80,
          backendName: backendName.trim(),
          servers: valid.map((s) => ({
            name: s.name.trim() || s.address.replace(/[.:]/g, '_'),
            address: s.address.trim(),
            port: Number(s.port) || 80
          })),
          options: {
            forwardClientIp,
            websocketSupport,
            forwardProto
          }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        error = data.error || res.statusText;
        return;
      }
      await goto('/config');
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<div class="page-header">
  <a href="/config" class="text-sm text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg)]">← Config</a>
  <h1 class="page-title">Neuen Proxy anlegen</h1>
  <p class="page-intro">
    Legt ein neues Frontend (Listen-Port), ein Backend und Server an – ähnlich Nginx Proxy Manager. Optionen: Client-IP-Weitergabe (X-Forwarded-For), WebSocket (lange Timeouts), X-Forwarded-Proto für HTTPS.
  </p>
</div>

{#if error}
  <div class="gh-alert config-section">{error}</div>
{/if}

<form on:submit|preventDefault={submit} class="space-y-6 max-w-2xl">
  <section class="gh-form-section">
    <h3>Frontend (Eingang)</h3>
    <div class="grid gap-3">
      <label class="block">
        <span class="text-sm text-[var(--gh-fg-muted)]">Name</span>
        <input type="text" bind:value={frontendName} class="gh-input mt-1 block w-full" placeholder="z. B. myapp_front" />
      </label>
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="text-sm text-[var(--gh-fg-muted)]">Bind-Adresse</span>
          <input type="text" bind:value={bindAddress} class="gh-input mt-1 block w-full" placeholder="*" />
        </label>
        <label class="block">
          <span class="text-sm text-[var(--gh-fg-muted)]">Port</span>
          <input type="number" bind:value={bindPort} min="1" max="65535" class="gh-input mt-1 block w-full" />
        </label>
      </div>
    </div>
  </section>

  <section class="gh-form-section">
    <h3>Backend & Server</h3>
    <label class="block mb-3">
      <span class="text-sm text-[var(--gh-fg-muted)]">Backend-Name</span>
      <input type="text" bind:value={backendName} class="gh-input mt-1 block w-full" placeholder="z. B. myapp_backend" />
    </label>
    <p class="text-sm text-[var(--gh-fg-muted)] mb-2">Server (Adresse:Port, z. B. host.docker.internal:3000)</p>
    {#each servers as srv, i}
      <div class="flex gap-2 items-end mb-2">
        <input type="text" bind:value={srv.name} placeholder="Name" class="gh-input w-24" />
        <input type="text" bind:value={srv.address} placeholder="Adresse" class="gh-input flex-1" />
        <input type="number" bind:value={srv.port} min="1" max="65535" class="gh-input w-20" />
        <button type="button" on:click={() => removeServer(i)} class="text-[var(--gh-fg-muted)] hover:text-[var(--gh-danger)] text-sm" title="Server entfernen">✕</button>
      </div>
    {/each}
    <button type="button" on:click={addServer} class="text-sm text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg)] underline">+ Server hinzufügen</button>
  </section>

  <section class="gh-form-section">
    <h3>Optionen</h3>
    <ul class="space-y-2 text-sm">
      <li class="flex items-center gap-2">
        <input type="checkbox" bind:checked={forwardClientIp} id="opt-forward" />
        <label for="opt-forward">Client-IP weitergeben (X-Forwarded-For) – für WordPress, Logs, Rate-Limiting</label>
      </li>
      <li class="flex items-center gap-2">
        <input type="checkbox" bind:checked={forwardProto} id="opt-proto" />
        <label for="opt-proto">X-Forwarded-Proto setzen (HTTPS hinter Proxy)</label>
      </li>
      <li class="flex items-center gap-2">
        <input type="checkbox" bind:checked={websocketSupport} id="opt-ws" />
        <label for="opt-ws">WebSocket-Unterstützung (lange Timeouts, 1 h)</label>
      </li>
    </ul>
  </section>

  <div class="flex gap-3">
    <button type="submit" disabled={busy} class="btn btn-primary">
      {busy ? 'Wird angelegt …' : 'Proxy anlegen'}
    </button>
    <a href="/config" class="btn btn-secondary">Abbrechen</a>
  </div>
</form>
