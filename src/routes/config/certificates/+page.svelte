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

<div class="page-header">
  <h1 class="page-title">SSL-Zertifikate</h1>
  <p class="page-intro">
    Alle Zertifikate: hochgeladene (Storage) und per ACME verwaltete. Storage-Zertifikate können in einem CrtStore (CrtLoad) oder an einem Bind verwendet werden.
  </p>
</div>

{#if data.error}
  <p class="gh-error">{data.error}</p>
{/if}

<section class="config-section">
  <h2 class="config-section-title">Zertifikat hochladen</h2>
  <p class="config-section-intro">
    Eine PEM-Datei (Zertifikat, privater Schlüssel und ggf. Intermediate-Chain zusammengefügt).
  </p>
  <div class="flex flex-wrap gap-3 items-center">
    <input
      bind:this={fileInput}
      type="file"
      accept=".pem,.crt,.cert"
      class="text-sm file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border file:border-[var(--gh-border)] file:bg-[var(--gh-canvas-subtle)] file:text-sm file:text-[var(--gh-fg)] file:cursor-pointer hover:file:bg-[var(--gh-btn-hover)]"
    />
    <button type="button" class="btn btn-primary" on:click={upload} disabled={uploading}>
      {uploading ? "Wird hochgeladen …" : "Hochladen"}
    </button>
  </div>
  {#if uploadError}
    <p class="gh-error">{uploadError}</p>
  {/if}
</section>

<section class="config-section">
  <h2 class="config-section-title">Alle Zertifikate</h2>
  {#if loadedCerts.length > 0}
    <p class="config-section-intro">Geladene Zertifikate von HAProxy (inkl. Subject und ausstellende CA/Chain).</p>
    <div class="border border-[var(--gh-border)] rounded-lg overflow-hidden overflow-x-auto">
      <table class="w-full text-sm text-left">
        <thead class="bg-[var(--gh-canvas-subtle)]">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--gh-fg-muted)]">Name</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--gh-fg-muted)]">Subject</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--gh-fg-muted)]">CA / Issuer</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--gh-fg-muted)]">Ablauf</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--gh-fg-muted)]">State</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--gh-fg-muted)] w-40">Aktionen</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--gh-border)]">
          {#each loadedCerts as r}
            {@const name = runtimeName(r)}
            {@const state = acmeStateForRuntime(r)}
            {@const inStorage = isInStorage(r)}
            <tr class="bg-[var(--gh-canvas)] hover:bg-[var(--gh-canvas-subtle)]">
              <td class="px-4 py-3 font-medium text-[var(--gh-fg)]">{name}</td>
              <td class="px-4 py-3 text-[var(--gh-fg-muted)] max-w-[200px] truncate" title={r.subject ?? ""}>{r.subject ?? "—"}</td>
              <td class="px-4 py-3 text-[var(--gh-fg-muted)] max-w-[200px] truncate" title={caDisplay(r)}>{caDisplay(r)}</td>
              <td class="px-4 py-3 text-[var(--gh-fg-muted)]">{r.not_after ?? "—"}</td>
              <td class="px-4 py-3">
                <span class="gh-badge">{state}</span>
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-2 items-center">
                  {#if inStorage}
                    <button
                      type="button"
                      class="btn btn-delete btn--sm"
                      on:click={() => doDelete(name)}
                      disabled={deleteName === name}
                    >
                      Löschen
                    </button>
                  {:else}
                    <a href="/config/crt-stores" class="btn btn-secondary btn--sm">
                      Im Store verwalten
                    </a>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="config-section-intro" style="margin-bottom: 0;">Nur geladene Zertifikate werden angezeigt. Aktuell keine.</p>
  {/if}
  {#if deleteError}
    <p class="gh-error">{deleteError}</p>
  {/if}
</section>
