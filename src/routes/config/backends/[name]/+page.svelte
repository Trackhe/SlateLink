<script lang="ts">
  import { goto } from '$app/navigation';

  export let data: {
    backend: Record<string, unknown> | null;
    frontendsUsingThis: string[];
    canDelete: boolean;
    error: string | null;
  };

  let deleting = false;
  let deleteError = '';

  async function doDelete() {
    if (!data.canDelete || !data.backend?.name) return;
    if (!confirm(`Backend „${data.backend.name}“ wirklich löschen?`)) return;
    deleting = true;
    deleteError = '';
    try {
      const res = await fetch(`/api/config/backends/${encodeURIComponent(String(data.backend.name))}`, {
        method: 'DELETE'
      });
      if (res.status === 409) {
        const j = await res.json();
        deleteError = j.error || 'Löschen nicht möglich.';
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        deleteError = j.error || res.statusText;
        return;
      }
      await goto('/config');
    } catch (e) {
      deleteError = e instanceof Error ? e.message : String(e);
    } finally {
      deleting = false;
    }
  }
</script>

<div class="mb-4">
  <a href="/config" class="text-slate-600 hover:text-slate-900 text-sm">← Config</a>
</div>

<h1 class="text-2xl font-semibold mb-2">Backend: {data.backend?.name ?? data.error ?? '—'}</h1>

{#if data.error}
  <p class="text-red-600 text-sm">{data.error}</p>
{:else if data.backend}
  <pre class="text-sm bg-slate-50 border border-slate-200 rounded p-4 overflow-auto mb-4">{JSON.stringify(data.backend, null, 2)}</pre>

  {#if data.frontendsUsingThis.length > 0}
    <p class="text-amber-700 text-sm mb-2">
      Dieses Backend kann nicht gelöscht werden: folgende Frontends verweisen darauf:
      <strong>{data.frontendsUsingThis.join(', ')}</strong>. Entferne zuerst die Frontends oder weise ihnen ein anderes Backend zu.
    </p>
  {:else}
    {#if deleteError}
      <p class="text-red-600 text-sm mb-2">{deleteError}</p>
    {/if}
    <button
      type="button"
      class="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 hover:bg-red-100 disabled:opacity-50"
      disabled={deleting}
      on:click={doDelete}
    >
      {deleting ? 'Wird gelöscht …' : 'Backend löschen'}
    </button>
  {/if}
{:else}
  <p class="text-slate-500">Nicht gefunden.</p>
{/if}
