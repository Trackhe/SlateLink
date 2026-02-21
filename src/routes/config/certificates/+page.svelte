<script lang="ts">
  import { invalidateAll } from "$app/navigation";

  type StorageCert = { storage_name?: string; file?: string };
  type AcmeCert = { certificate?: string; state?: string; expiries_in?: string; expiry_date?: string; acme_section?: string };
  type RuntimeCert = { file?: string; storage_name?: string; subject?: string; chain_issuer?: string; issuers?: string; not_after?: string; status?: string };

  export let data: {
    certificates: StorageCert[];
    acmeCertificates: AcmeCert[];
    runtimeCerts: RuntimeCert[];
    error: string | null;
  };

  $: storageNames = new Set(
    data.certificates.flatMap((c) => [c.storage_name, c.file].filter((x): x is string => typeof x === "string" && x.length > 0))
  );
  $: acmeByCert = new Map(data.acmeCertificates.map((a) => [a.certificate ?? "", a]));
  /** Nur Einträge mit echtem Zertifikat (Subject, CA oder Ablauf) – keine reinen ACME-Platzhalter. */
  $: loadedCerts = data.runtimeCerts.filter(
    (r) =>
      (typeof r.subject === "string" && r.subject.trim() !== "") ||
      (typeof r.chain_issuer === "string" && r.chain_issuer.trim() !== "") ||
      (typeof r.issuers === "string" && r.issuers.trim() !== "") ||
      (typeof r.not_after === "string" && r.not_after.trim() !== "")
  );
  function caDisplay(r: RuntimeCert): string {
    return r.chain_issuer ?? r.issuers ?? "—";
  }
  function runtimeName(r: RuntimeCert): string {
    return r.storage_name ?? r.file ?? "—";
  }
  function acmeStateForRuntime(r: RuntimeCert): string {
    const name = runtimeName(r);
    const withAt = name.startsWith("@") ? name : `@${name}`;
    return acmeByCert.get(name)?.state ?? acmeByCert.get(withAt)?.state ?? "—";
  }
  function isInStorage(r: RuntimeCert): boolean {
    const n = runtimeName(r);
    return Boolean(storageNames.has(n) || (r.storage_name != null && storageNames.has(r.storage_name)) || (r.file != null && storageNames.has(r.file)));
  }

  let fileInput: HTMLInputElement;
  let uploadError = "";
  let uploading = false;
  let deleteName: string | null = null;
  let deleteError = "";

  async function upload() {
    if (!fileInput?.files?.length) {
      uploadError = "Bitte eine PEM-Datei wählen (Cert + Key + ggf. Chain).";
      return;
    }
    const file = fileInput.files[0];
    uploading = true;
    uploadError = "";
    try {
      const formData = new FormData();
      formData.append("file_upload", file, file.name);
      const res = await fetch("/api/config/storage/ssl-certificates", {
        method: "POST",
        body: formData,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        uploadError = j.error || res.statusText;
        return;
      }
      fileInput.value = "";
      await invalidateAll();
    } catch (e) {
      uploadError = e instanceof Error ? e.message : String(e);
    } finally {
      uploading = false;
    }
  }

  async function doDelete(name: string) {
    if (!confirm(`Zertifikat „${name}“ (Storage) wirklich löschen?`)) return;
    deleteName = name;
    deleteError = "";
    try {
      const res = await fetch(
        `/api/config/storage/ssl-certificates/${encodeURIComponent(name)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        deleteError = j.error || res.statusText;
        return;
      }
      await invalidateAll();
    } catch (e) {
      deleteError = e instanceof Error ? e.message : String(e);
    } finally {
      deleteName = null;
    }
  }
</script>

<svelte:head>
  <title>SSL-Zertifikate – SlateLink</title>
</svelte:head>

<h1 class="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">
  SSL-Zertifikate
</h1>
<p class="text-sm text-slate-600 dark:text-slate-400 mb-6">
  Alle Zertifikate: hochgeladene (Storage) und per ACME verwaltete. Storage-Zertifikate können in einem CrtStore (CrtLoad) oder an einem Bind verwendet werden.
</p>

{#if data.error}
  <p class="text-red-600 dark:text-red-400 text-sm mb-4">{data.error}</p>
{/if}

<section class="mb-8">
  <h2 class="font-medium text-slate-800 dark:text-slate-100 mb-2">Zertifikat hochladen</h2>
  <p class="text-xs text-slate-500 mb-2">
    Eine PEM-Datei (Zertifikat, privater Schlüssel und ggf. Intermediate-Chain zusammengefügt).
  </p>
  <div class="flex flex-wrap gap-3 items-end">
    <input
      bind:this={fileInput}
      type="file"
      accept=".pem,.crt,.cert"
      class="text-sm"
    />
    <button
      type="button"
      on:click={upload}
      disabled={uploading}
      class="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
    >
      {uploading ? "Wird hochgeladen …" : "Hochladen"}
    </button>
  </div>
  {#if uploadError}
    <p class="text-red-600 dark:text-red-400 text-sm mt-2">{uploadError}</p>
  {/if}
</section>

<section>
  <h2 class="font-medium text-slate-800 dark:text-slate-100 mb-2">Alle Zertifikate</h2>
  {#if loadedCerts.length > 0}
    <p class="text-xs text-[var(--gh-fg-muted)] mb-2">Geladene Zertifikate von HAProxy (inkl. Subject und ausstellende CA/Chain).</p>
    <div class="border border-[var(--gh-border)] rounded-lg overflow-hidden overflow-x-auto">
      <table class="w-full text-sm text-left">
        <thead class="bg-[var(--gh-canvas-subtle)] text-[var(--gh-fg)]">
          <tr>
            <th class="px-3 py-2 font-medium">Name</th>
            <th class="px-3 py-2 font-medium">Subject</th>
            <th class="px-3 py-2 font-medium">CA / Issuer</th>
            <th class="px-3 py-2 font-medium">Ablauf</th>
            <th class="px-3 py-2 font-medium">State</th>
            <th class="px-3 py-2 font-medium w-40">Aktionen</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--gh-border)]">
          {#each loadedCerts as r}
            {@const name = runtimeName(r)}
            {@const state = acmeStateForRuntime(r)}
            {@const inStorage = isInStorage(r)}
            <tr class="bg-[var(--gh-canvas)] hover:bg-[var(--gh-btn-hover)]">
              <td class="px-3 py-2 font-medium">{name}</td>
              <td class="px-3 py-2 text-[var(--gh-fg-muted)] max-w-[200px] truncate" title={r.subject ?? ""}>{r.subject ?? "—"}</td>
              <td class="px-3 py-2 text-[var(--gh-fg-muted)] max-w-[200px] truncate" title={caDisplay(r)}>{caDisplay(r)}</td>
              <td class="px-3 py-2 text-[var(--gh-fg-muted)]">{r.not_after ?? "—"}</td>
              <td class="px-3 py-2"><code class="text-xs bg-[var(--gh-canvas-subtle)] px-1 rounded">{state}</code></td>
              <td class="px-3 py-2">
                {#if inStorage}
                  <button
                    type="button"
                    class="text-red-600 dark:text-red-400 hover:underline text-xs"
                    on:click={() => doDelete(name)}
                    disabled={deleteName === name}
                  >
                    Löschen
                  </button>
                {:else}
                  <a href="/config/crt-stores" class="text-[var(--gh-accent)] hover:underline text-xs">Im Store verwalten</a>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="text-slate-500 dark:text-slate-400 text-sm">Nur geladene Zertifikate werden angezeigt. Aktuell keine.</p>
  {/if}
  {#if deleteError}
    <p class="text-red-600 dark:text-red-400 text-sm mt-2">{deleteError}</p>
  {/if}
</section>
