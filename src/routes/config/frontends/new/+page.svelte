<script lang="ts">
  import { goto } from '$app/navigation';

  export let data: { backends: { name: string }[] };

  let busy = false;
  let error = '';
  let frontendName = '';
  let bindAddress = '*';
  let bindPort = 80;
  let selectedBackend = '';
  let forwardClientIp = true;
  let websocketSupport = false;
  let forwardProto = true;

  $: hasBackends = Array.isArray(data.backends) && data.backends.length > 0;

  async function submit() {
    error = '';
    if (!frontendName.trim()) {
      error = 'Frontend-Name ist Pflicht.';
      return;
    }
    if (!selectedBackend?.trim()) {
      error = 'Bitte ein Backend auswählen. Zuerst unter Config ein Backend anlegen.';
      return;
    }
    busy = true;
    try {
      const res = await fetch('/api/config/frontends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: frontendName.trim(),
          default_backend: selectedBackend.trim(),
          bindAddress: bindAddress.trim() || '*',
          bindPort: Number(bindPort) || 80,
          options: {
            forwardClientIp,
            websocketSupport,
            forwardProto
          }
        })
      });
      const result = await res.json();
      if (!res.ok) {
        error = result.error || res.statusText;
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
  <h1 class="page-title">Frontend anlegen</h1>
  <p class="page-intro">
    Frontend mit Name, Listen-Port und Backend-Auswahl. Das Backend muss bereits existieren (z. B. unter „Backend anlegen“).
  </p>
</div>

{#if error}
  <div class="gh-alert config-section">{error}</div>
{/if}

{#if !hasBackends}
  <p class="gh-alert-warning config-section">Keine Backends vorhanden. Bitte zuerst ein <a href="/config/backends/new" class="underline">Backend anlegen</a>.</p>
{/if}

<form on:submit|preventDefault={submit} class="space-y-6 max-w-2xl">
  <section class="gh-form-section">
    <h3>Frontend (Eingang)</h3>
    <div class="grid gap-3">
      <label class="block">
        <span class="text-sm text-[var(--gh-fg-muted)]">Name</span>
        <input type="text" bind:value={frontendName} class="gh-input mt-1 block w-full" placeholder="z. B. myapp_front" />
      </label>
      <label class="block">
        <span class="text-sm text-[var(--gh-fg-muted)]">Backend</span>
        <select bind:value={selectedBackend} class="gh-select mt-1 block w-full" disabled={!hasBackends}>
          <option value="">– Backend wählen –</option>
          {#each data.backends as b}
            <option value={b.name}>{b.name}</option>
          {/each}
        </select>
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
    <h3>Optionen</h3>
    <ul class="space-y-2 text-sm">
      <li class="flex items-center gap-2">
        <input type="checkbox" bind:checked={forwardClientIp} id="opt-forward" />
        <label for="opt-forward">Client-IP weitergeben (X-Forwarded-For)</label>
      </li>
      <li class="flex items-center gap-2">
        <input type="checkbox" bind:checked={forwardProto} id="opt-proto" />
        <label for="opt-proto">X-Forwarded-Proto setzen (HTTPS hinter Proxy)</label>
      </li>
      <li class="flex items-center gap-2">
        <input type="checkbox" bind:checked={websocketSupport} id="opt-ws" />
        <label for="opt-ws">WebSocket-Unterstützung (lange Timeouts)</label>
      </li>
    </ul>
  </section>

  <div class="flex gap-3">
    <button type="submit" disabled={busy || !hasBackends || !selectedBackend?.trim()} class="btn btn-primary">
      {busy ? 'Wird angelegt …' : 'Frontend anlegen'}
    </button>
    <a href="/config" class="btn btn-secondary">Abbrechen</a>
  </div>
</form>
