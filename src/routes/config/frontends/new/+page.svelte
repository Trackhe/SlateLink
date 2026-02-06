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

<div class="mb-4">
  <a href="/config" class="text-slate-600 hover:text-slate-900 text-sm">← Config</a>
</div>

<h1 class="text-2xl font-semibold mb-2">Frontend anlegen</h1>
<p class="text-slate-600 mb-6">
  Frontend mit Name, Listen-Port und Backend-Auswahl. Das Backend muss bereits existieren (z. B. unter „Backend anlegen“).
</p>

{#if error}
  <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>
{/if}

{#if !hasBackends}
  <p class="mb-4 text-amber-700 text-sm">Keine Backends vorhanden. Bitte zuerst ein <a href="/config/backends/new" class="underline">Backend anlegen</a>.</p>
{/if}

<form on:submit|preventDefault={submit} class="space-y-6 max-w-2xl">
  <section class="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
    <h2 class="font-medium text-slate-800 mb-3">Frontend (Eingang)</h2>
    <div class="grid gap-3">
      <label class="block">
        <span class="text-sm text-slate-600">Name</span>
        <input type="text" bind:value={frontendName} class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="z. B. myapp_front" />
      </label>
      <label class="block">
        <span class="text-sm text-slate-600">Backend</span>
        <select bind:value={selectedBackend} class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white" disabled={!hasBackends}>
          <option value="">– Backend wählen –</option>
          {#each data.backends as b}
            <option value={b.name}>{b.name}</option>
          {/each}
        </select>
      </label>
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="text-sm text-slate-600">Bind-Adresse</span>
          <input type="text" bind:value={bindAddress} class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="*" />
        </label>
        <label class="block">
          <span class="text-sm text-slate-600">Port</span>
          <input type="number" bind:value={bindPort} min="1" max="65535" class="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </div>
    </div>
  </section>

  <section class="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
    <h2 class="font-medium text-slate-800 mb-3">Optionen</h2>
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
    <button type="submit" disabled={busy || !hasBackends || !selectedBackend?.trim()} class="rounded-lg bg-slate-800 text-white px-4 py-2 text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
      {busy ? 'Wird angelegt …' : 'Frontend anlegen'}
    </button>
    <a href="/config" class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Abbrechen</a>
  </div>
</form>
