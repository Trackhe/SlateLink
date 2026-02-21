<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import CrtStoreBlock from "./CrtStoreBlock.svelte";
  import type { RuntimeCert } from "./+page.server";

  type StorageCert = { storage_name?: string; file?: string };
  type AcmeCert = { certificate?: string; state?: string; expiries_in?: string; expiry_date?: string; acme_section?: string };
  type ParsedCertInfo = {
    subject: string;
    issuer: string;
    serialNumber: string;
    notBefore: string;
    notAfter: string;
    fingerprintSha1: string;
    fingerprint256: string;
    keyType: string | null;
    keyInfo: string | null;
    signatureAlgorithm: string | null;
    subjectAltName: string | null;
  };

  export let data: {
    stores: {
      name: string;
      crt_base: string;
      key_base: string;
      loads: Record<string, unknown>[];
    }[];
    acmeProviders: string[];
    acmeStatus: { certificate?: string; state?: string; expiries_in?: string; expiry_date?: string; acme_section?: string; scheduled_renewal?: string; renewal_in?: string }[];
    certificates: StorageCert[];
    acmeCertificates: AcmeCert[];
    runtimeCerts: RuntimeCert[];
    certsUsedInBinds: string[];
    error: string | null;
  };

  $: storageNames = (() => {
    const names = new Set<string>();
    for (const c of data.certificates ?? []) {
      for (const x of [c.storage_name, c.file].filter((v): v is string => typeof v === "string" && v.length > 0)) {
        names.add(x);
        const afterSlash = x.includes("/") ? x.slice(x.lastIndexOf("/") + 1) : null;
        if (afterSlash) names.add(afterSlash);
      }
    }
    return names;
  })();
  $: acmeByCert = new Map((data.acmeCertificates ?? []).map((a) => [a.certificate ?? "", a]));
  $: loadedCerts = (data.runtimeCerts ?? []).filter(
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
    if (storageNames.has(n)) return true;
    if (r.storage_name != null && storageNames.has(r.storage_name)) return true;
    if (r.file != null && storageNames.has(r.file)) return true;
    const filePart = n.includes("/") ? n.slice(n.lastIndexOf("/") + 1) : null;
    return filePart != null && storageNames.has(filePart);
  }
  function isCertNameInStorage(fullName: string): boolean {
    if (storageNames.has(fullName)) return true;
    const filePart = fullName.includes("/") ? fullName.slice(fullName.lastIndexOf("/") + 1) : null;
    return filePart != null && storageNames.has(filePart);
  }

  let name = "";
  let submitError = "";
  let submitting = false;
  let deleteError = "";
  let deletingName: string | null = null;
  /** Zertifikat für Detail-Modal (View). */
  let viewCert: RuntimeCert | null = null;
  /** PEM + Runtime + Leaf (aus PEM geparst) für das geöffnete Zertifikat (per API geladen). */
  let viewCertPem: string | null = null;
  let viewCertRuntime: Record<string, unknown> | null = null;
  let viewCertLeaf: ParsedCertInfo | null = null;
  /** Alle Zertifikate der Kette (0 = Leaf, 1 = i. d. R. Intermediate, 2 = i. d. R. Root). */
  let viewCertChain: ParsedCertInfo[] = [];
  let viewCertPemLoading = false;
  let lastFetchedViewCertId = "";
  let syncInProgress = false;
  let syncResult: { saved: string[]; errors: { name: string; error: string }[] } | null = null;

  $: ramOnlyCount = loadedCerts.filter((r) => !isInStorage(r)).length;

  /** Erkennt im PEM: Anzahl Zertifikate (Kette vs. Einzelcert) und ob ein privater Schlüssel enthalten ist. */
  function parsePemContents(pem: string): { certCount: number; hasPrivateKey: boolean } {
    const certCount = (pem.match(/-----BEGIN CERTIFICATE-----/g) ?? []).length;
    const hasPrivateKey = /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|-----BEGIN ENCRYPTED PRIVATE KEY-----/m.test(pem);
    return { certCount, hasPrivateKey };
  }

  $: viewCertPemInfo = viewCertPem ? parsePemContents(viewCertPem) : null;

  /** Felder von der DPA: Wenn wir schon Leaf aus PEM haben, nur Kette/Status (Leaf-Felder oben). Fingerprints hier trotzdem mit, da DPA oft gleiche Werte liefert. */
  const certInfoFieldsDpaOnly: { key: string; label: string }[] = [
    { key: "sha256_finger_print", label: "Fingerprint (SHA-256)" },
    { key: "chain_issuer", label: "Chain Issuer (Root CA)" },
    { key: "chain_subject", label: "Chain Subject (Root CA)" },
    { key: "issuers", label: "Issuer(s) (i. d. R. Intermediate CA)" },
    { key: "algorithm", label: "Algorithmus" },
    { key: "subject_alternative_names", label: "Subject Alternative Names" },
    { key: "domains", label: "Domains" },
    { key: "ip_addresses", label: "IP-Adressen" },
    { key: "authority_key_id", label: "Authority Key ID" },
    { key: "subject_key_id", label: "Subject Key ID" },
    { key: "file", label: "Datei (file)" },
    { key: "storage_name", label: "Storage-Name" },
    { key: "size", label: "Größe (Bytes)" },
    { key: "status", label: "Status" },
    { key: "description", label: "Beschreibung" },
  ];
  /** Alle DPA-Felder (wenn kein Leaf geparst, alles anzeigen). */
  const certInfoFieldsAll: { key: string; label: string }[] = [
    { key: "subject", label: "Subject" },
    { key: "issuers", label: "Issuer(s)" },
    { key: "chain_issuer", label: "Chain Issuer" },
    { key: "chain_subject", label: "Chain Subject" },
    { key: "not_before", label: "Gültig ab (Not Before)" },
    { key: "not_after", label: "Gültig bis (Not After)" },
    { key: "serial", label: "Seriennummer" },
    { key: "sha256_finger_print", label: "Fingerprint (SHA-256)" },
    { key: "algorithm", label: "Algorithmus" },
    { key: "subject_alternative_names", label: "Subject Alternative Names" },
    { key: "domains", label: "Domains" },
    { key: "ip_addresses", label: "IP-Adressen" },
    { key: "authority_key_id", label: "Authority Key ID" },
    { key: "subject_key_id", label: "Subject Key ID" },
    { key: "file", label: "Datei (file)" },
    { key: "storage_name", label: "Storage-Name" },
    { key: "size", label: "Größe (Bytes)" },
    { key: "status", label: "Status" },
    { key: "description", label: "Beschreibung" },
  ];

  $: if (viewCert) {
    const id = runtimeName(viewCert);
    if (id && id !== lastFetchedViewCertId) {
      lastFetchedViewCertId = id;
      viewCertPem = null;
      viewCertRuntime = null;
      viewCertLeaf = null;
      viewCertChain = [];
      viewCertPemLoading = true;
      const pathSegments = id.split("/").map(encodeURIComponent).join("/");
      fetch(`/api/config/certificates/${pathSegments}`)
        .then((r) => r.json())
        .then((d: { pem?: string; runtime?: Record<string, unknown>; leaf?: ParsedCertInfo | null; chain?: ParsedCertInfo[] }) => {
          viewCertPem = d.pem ?? null;
          viewCertRuntime = d.runtime && typeof d.runtime === "object" ? d.runtime : null;
          viewCertLeaf = d.leaf && typeof d.leaf === "object" ? d.leaf : null;
          viewCertChain = Array.isArray(d.chain) ? d.chain.filter((c): c is ParsedCertInfo => c != null && typeof c.subject === "string") : [];
          viewCertPemLoading = false;
        })
        .catch(() => {
          viewCertPemLoading = false;
        });
    }
  }
  $: if (!viewCert) {
    lastFetchedViewCertId = "";
    viewCertPem = null;
    viewCertRuntime = null;
    viewCertLeaf = null;
    viewCertChain = [];
  }

  /** Welche Stores sind aufgeklappt (erster Store standardmäßig). */
  let expandedStores: Set<string> = new Set(
    data.stores.length > 0 ? [data.stores[0].name] : []
  );

  function toggleStore(storeName: string) {
    const next = new Set(expandedStores);
    if (next.has(storeName)) next.delete(storeName);
    else next.add(storeName);
    expandedStores = next;
  }

  async function submit() {
    const n = name.trim();
    if (!n) {
      submitError = "Name ist Pflicht (nur A-Za-z0-9-_).";
      return;
    }
    if (!/^[A-Za-z0-9-_]+$/.test(n)) {
      submitError = "Name darf nur Buchstaben, Ziffern, - und _ enthalten.";
      return;
    }
    submitting = true;
    submitError = "";
    try {
      const res = await fetch("/api/config/crt-stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        submitError = (j as { error?: string }).error || res.statusText;
        return;
      }
      name = "";
      await invalidateAll();
    } catch (e) {
      submitError = e instanceof Error ? e.message : String(e);
    } finally {
      submitting = false;
    }
  }

  async function doDelete(storeName: string) {
    if (!confirm(`Zertifikat-Store „${storeName}“ wirklich löschen?`)) return;
    deletingName = storeName;
    deleteError = "";
    try {
      const res = await fetch(
        `/api/config/crt-stores/${encodeURIComponent(storeName)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        deleteError = (j as { error?: string }).error || res.statusText;
        return;
      }
      await invalidateAll();
      deletingName = null;
    } catch (e) {
      deleteError = e instanceof Error ? e.message : String(e);
    } finally {
      deletingName = null;
    }
  }


  async function syncRamToStorage() {
    syncInProgress = true;
    syncResult = null;
    try {
      const res = await fetch("/api/config/certificates/sync-from-runtime", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      syncResult = {
        saved: Array.isArray((j as { saved?: string[] }).saved) ? (j as { saved: string[] }).saved : [],
        errors: Array.isArray((j as { errors?: { name: string; error: string }[] }).errors) ? (j as { errors: { name: string; error: string }[] }).errors : []
      };
      await invalidateAll();
    } catch (e) {
      syncResult = { saved: [], errors: [{ name: "", error: e instanceof Error ? e.message : String(e) }] };
    } finally {
      syncInProgress = false;
    }
  }
</script>

<svelte:head>
  <title>Zertifikate & Stores – SlateLink</title>
</svelte:head>
<svelte:window on:keydown={(e) => e.key === 'Escape' && viewCert && (viewCert = null)} />

<div class="page-header">
  <h1 class="page-title">Zertifikate & Stores</h1>
  <p class="page-intro">
    Stores (CrtStore) fassen Zertifikate (CrtLoad). Zertifikate können selbst hochgeladen oder per ACME verwaltet werden.
    Ein Bind referenziert einen Store per <code class="gh-code">ssl_certificate</code>.
    Stores anlegen und Zertifikate (CrtLoad) zuordnen.
  </p>
</div>

{#if data.error}
  <p class="gh-error">{data.error}</p>
{/if}

{#if ramOnlyCount > 0}
  <div class="config-section flex flex-wrap items-center gap-2">
    <button
      type="button"
      class="btn"
      on:click={syncRamToStorage}
      disabled={syncInProgress}
      title="Speichert alle nur im RAM liegenden Zertifikate in den Storage (ssl_certs_dir), damit HAProxy sie beim nächsten Start von der Platte lädt."
    >
      {syncInProgress ? "Speichere …" : "RAM-Zertifikate in Storage speichern"}
    </button>
    <span class="cert-tree__meta" style="margin:0">{ramOnlyCount} Zertifikat{ramOnlyCount === 1 ? "" : "e"} nur im RAM</span>
  </div>
{/if}
{#if syncResult}
  <div class="config-section text-sm">
    {#if syncResult.saved.length > 0}
      <p class="text-green-700 dark:text-green-400">Gespeichert: {syncResult.saved.join(", ")}</p>
    {/if}
    {#if syncResult.errors.length > 0}
      <p class="gh-error">Fehler: {syncResult.errors.map((e) => (e.name ? `${e.name}: ${e.error}` : e.error)).join("; ")}</p>
    {/if}
  </div>
{/if}

{#if viewCert}
    {@const name = runtimeName(viewCert)}
    {@const state = acmeStateForRuntime(viewCert)}
    {@const inStorage = isInStorage(viewCert)}
    <div class="modal-overlay open" style="display: flex;">
      <button
        type="button"
        class="absolute inset-0 w-full h-full border-0 cursor-default"
        aria-label="Modal schließen"
        on:click={() => (viewCert = null)}
      />
      <div
        class="modal relative p-5 min-w-[320px] mx-4"
        style="max-width: 56rem;"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cert-view-modal-title"
      >
        <h3 id="cert-view-modal-title" class="config-section-title">Zertifikat-Details</h3>
        <dl class="text-sm space-y-2">
          <div>
            <dt class="text-[var(--gh-fg-muted)]">Name</dt>
            <dd class="font-medium text-[var(--gh-fg)]">{name}</dd>
          </div>
          {#if viewCertLeaf}
            <div class="pt-2 mt-2 border-t border-[var(--gh-border)]">
              <dt class="text-[var(--gh-fg-muted)] font-medium mb-1">Leaf-Zertifikat (aus PEM)</dt>
              <dd class="sr-only">Details des ersten Zertifikats im PEM (Server-Zertifikat)</dd>
            </div>
            <div>
              <dt class="text-[var(--gh-fg-muted)]">Subject</dt>
              <dd class="text-[var(--gh-fg-muted)] break-all font-mono text-xs">{viewCertLeaf.subject}</dd>
            </div>
            <div>
              <dt class="text-[var(--gh-fg-muted)]">Issuer</dt>
              <dd class="text-[var(--gh-fg-muted)] break-all font-mono text-xs">{viewCertLeaf.issuer}</dd>
            </div>
            <div>
              <dt class="text-[var(--gh-fg-muted)]">Seriennummer</dt>
              <dd class="text-[var(--gh-fg-muted)] font-mono text-xs">{viewCertLeaf.serialNumber}</dd>
            </div>
            <div>
              <dt class="text-[var(--gh-fg-muted)]">Gültig ab (Not Before)</dt>
              <dd class="text-[var(--gh-fg-muted)] font-mono text-xs">{viewCertLeaf.notBefore}</dd>
            </div>
            <div>
              <dt class="text-[var(--gh-fg-muted)]">Gültig bis (Not After)</dt>
              <dd class="text-[var(--gh-fg-muted)] font-mono text-xs">{viewCertLeaf.notAfter}</dd>
            </div>
            <div>
              <dt class="text-[var(--gh-fg-muted)]">Fingerprint (SHA-256)</dt>
              <dd class="text-[var(--gh-fg-muted)] font-mono text-xs break-all">{viewCertLeaf.fingerprint256}</dd>
            </div>
            {#if viewCertLeaf.keyType ?? viewCertLeaf.keyInfo}
              <div>
                <dt class="text-[var(--gh-fg-muted)]">Schlüsseltyp</dt>
                <dd class="text-[var(--gh-fg-muted)] font-mono text-xs">{viewCertLeaf.keyType ?? "—"} {#if viewCertLeaf.keyInfo}({viewCertLeaf.keyInfo}){/if}</dd>
              </div>
            {/if}
            {#if viewCertLeaf.signatureAlgorithm}
              <div>
                <dt class="text-[var(--gh-fg-muted)]">Signaturalgorithmus</dt>
                <dd class="text-[var(--gh-fg-muted)] font-mono text-xs">{viewCertLeaf.signatureAlgorithm}</dd>
              </div>
            {/if}
            {#if viewCertLeaf.subjectAltName}
              <div>
                <dt class="text-[var(--gh-fg-muted)]">Subject Alternative Names</dt>
                <dd class="text-[var(--gh-fg-muted)] break-all font-mono text-xs">{viewCertLeaf.subjectAltName}</dd>
              </div>
            {/if}
          {/if}
          {#if viewCertChain.length > 1}
            {#each viewCertChain.slice(1) as cert, i}
              {@const pos = i + 2}
              {@const label = viewCertChain.length === 2 ? "Intermediate CA (2. Zertifikat)" : pos === 2 ? "Intermediate CA (2. Zertifikat)" : pos === viewCertChain.length ? "Root CA (letztes Zertifikat)" : `${pos}. Zertifikat`}
                <div class="pt-2 mt-2 border-t border-[var(--gh-border)]">
                  <dt class="text-[var(--gh-fg-muted)] font-medium mb-1">{label}</dt>
                  <dd class="sr-only">Fingerprints und Metadaten dieses Kette-Zertifikats</dd>
                </div>
                <div>
                  <dt class="text-[var(--gh-fg-muted)]">Subject</dt>
                  <dd class="text-[var(--gh-fg-muted)] break-all font-mono text-xs">{cert.subject}</dd>
                </div>
                <div>
                  <dt class="text-[var(--gh-fg-muted)]">Issuer</dt>
                  <dd class="text-[var(--gh-fg-muted)] break-all font-mono text-xs">{cert.issuer}</dd>
                </div>
                <div>
                  <dt class="text-[var(--gh-fg-muted)]">Fingerprint (SHA-256)</dt>
                  <dd class="text-[var(--gh-fg-muted)] font-mono text-xs break-all">{cert.fingerprint256}</dd>
                </div>
            {/each}
          {/if}
          {#if viewCertRuntime}
            {@const dpaFields = viewCertLeaf ? certInfoFieldsDpaOnly : certInfoFieldsAll}
            <div class="pt-2 mt-2 border-t border-[var(--gh-border)]">
              <dt class="text-[var(--gh-fg-muted)] font-medium mb-1">HAProxy Data Plane API (Kette & Status)</dt>
              <dd class="text-xs text-[var(--gh-fg-muted)] mb-1">Chain Issuer/Subject = Root CA. Issuer(s) = ausstellende CA (oft Intermediate). Dazu Speicher- und Lade-Status.</dd>
            </div>
            {#each dpaFields as { key, label }}
              {@const val = viewCertRuntime[key]}
              {#if val !== undefined && val !== null && val !== ""}
                <div>
                  <dt class="text-[var(--gh-fg-muted)]">{label}</dt>
                  <dd class="text-[var(--gh-fg-muted)] break-all font-mono text-xs">{typeof val === "object" ? JSON.stringify(val) : String(val)}</dd>
                </div>
              {/if}
            {/each}
          {:else if !viewCertPemLoading && !viewCertLeaf}
            <div>
              <dt class="text-[var(--gh-fg-muted)]">Subject</dt>
              <dd class="text-[var(--gh-fg-muted)] break-all">{viewCert.subject ?? "—"}</dd>
            </div>
            <div>
              <dt class="text-[var(--gh-fg-muted)]">CA / Issuer</dt>
              <dd class="text-[var(--gh-fg-muted)] break-all">{caDisplay(viewCert)}</dd>
            </div>
            <div>
              <dt class="text-[var(--gh-fg-muted)]">Gültig bis (Ablauf)</dt>
              <dd class="text-[var(--gh-fg-muted)]">{viewCert.not_after ?? "—"}</dd>
            </div>
          {/if}
          <div>
            <dt class="text-[var(--gh-fg-muted)]">State (ACME)</dt>
            <dd><code class="text-xs bg-[var(--gh-canvas-subtle)] px-1 rounded">{state}</code></dd>
          </div>
          <div>
            <dt class="text-[var(--gh-fg-muted)]">Speicher</dt>
            <dd>
              {#if inStorage}
                <span class="text-green-700 dark:text-green-400 text-xs">Gespeichert (ssl_certs_dir)</span>
              {:else}
                <span class="gh-badge gh-badge--hint">Nur im RAM (DPA)</span>
              {/if}
            </dd>
          </div>
        </dl>
        <div class="mt-3">
          <dt class="text-[var(--gh-fg-muted)] text-sm font-medium mb-1">PEM / Zertifikat</dt>
          {#if viewCertPemLoading}
            <p class="text-sm text-[var(--gh-fg-muted)]">Lade …</p>
          {:else if viewCertPem}
            {#if viewCertPemInfo}
              <div class="flex flex-wrap gap-2 mb-2">
                {#if viewCertPemInfo.certCount > 1}
                  <span class="gh-badge" title="Mehrere Zertifikate im PEM (Leaf + Intermediate/Root)">Zertifikatskette ({viewCertPemInfo.certCount} Zertifikate)</span>
                {:else if viewCertPemInfo.certCount === 1}
                  <span class="gh-badge">Einzelzertifikat</span>
                {/if}
                {#if viewCertPemInfo.hasPrivateKey}
                  <span class="gh-badge gh-badge--hint" title="PEM enthält einen privaten Schlüssel">privater Schlüssel</span>
                {/if}
              </div>
            {/if}
            <pre class="text-xs bg-[var(--gh-canvas-subtle)] border border-[var(--gh-border)] rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all font-mono text-[var(--gh-fg-muted)]">{viewCertPem}</pre>
          {:else}
            <p class="text-xs text-[var(--gh-fg-muted)]">Die Data Plane API liefert für dieses Zertifikat keinen PEM-Inhalt (nur Metadaten). Bei „Nur im RAM (DPA)“ ist das Zertifikat noch nicht auf Disk; bei gespeicherten Zertifikaten liegt die Datei im <code class="bg-[var(--gh-canvas-subtle)] px-1 rounded">ssl_certs_dir</code>.</p>
          {/if}
        </div>
        <p class="text-xs text-[var(--gh-fg-muted)] mt-3">Diese Daten kommen von der HAProxy Data Plane API (Runtime).</p>
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            class="btn btn-secondary"
            on:click={() => (viewCert = null)}
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  {/if}

<section class="config-section">
  <h2 class="config-section-title">Neuer Store</h2>
  <form
    on:submit|preventDefault={submit}
    class="flex flex-wrap gap-3 items-end"
  >
    <label class="block">
      <span class="block text-xs text-[var(--gh-fg-muted)] mb-1">Name (A-Za-z0-9-_)</span>
      <input
        type="text"
        bind:value={name}
        placeholder="z. B. default_store"
        class="gh-input"
        style="width: 12rem;"
      />
    </label>
    <button
      type="submit"
      disabled={submitting}
      class="btn btn-secondary"
    >
      {submitting ? "Wird angelegt …" : "Anlegen"}
    </button>
  </form>
  {#if submitError}
    <p class="gh-error">{submitError}</p>
  {/if}
</section>

<section>
  <h2 class="config-section-title">Stores</h2>
  {#if data.stores.length === 0}
    <p class="config-section-intro" style="margin-bottom: 0;">Keine Stores angelegt.</p>
  {:else}
    <p class="config-section-intro">
      {data.stores.length} Store{data.stores.length === 1 ? "" : "s"} – zum Auf- und Zuklappen klicken.
    </p>
    <div class="space-y-3">
      {#each data.stores as s}
        <div
          class="border border-[var(--gh-border)] rounded-lg bg-[var(--gh-canvas-subtle)] overflow-hidden"
        >
          <button
            type="button"
            class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--gh-btn-hover)] transition-colors"
            on:click={() => toggleStore(s.name)}
            aria-expanded={expandedStores.has(s.name)}
          >
            <span
              class="inline-block text-[var(--gh-fg-muted)] shrink-0 transition-transform {expandedStores.has(s.name) ? 'rotate-90' : ''}"
              aria-hidden="true"
            >▶</span>
            <span class="font-semibold text-[var(--gh-fg)]">{s.name}</span>
            {#if s.name === "default"}
              <span
                class="gh-badge shrink-0"
                title="Eingebauter Store mit selbstsigniertem Zertifikat; wird für HTTPS-Binds genutzt, wenn nichts anderes gewählt ist. Nicht löschbar."
              >
                Eingebaut
              </span>
            {/if}
            <span class="text-sm text-[var(--gh-fg-muted)] truncate min-w-0">
              <code class="text-xs bg-[var(--gh-canvas)] px-1 rounded">{s.crt_base || "—"}</code>
            </span>
            <span class="text-xs text-[var(--gh-fg-muted)] shrink-0 ml-auto mr-2">
              {s.loads.length} Zertifikat{s.loads.length === 1 ? "" : "e"}
            </span>
            {#if s.name !== "default"}
              <button
                type="button"
                class="btn btn-delete text-sm shrink-0 py-1 px-2 -m-1"
                on:click|stopPropagation={() => doDelete(s.name)}
                disabled={deletingName === s.name}
              >
                Store löschen
              </button>
            {/if}
          </button>
          {#if expandedStores.has(s.name)}
            <div class="border-t border-[var(--gh-border)] px-4 py-4 bg-[var(--gh-canvas)]">
              <CrtStoreBlock
                store={{ name: s.name, crt_base: s.crt_base, key_base: s.key_base }}
                loads={s.loads}
                acmeProviders={data.acmeProviders}
                acmeStatus={data.acmeStatus}
                runtimeCerts={data.runtimeCerts ?? []}
                certsUsedInBinds={data.certsUsedInBinds ?? []}
                onViewCert={(r) => (viewCert = r)}
                isCertInStorage={isCertNameInStorage}
                compact={true}
              />
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
  {#if deleteError}
    <p class="gh-error">{deleteError}</p>
  {/if}
</section>
