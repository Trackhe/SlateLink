<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import type { RuntimeCert } from "./+page.server";

  export let store: { name: string; crt_base: string; key_base: string };
  export let loads: Record<string, unknown>[];
  export let acmeProviders: string[];
  export let acmeStatus: { certificate?: string; state?: string; expiries_in?: string; expiry_date?: string; acme_section?: string; scheduled_renewal?: string; renewal_in?: string }[];
  /** Alle Runtime-Zertifikate (zum Zuordnen und für View). */
  export let runtimeCerts: RuntimeCert[] = [];
  /** ssl_certificate-Werte aus allen Frontend-Binds – nur dann „Verwendet“, wenn das Zertifikat hier vorkommt. */
  export let certsUsedInBinds: string[] = [];
  /** Wird aufgerufen, um das Zertifikat-Detail-Modal zu öffnen. */
  export let onViewCert: (r: RuntimeCert) => void = () => {};
  /** True, wenn das Zertifikat bereits im Storage (ssl_certs_dir) liegt – dann „Save to disk“ und „Zertifikat anfordern“ ausblenden. */
  export let isCertInStorage: (fullName: string) => boolean = () => false;
  /** Wenn true: Store-Titel und crt_base nicht anzeigen (z. B. in Karten-Header schon sichtbar). */
  export let compact = false;

  let addType: "storage" | "acme" = "storage";
  let addCertificate = "";
  let addAcme = "";
  let addDomains = "";
  let addError = "";
  let adding = false;
  let showUploadModal = false;
  let uploadFileInput: HTMLInputElement;
  let uploadError = "";
  let uploading = false;
  let deleteCert: string | null = null;
  let deleteError = "";
  let renewCert: string | null = null;
  let forceRenewCert: string | null = null;
  let renewError = "";
  let renewSuccess = "";
  let renewCooldownUntil = 0;
  let renewCooldownSec = 0;
  let saveToDiskName: string | null = null;
  let saveToDiskError = "";
  let saveToDiskSuccess = "";

  $: storeNameStr = store?.name ?? "";
  $: relevantStatus = (acmeStatus || []).filter((s) => s.certificate && String(s.certificate).startsWith("@" + storeNameStr + "/"));

  function certName(load: Record<string, unknown>): string {
    const c = load.certificate ?? load;
    return typeof c === "string" ? c : String((load as { certificate?: string }).certificate ?? "");
  }

  /** Vollständiger Runtime-Name für einen CrtLoad (z. B. @storename/asd.pem bei ACME). */
  function fullRuntimeName(load: Record<string, unknown>): string {
    const name = certName(load);
    return load.acme ? `@${storeNameStr}/${name}` : name;
  }

  function findRuntimeCert(fullName: string): RuntimeCert | undefined {
    return (runtimeCerts || []).find(
      (r) => (r.storage_name ?? r.file ?? "") === fullName || (r.file ?? r.storage_name ?? "") === fullName
    );
  }

  function getAcmeStatusEntry(fullName: string): { state?: string; expiry_date?: string } | undefined {
    return (acmeStatus || []).find((s) => s.certificate === fullName);
  }

  function getAcmeStateForCert(fullName: string): string {
    return getAcmeStatusEntry(fullName)?.state ?? "—";
  }

  function getExpiryForCert(fullName: string): string | null {
    const runtimeCert = findRuntimeCert(fullName);
    if (runtimeCert?.not_after) return runtimeCert.not_after;
    return getAcmeStatusEntry(fullName)?.expiry_date ?? null;
  }

  function caDisplay(r: RuntimeCert): string {
    return r.chain_issuer ?? r.issuers ?? "—";
  }

  /** True, wenn dieses Zertifikat in mindestens einem Frontend-Bind (ssl_certificate) konfiguriert ist. */
  function isCertUsedInFrontend(fullName: string, certFileName: string): boolean {
    const set = new Set(certsUsedInBinds ?? []);
    if (set.has(fullName)) return true;
    const withAt = fullName.startsWith("@") ? fullName : `@${storeNameStr}/${certFileName}`;
    if (set.has(withAt)) return true;
    const pathForm = (store.crt_base ?? "").replace(/\/$/, "") + "/" + certFileName;
    if (pathForm !== "/" + certFileName && set.has(pathForm)) return true;
    return false;
  }

  async function downloadCert(fullName: string) {
    try {
      const res = await fetch(`/api/config/certificates/${certApiPath(fullName)}`);
      const data = (await res.json().catch(() => ({}))) as { pem?: string; error?: string };
      if (!res.ok || !data.pem) {
        const msg = data.error ?? "PEM nicht verfügbar";
        alert(msg);
        return;
      }
      const blob = new Blob([data.pem], { type: "application/x-pem-file" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fullName.replace(/[/@]/g, "_")}.pem`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function doUploadAndAdd() {
    if (!uploadFileInput?.files?.length) {
      uploadError = "Bitte eine PEM-Datei wählen.";
      return;
    }
    const file = uploadFileInput.files[0];
    uploading = true;
    uploadError = "";
    try {
      const formData = new FormData();
      formData.append("file_upload", file, file.name);
      const res = await fetch("/api/config/storage/ssl-certificates", {
        method: "POST",
        body: formData,
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; storage_name?: string };
      if (!res.ok) {
        uploadError = j.error || res.statusText;
        return;
      }
      const storageName = j.storage_name ?? file.name;
      const addRes = await fetch(
        `/api/config/crt-stores/${encodeURIComponent(store.name)}/loads`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ certificate: storageName }) }
      );
      const addJ = await addRes.json().catch(() => ({}));
      if (!addRes.ok) {
        uploadError = (addJ as { error?: string }).error || addRes.statusText;
        return;
      }
      uploadFileInput.value = "";
      showUploadModal = false;
      await invalidateAll();
    } catch (e) {
      uploadError = e instanceof Error ? e.message : String(e);
    } finally {
      uploading = false;
    }
  }

  function closeUploadModal() {
    showUploadModal = false;
    uploadError = "";
    if (uploadFileInput) uploadFileInput.value = "";
  }

  async function addLoad() {
    addError = "";
    if (addType === "storage") {
      if (!addCertificate.trim()) {
        addError = "Zertifikats-Dateiname (aus Storage) angeben.";
        return;
      }
    } else {
      if (!addAcme.trim()) {
        addError = "ACME-Provider wählen.";
        return;
      }
      if (!addCertificate.trim()) {
        addError = "Certificate (Dateiname für das ACME-Zertifikat) angeben.";
        return;
      }
    }
    adding = true;
    try {
      const body: Record<string, unknown> =
        addType === "storage"
          ? { certificate: addCertificate.trim() }
          : {
              certificate: addCertificate.trim(),
              acme: addAcme.trim(),
              ...(addDomains.trim()
                ? { domains: addDomains.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean) }
                : {}),
            };
      const res = await fetch(
        `/api/config/crt-stores/${encodeURIComponent(store.name)}/loads`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        addError = (j as { error?: string }).error || res.statusText;
        return;
      }
      addCertificate = "";
      addAcme = "";
      addDomains = "";
      await invalidateAll();
    } catch (e) {
      addError = e instanceof Error ? e.message : String(e);
    } finally {
      adding = false;
    }
  }

  async function removeLoad(certificate: string) {
    if (!confirm(`Eintrag „${certificate}“ aus dem Store entfernen?`)) return;
    deleteCert = certificate;
    deleteError = "";
    try {
      const res = await fetch(
        `/api/config/crt-stores/${encodeURIComponent(store.name)}/loads/${encodeURIComponent(certificate)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        deleteError = (j as { error?: string }).error || res.statusText;
        return;
      }
      await invalidateAll();
    } catch (e) {
      deleteError = e instanceof Error ? e.message : String(e);
    } finally {
      deleteCert = null;
    }
  }

  function certApiPath(name: string): string {
    return name.split("/").map(encodeURIComponent).join("/");
  }

  async function saveToDisk(fullName: string) {
    saveToDiskName = fullName;
    saveToDiskError = "";
    saveToDiskSuccess = "";
    try {
      const res = await fetch(`/api/config/certificates/${certApiPath(fullName)}`, { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        saveToDiskError = j.error || res.statusText;
        return;
      }
      saveToDiskSuccess = "Gespeichert.";
      await invalidateAll();
      setTimeout(() => { saveToDiskSuccess = ""; }, 3000);
    } catch (e) {
      saveToDiskError = e instanceof Error ? e.message : String(e);
    } finally {
      saveToDiskName = null;
    }
  }

  async function requestAcmeCert(certificate: string) {
    renewCert = certificate;
    renewError = "";
    renewSuccess = "";
    try {
      const certId = `@${store.name}/${certificate}`;
      const path = certApiPath(certId);
      let initialFingerprint: string | null = null;
      try {
        const metaRes = await fetch(`/api/config/certificates/${path}`);
        const meta = (await metaRes.json().catch(() => ({}))) as { runtime?: { sha256_finger_print?: string } };
        if (meta.runtime?.sha256_finger_print) {
          initialFingerprint = meta.runtime.sha256_finger_print;
        }
      } catch {
        // Kein aktueller Fingerprint, jeder neue zählt als Wechsel
      }

      const res = await fetch("/api/config/acme/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificate: certId }),
      });
      const text = await res.text();
      let j: { error?: string; message?: string } = {};
      try {
        j = text ? JSON.parse(text) : {};
      } catch {
        if (!res.ok) j = { error: text || res.statusText };
      }
      if (!res.ok) {
        const msg = (j.error ?? j.message ?? res.statusText) || "Unbekannter Fehler";
        const s = typeof msg === "string" ? msg : String(msg);
        if (/Task already exists|already exists for/i.test(s)) {
          renewError = "Eine ACME-Anforderung für dieses Zertifikat läuft bereits oder hängt. Button ist 90 Sekunden gesperrt. Bei dauerhaftem Fehler: HAProxy einmal neu laden (z. B. in Config eine kleine Änderung speichern), dann erneut versuchen.";
          renewCooldownUntil = Date.now() + 90 * 1000;
          renewCooldownSec = 90;
          const interval = setInterval(() => {
            const left = Math.max(0, Math.ceil((renewCooldownUntil - Date.now()) / 1000));
            renewCooldownSec = left;
            if (left <= 0) {
              clearInterval(interval);
              renewCooldownUntil = 0;
            }
          }, 1000);
        } else if (/connection refused|ECONNREFUSED|dial tcp/i.test(s)) {
          renewError = "HAProxy kann den ACME-Server nicht erreichen (Verbindung abgelehnt). Directory-URL prüfen (z. B. host.docker.internal statt localhost), Port und ob der ACME-Server läuft.";
        } else {
          renewError = s;
        }
        return;
      }
      renewSuccess = "Anforderung gestartet. Warte auf neues Zertifikat (Fingerprint wird geprüft), dann Speicherung auf Disk.";
      await invalidateAll();
      setTimeout(() => { renewSuccess = ""; }, 8000);

      const pollIntervalMs = 3000;
      const timeoutMs = 90000;
      const started = Date.now();
      const pollTimer = setInterval(async () => {
        if (Date.now() - started > timeoutMs) {
          clearInterval(pollTimer);
          return;
        }
        try {
          const metaRes = await fetch(`/api/config/certificates/${path}`);
          const meta = (await metaRes.json().catch(() => ({}))) as { runtime?: { sha256_finger_print?: string } };
          const fp = meta.runtime?.sha256_finger_print ?? null;
          if (fp && fp !== initialFingerprint) {
            clearInterval(pollTimer);
            saveToDisk(certId);
          }
        } catch {
          // Beim nächsten Intervall erneut versuchen
        }
      }, pollIntervalMs);
    } catch (e) {
      renewError = e instanceof Error ? e.message : String(e);
    } finally {
      renewCert = null;
    }
  }

  /** CrtLoad löschen, neu anlegen und ACME auslösen – hilft wenn Challenge fehlgeschlagen ist und Status hängt. */
  async function forceRenewAcmeCert(certificate: string) {
    forceRenewCert = certificate;
    renewError = "";
    renewSuccess = "";
    try {
      const certId = `@${store.name}/${certificate}`;
      const res = await fetch("/api/config/acme/force-renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificate: certId }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        renewError = (j.error ?? j.message ?? res.statusText) || "Unbekannter Fehler";
        return;
      }
      renewSuccess = "CrtLoad neu angelegt, ACME-Anforderung gestartet. Bei Erfolg erscheint ein neues Zertifikat.";
      await invalidateAll();
      setTimeout(() => { renewSuccess = ""; }, 10000);
    } catch (e) {
      renewError = e instanceof Error ? e.message : String(e);
    } finally {
      forceRenewCert = null;
    }
  }
</script>

{#if !compact}
  <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
    Store: {store.name}
  </h2>
  <p class="text-sm text-slate-600 dark:text-slate-400 mb-2">
    <code class="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">crt_base</code> {store.crt_base || "—"}
    {#if store.key_base}
      · <code class="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">key_base</code> {store.key_base}
    {/if}
  </p>
{/if}

<section class="mb-6">
  <h3 class="font-medium text-slate-800 dark:text-slate-100 mb-2">Zertifikat hinzufügen (CrtLoad)</h3>
  <div class="flex flex-wrap gap-4 items-end mb-3">
    <div>
      <label class="block text-xs text-slate-500 mb-1">Quelle</label>
      <select
        bind:value={addType}
        class="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
      >
        <option value="storage">Storage (hochgeladenes Zertifikat)</option>
        <option value="acme">ACME (automatisch)</option>
      </select>
    </div>
    {#if addType === "storage"}
      <div>
        <label class="block text-xs text-slate-500 mb-1">Zertifikats-Dateiname (Storage)</label>
        <input
          type="text"
          bind:value={addCertificate}
          placeholder="z. B. meinedomain.pem"
          class="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm w-48"
        />
      </div>
      <button
        type="button"
        class="rounded-lg border border-[var(--gh-accent)] text-[var(--gh-accent)] px-3 py-2 text-sm hover:bg-[var(--gh-accent-fg)] hover:bg-opacity-10"
        on:click={() => { showUploadModal = true; uploadError = ""; }}
      >
        Selbst hochladen
      </button>
    {:else}
      <div>
        <label class="block text-xs text-slate-500 mb-1">ACME-Provider</label>
        <select
          bind:value={addAcme}
          class="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm"
        >
          <option value="">— wählen —</option>
          {#each acmeProviders as p}
            <option value={p}>{p}</option>
          {/each}
        </select>
      </div>
      <div>
        <label class="block text-xs text-slate-500 mb-1">Certificate (Dateiname)</label>
        <input
          type="text"
          bind:value={addCertificate}
          placeholder="z. B. example.com.pem"
          class="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm w-40"
        />
      </div>
      <div>
        <label class="block text-xs text-slate-500 mb-1">Domains (kommagetrennt)</label>
        <input
          type="text"
          bind:value={addDomains}
          placeholder="example.com, www.example.com"
          class="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-2 py-1.5 text-sm w-56"
        />
      </div>
    {/if}
    <button
      type="button"
      on:click={addLoad}
      disabled={adding}
      class="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
    >
      {adding ? "Hinzufügen …" : "Hinzufügen"}
    </button>
  </div>
  {#if addError}
    <p class="text-red-600 dark:text-red-400 text-sm">{addError}</p>
  {/if}
</section>

{#if showUploadModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="upload-modal-title"
  >
    <div class="bg-[var(--gh-canvas)] border border-[var(--gh-border)] rounded-xl shadow-xl p-5 min-w-[320px] max-w-md">
      <h3 id="upload-modal-title" class="font-medium text-slate-800 dark:text-slate-100 mb-3">Zertifikat hochladen und in Store „{store.name}“ legen</h3>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">PEM-Datei (Zertifikat + Key + ggf. Chain). Nach dem Upload wird das Zertifikat automatisch in diesen Store (CrtLoad) eingetragen.</p>
      <input
        bind:this={uploadFileInput}
        type="file"
        accept=".pem,.crt,.cert"
        class="block w-full text-sm mb-3"
      />
      {#if uploadError}
        <p class="text-red-600 dark:text-red-400 text-sm mb-3">{uploadError}</p>
      {/if}
      <div class="flex gap-2 justify-end">
        <button
          type="button"
          class="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          on:click={closeUploadModal}
          disabled={uploading}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="rounded-lg bg-[var(--gh-accent)] text-[var(--gh-accent-fg)] px-3 py-2 text-sm hover:opacity-90 disabled:opacity-50"
          on:click={doUploadAndAdd}
          disabled={uploading}
        >
          {uploading ? "Wird hochgeladen …" : "Hochladen und hinzufügen"}
        </button>
      </div>
    </div>
  </div>
{/if}

<section class="mb-6">
  <h3 class="font-medium text-slate-800 dark:text-slate-100 mb-2">ACME-Status (Runtime)</h3>
  {#if relevantStatus.length === 0}
    <p class="text-slate-500 dark:text-slate-400 text-sm">Kein ACME-Status für diesen Store – oder HAProxy meldet keine Einträge.</p>
  {:else}
    <ul class="border border-slate-200 dark:border-slate-600 rounded divide-y divide-slate-200 dark:divide-slate-600 text-sm mb-4">
      {#each relevantStatus as s}
        {@const shortName = s.certificate ? String(s.certificate).replace(/^@[^/]+\//, "") : ""}
        <li class="px-3 py-2 flex flex-wrap gap-x-4 gap-y-1 items-center">
          <span class="font-medium">{s.certificate ?? ""}</span>
          <span>State: <code class="bg-slate-100 dark:bg-slate-800 px-1 rounded">{s.state ?? "—"}</code></span>
          {#if s.expiries_in}<span>Läuft ab in: {s.expiries_in}</span>{/if}
          {#if s.expiry_date}<span>Ablauf: {s.expiry_date}</span>{/if}
          {#if s.renewal_in}<span>Erneuerung in: {s.renewal_in}</span>{/if}
          {#if s.scheduled_renewal}<span>Geplant: {s.scheduled_renewal}</span>{/if}
          {#if shortName}
            <button
              type="button"
              class="btn ml-auto"
              on:click={() => requestAcmeCert(shortName)}
              disabled={renewCert === shortName || renewCooldownSec > 0}
              title="ACME-Zertifikat jetzt erneuern"
            >
              {#if renewCert === shortName}
                Läuft …
              {:else if renewCooldownSec > 0}
                Warte {renewCooldownSec} s
              {:else}
                Erneuern
              {/if}
            </button>
          {/if}
        </li>
        {#if s.state === "Running" && (!s.expiries_in || String(s.expiries_in).startsWith("0d"))}
          <li class="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 text-sm col-span-full space-y-1">
            <p><strong>„Running“ ohne Fortschritt?</strong> 1) TLS: <code class="bg-slate-100 dark:bg-slate-800 px-1 rounded">global</code> <code class="bg-slate-100 dark:bg-slate-800 px-1 rounded">httpclient.ssl.verify none</code>. 2) Fehler: <code class="bg-slate-100 dark:bg-slate-800 px-1 rounded">docker logs &lt;container&gt;</code> prüfen.</p>
          </li>
        {/if}
      {/each}
    </ul>
  {/if}
</section>

<section>
  <h3 class="font-medium text-slate-800 dark:text-slate-100 mb-2">CrtLoad-Einträge in diesem Store</h3>
  <p class="text-slate-500 dark:text-slate-400 text-xs mb-2">Konfigurierte Zertifikate (CrtLoad) in diesem Store. Bei ACME erscheint der Eintrag hier; nach „Zertifikat anfordern“ wird das Zertifikat in crt_base abgelegt.</p>
  {#if loads.length === 0}
    <p class="empty-table">Keine Einträge. Fügen Sie oben einen CrtLoad hinzu.</p>
  {:else}
    <ul class="cert-tree">
      {#each loads as load}
        {@const name = certName(load)}
        {@const loadAcme = load.acme}
        {@const fullName = fullRuntimeName(load)}
        {@const runtimeCert = findRuntimeCert(fullName)}
        {@const acmeState = getAcmeStateForCert(fullName)}
        {@const expiry = getExpiryForCert(fullName)}
        {@const inStorage = isCertInStorage(fullName)}
        <li class="cert-tree__item cert-tree__item--depth-1">
          <span class="cert-tree__label" title={fullName}>{name}</span>
          <span class="cert-tree__meta">
            {#if runtimeCert}
              {[runtimeCert.subject, caDisplay(runtimeCert), runtimeCert.not_after ? "Ablauf: " + runtimeCert.not_after : null].filter((v) => v && String(v).trim() && v !== "\u2014" && v !== "—").join(" · ")}
            {:else if loadAcme}
              ACME: {loadAcme} · (noch nicht geladen)
            {/if}
          </span>
          <div class="cert-tree__actions">
            <span class="cert-tree__badge cert-tree__badge--state" title="ACME-Status"><code class="text-xs bg-[var(--gh-canvas-subtle)] px-1.5 py-0.5 rounded">{acmeState}</code></span>
            {#if expiry}
              <span class="cert-tree__badge cert-tree__badge--expiry" title="Gültig bis">{expiry}</span>
            {/if}
            {#if inStorage}
              <span class="cert-tree__badge cert-tree__badge--stored" title="Im ssl_certs_dir gespeichert">Gespeichert</span>
            {:else}
              <span class="cert-tree__badge cert-tree__badge--ram" title="Nur im RAM (DPA)">Nur RAM</span>
            {/if}
            {#if isCertUsedInFrontend(fullName, name)}
              <span class="cert-tree__badge cert-tree__badge--used" title="In Frontend(s) verwendet">Verwendet</span>
            {/if}
            <button
              type="button"
              class="btn btn-view-cert"
              on:click={() => onViewCert(runtimeCert ?? { storage_name: fullName, file: fullName })}
              title="Zertifikat-Details anzeigen"
            >
              Anzeigen
            </button>
            <button
              type="button"
              class="btn"
              on:click={() => downloadCert(fullName)}
              title="Zertifikat (PEM) herunterladen"
            >
              Download
            </button>
            {#if !inStorage}
              <button
                type="button"
                class="btn"
                on:click={() => saveToDisk(fullName)}
                disabled={saveToDiskName === fullName}
                title="Zertifikat im Storage (ssl_certs_dir) speichern"
              >
                {saveToDiskName === fullName ? "Speichere …" : "Save to disk"}
              </button>
              {#if loadAcme}
                <button
                  type="button"
                  class="btn"
                  on:click={() => requestAcmeCert(name)}
                  disabled={renewCert === name || forceRenewCert === name || renewCooldownSec > 0}
                  title="ACME-Zertifikat jetzt anfordern/erneuern"
                >
                  {#if renewCert === name}
                    Läuft …
                  {:else if forceRenewCert === name}
                    Erzwingen …
                  {:else if renewCooldownSec > 0}
                    Warte {renewCooldownSec} s
                  {:else}
                    Zertifikat anfordern
                  {/if}
                </button>
                <button
                  type="button"
                  class="btn"
                  on:click={() => forceRenewAcmeCert(name)}
                  disabled={renewCert === name || forceRenewCert === name || renewCooldownSec > 0}
                  title="CrtLoad neu anlegen und ACME erneut auslösen (wenn Anforderung hängt oder fehlgeschlagen ist)"
                >
                  {#if forceRenewCert === name}
                    Erzwingen …
                  {:else}
                    ACME erneut erzwingen
                  {/if}
                </button>
              {/if}
            {/if}
            <button
              type="button"
              class="btn btn-delete"
              on:click={() => removeLoad(name)}
              disabled={deleteCert === name}
            >
              Entfernen
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
  {#if deleteError}
    <p class="text-red-600 dark:text-red-400 text-sm mt-2">{deleteError}</p>
  {/if}
  {#if saveToDiskError}
    <p class="text-red-600 dark:text-red-400 text-sm mt-2">Save to disk: {saveToDiskError}</p>
  {/if}
  {#if saveToDiskSuccess}
    <p class="text-green-700 dark:text-green-400 text-sm mt-2">{saveToDiskSuccess}</p>
  {/if}
  {#if renewError}
    <p class="text-red-600 dark:text-red-400 text-sm mt-2">ACME: {renewError}</p>
  {/if}
  {#if renewSuccess}
    <p class="text-green-700 dark:text-green-400 text-sm mt-2">{renewSuccess}</p>
  {/if}
</section>
