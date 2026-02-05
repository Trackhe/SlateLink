<script lang="ts">
  export let data: { frontend: Record<string, unknown> | null; error: string | null };
</script>

<div class="mb-4">
  <a href="/config" class="text-slate-600 hover:text-slate-900 text-sm">← Config</a>
</div>

<h1 class="text-2xl font-semibold mb-2">Frontend: {data.frontend?.name ?? data.error ?? '—'}</h1>

{#if data.error}
  <p class="text-red-600 text-sm">{data.error}</p>
{:else if data.frontend}
  <pre class="text-sm bg-slate-50 border border-slate-200 rounded p-4 overflow-auto">{JSON.stringify(data.frontend, null, 2)}</pre>
{:else}
  <p class="text-slate-500">Nicht gefunden.</p>
{/if}
