<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { isValidBindAddress } from "$lib/shared/bind-validation";
  import RuleModal from "$lib/components/config/RuleModal.svelte";

  type Named = { name: string };
  type RuleRow = {
    id: number;
    frontend_name: string;
    domains: string[];
    backend_name: string;
    cert_ref: { type: string; store?: string; cert: string } | null;
    redirect_http_to_https: boolean;
    sort_order: number;
  };
  export let data: {
    frontends: Named[];
    backends: Named[];
    crtStores: { name: string }[];
    sslCertificates: { storage_name?: string }[];
    runtimeOnlyCerts: { name: string }[];
    rules: RuleRow[];
    defaultSslCertCrtList: string;
    error: string | null;
  };

  let showBackendModal = false;
  let showFrontendModal = false;

  // --- Backend modal state ---
  let backendBusy = false;
  let backendError = "";
  let backendName = "";
  let backendMode: "http" | "tcp" | "udp" = "http";
  let balanceAlgorithm = "roundrobin";
  type CheckType = "off" | "tcp" | "http";
  let checkType: CheckType = "off";
  let checkInter = "2s";
  let checkFall = 3;
  let checkRise = 2;
  let httpchkMethod = "GET";
  let httpchkUri = "/health";
  /** Komma-getrennte Status-Codes die als OK gelten (z. B. "200,404"). Leer = Standard 2xx/3xx. */
  let httpchkExpectStatus = "";
  /** Beim Anlegen: Liste der Server (gleiche Darstellung wie beim Bearbeiten). */
  let backendServers: { name: string; address: string; port: number }[] = [];
  /** Zeile „Server hinzufügen“ beim Anlegen (wie detailAddServer* beim Bearbeiten). */
  let createAddServerName = "";
  let createAddServerAddress = "";
  let createAddServerPort = 80;

  const BALANCE_OPTIONS = [
    { value: "roundrobin", label: "Round Robin (abwechselnd)" },
    { value: "leastconn", label: "Least Connections (wenigste Verbindungen)" },
    { value: "first", label: "First (erster verfügbar)" },
    { value: "source", label: "Source (nach Client-IP)" },
    { value: "uri", label: "URI" },
    { value: "random", label: "Random" },
  ];

  function addBackendServerFromRow() {
    if (!createAddServerAddress.trim()) return;
    const name =
      createAddServerName.trim() ||
      createAddServerAddress.replace(/[.:]/g, "_");
    const address = createAddServerAddress.trim();
    const port = Number(createAddServerPort);
    backendServers = [
      ...backendServers,
      {
        name,
        address,
        port: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : 80,
      },
    ];
    createAddServerName = "";
    createAddServerAddress = "";
    createAddServerPort = 80;
  }
  function removeBackendServer(srvName: string) {
    backendServers = backendServers.filter(
      (s) => (s.name || s.address) !== srvName,
    );
  }

  function openBackendModal() {
    showFrontendModal = false;
    detailBackendName = null;
    detailBackendData = null;
    showBackendModal = true;
    backendError = "";
    backendName = "";
    backendMode = "http";
    balanceAlgorithm = "roundrobin";
    checkType = "off";
    backendServers = [];
    createAddServerName = "";
    createAddServerAddress = "";
    createAddServerPort = 80;
  }
  function closeBackendModal() {
    showBackendModal = false;
    detailBackendName = null;
    detailBackendData = null;
  }

  async function submitBackend() {
    backendError = "";
    if (!backendName.trim()) {
      backendError = "Backend-Name ist Pflicht.";
      return;
    }
    const valid = backendServers.filter((s) => s.address.trim());
    if (valid.length === 0) {
      backendError = "Mindestens ein Server (Adresse) ist nötig.";
      return;
    }
    backendBusy = true;
    try {
      const res = await fetch("/api/config/backends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: backendName.trim(),
          mode: backendMode,
          balance: { algorithm: balanceAlgorithm },
          checkType,
          ...(checkType === "http" && {
            httpchkMethod,
            httpchkUri,
            ...(httpchkExpectStatus.trim() && {
              httpchkExpectStatus: httpchkExpectStatus.trim(),
            }),
          }),
          servers: valid.map((s) => ({
            name: s.name.trim() || s.address.replace(/[.:]/g, "_"),
            address: s.address.trim(),
            port: Number(s.port) || 80,
            check: checkType === "off" ? "disabled" : "enabled",
            ...(checkType !== "off" && {
              inter: checkInter,
              fall: checkFall,
              rise: checkRise,
            }),
          })),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        backendError = result.error || res.statusText;
        return;
      }
      await invalidateAll();
      closeBackendModal();
      backendName = "";
      backendServers = [];
      checkType = "off";
    } catch (e) {
      backendError = e instanceof Error ? e.message : String(e);
    } finally {
      backendBusy = false;
    }
  }

  // --- Frontend modal state ---
  let frontendBusy = false;
  let frontendError = "";
  let frontendName = "";
  /** Beim Anlegen: Liste der Binds (gleiche Darstellung wie beim Bearbeiten). */
  let frontendBinds: { name: string; address: string; port: number }[] = [];
  /** Zeile „Bind hinzufügen“ beim Anlegen (wie detailAddBind* beim Bearbeiten). */
  let createAddBindName = "";
  let createAddBindAddress = "*";
  let createAddBindPort = 80;
  let createAddBindError = "";
  let selectedBackend = "";
  let forwardClientIp = true;
  let websocketSupport = false;
  let forwardProto = true;

  $: hasBackends = Array.isArray(data.backends) && data.backends.length > 0;

  function createPortSelectChange(value: string) {
    if (value === "80") createAddBindPort = 80;
    else if (value === "443") createAddBindPort = 443;
    else if (createAddBindPort === 80 || createAddBindPort === 443) createAddBindPort = 8080;
  }
  function addFrontendBindFromRow() {
    createAddBindError = "";
    const port = Number(createAddBindPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      createAddBindError = "Port muss zwischen 1 und 65535 liegen.";
      return;
    }
    const address = createAddBindAddress.trim() || "*";
    if (!isValidBindAddress(address)) {
      createAddBindError =
        "Adresse muss eine IP oder * sein (z. B. * oder 0.0.0.0). Keine Hostnamen.";
      return;
    }
    const name = createAddBindName.trim() || `bind_${port}`;
    frontendBinds = [...frontendBinds, { name, address, port }];
    createAddBindName = "";
    createAddBindAddress = "*";
    createAddBindPort = 80;
  }
  function removeFrontendBind(bindName: string) {
    frontendBinds = frontendBinds.filter(
      (b) => (b.name || `bind_${b.port}`) !== bindName,
    );
  }

  function openFrontendModal() {
    showBackendModal = false;
    detailFrontendName = null;
    detailFrontendData = null;
    showFrontendModal = true;
    frontendError = "";
    frontendName = "";
    selectedBackend = "";
    frontendBinds = [];
    createAddBindName = "";
    createAddBindAddress = "*";
    createAddBindPort = 80;
    createAddBindError = "";
    forwardClientIp = true;
    forwardProto = true;
    websocketSupport = false;
  }
  function closeFrontendModal() {
    showFrontendModal = false;
    detailFrontendName = null;
    detailFrontendData = null;
  }

  async function submitFrontend() {
    frontendError = "";
    if (!frontendName.trim()) {
      frontendError = "Frontend-Name ist Pflicht.";
      return;
    }
    if (!selectedBackend?.trim()) {
      frontendError = "Bitte ein Backend auswählen.";
      return;
    }
    const validBinds = frontendBinds.filter(
      (b) =>
        Number.isInteger(Number(b.port)) &&
        Number(b.port) >= 1 &&
        Number(b.port) <= 65535 &&
        (b.address?.trim() || "*").length > 0 &&
        isValidBindAddress(b.address ?? ""),
    );
    if (validBinds.length === 0) {
      frontendError =
        frontendBinds.length > 0
          ? "Bind-Adressen müssen eine IP oder * sein (keine Hostnamen), Port 1–65535."
          : "Mindestens ein Bind mit Port 1–65535 ist nötig.";
      return;
    }
    frontendBusy = true;
    try {
      const res = await fetch("/api/config/frontends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: frontendName.trim(),
          default_backend: selectedBackend.trim(),
          binds: validBinds.map((b) => ({
            name: b.name?.trim() || `bind_${b.port}`,
            address: b.address?.trim() || "*",
            port: Number(b.port),
          })),
          options: {
            forwardClientIp,
            websocketSupport,
            forwardProto,
            redirectHttpToHttps: false,
          },
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        frontendError = result.error || res.statusText;
        return;
      }
      await invalidateAll();
      closeFrontendModal();
      frontendName = "";
      selectedBackend = "";
      frontendBinds = [];
    } catch (e) {
      frontendError = e instanceof Error ? e.message : String(e);
    } finally {
      frontendBusy = false;
    }
  }

  // --- Detail-Modals (bestehende Frontends/Backends) ---
  let detailBackendName: string | null = null;
  let detailBackendData: {
    backend: Record<string, unknown> | null;
    servers: {
      name?: string;
      address?: string;
      port?: number;
      check?: string;
    }[];
    frontendsUsingThis: string[];
    canDelete: boolean;
    error: string | null;
  } | null = null;
  let detailBackendLoading = false;
  let detailBackendSaveError = "";
  let detailBackendSaving = false;
  let detailAddServerName = "";
  let detailAddServerAddress = "";
  let detailAddServerPort = 80;
  let detailAddServerError = "";
  let detailAdding = false;
  let detailBackendDeleteError = "";
  let detailBackendDeleting = false;
  let detailDisablingCheck: string | null = null;
  let detailDisableCheckError = "";

  let detailFrontendName: string | null = null;
  let detailFrontendData: {
    frontend: Record<string, unknown> | null;
    binds: { name?: string; address?: string; port?: number; ssl_certificate?: string; domains?: string[] }[];
    backends: { name: string }[];
    options?: {
      forwardClientIp?: boolean;
      forwardProto?: boolean;
      websocketSupport?: boolean;
      redirectHttpToHttps?: boolean;
    };
    error: string | null;
  } | null = null;
  let detailFrontendLoading = false;
  let detailDefaultBackend = "";
  let detailFrontendSaveError = "";
  let detailFrontendSaving = false;
  /** Binds nur Adresse + Port; Domain/Zertifikat über Regeln. */
  type BindRow = { id: number; address: string; port: number };
  let bindRowNextId = 0;
  function newBindRow(): BindRow {
    return { id: ++bindRowNextId, address: "*", port: 80 };
  }
  let detailAddBindRows: BindRow[] = [newBindRow()];
  let detailAddBindError = "";
  let detailAddingBind = false;
  /** Zertifikate einheitlich: Storage zuerst, dann nur noch RAM-Only (gleicher Name nicht doppelt). Anzeige nur Name, keine RAM/Storage-Unterscheidung. */
  $: mergedCertOptions = (() => {
    const storageNames = new Set((data.sslCertificates ?? []).map((c) => (c.storage_name ?? "").trim()).filter(Boolean));
    const out: { value: string; label: string }[] = [];
    for (const c of data.sslCertificates ?? []) {
      const sn = (c.storage_name ?? "").trim();
      if (sn) out.push({ value: `cert:${sn}`, label: sn });
    }
    for (const r of data.runtimeOnlyCerts ?? []) {
      const name = (r.name ?? "").trim();
      if (name && !storageNames.has(name)) out.push({ value: `runtime:${name}`, label: name });
    }
    return out;
  })();

  function detailAddBindRowAdd() {
    detailAddBindRows = [...detailAddBindRows, newBindRow()];
  }
  function detailAddBindRowRemove(idx: number) {
    const next = detailAddBindRows.filter((_, i) => i !== idx);
    detailAddBindRows = next.length > 0 ? next : [newBindRow()];
  }
  function detailPortSelectChange(rowIndex: number, value: string) {
    const num = value === "80" ? 80 : value === "443" ? 443 : null;
    if (num !== null) {
      detailAddBindRows = detailAddBindRows.map((r, i) =>
        i === rowIndex ? { ...r, port: num } : r
      );
    } else {
      const row = detailAddBindRows[rowIndex];
      const cur = row?.port ?? 8080;
      const port = cur >= 1 && cur <= 65535 ? cur : 8080;
      detailAddBindRows = detailAddBindRows.map((r, i) =>
        i === rowIndex ? { ...r, port } : r
      );
    }
  }
  let detailFrontendDeleteError = "";
  let detailFrontendDeleting = false;
  let detailForwardClientIp = false;
  let detailForwardProto = false;
  let detailWebsocketSupport = false;

  // --- Regeln-Modal ---
  let showRuleModal = false;
  let ruleModalId: number | null = null;
  let ruleFormFrontend = "";
  let ruleFormDomains: string[] = [];
  let ruleFormDomainInput = "";
  let ruleFormBackend = "";
  let ruleFormSslCertificate = "";
  let ruleFormRedirectHttpToHttps = false;
  let ruleFormError = "";
  let ruleFormSaving = false;

  function ruleCertRefToOption(ref: RuleRow["cert_ref"]): string {
    if (!ref) return "";
    if (ref.type === "store") return ref.store ? `store:${ref.store}` : "";
    if (ref.type === "path" && ref.cert) return ref.cert.startsWith("cert:") ? ref.cert : `cert:${ref.cert}`;
    return "";
  }

  function openRuleModal(rule: RuleRow | null) {
    showRuleModal = true;
    ruleModalId = rule?.id ?? null;
    ruleFormFrontend = rule?.frontend_name ?? "";
    ruleFormDomains = rule?.domains ? [...rule.domains] : [];
    ruleFormDomainInput = "";
    ruleFormBackend = rule?.backend_name ?? "";
    ruleFormSslCertificate = rule ? ruleCertRefToOption(rule.cert_ref) : "";
    ruleFormRedirectHttpToHttps = rule?.redirect_http_to_https ?? false;
    ruleFormError = "";
  }

  function closeRuleModal() {
    showRuleModal = false;
    ruleModalId = null;
  }

  function ruleDomainKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLInputElement;
    const v = (target?.value ?? "").trim();
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (v) {
        const normalized = v.toLowerCase().replace(/^\.+|\\.+$/g, "");
        if (normalized && !ruleFormDomains.includes(normalized)) {
          ruleFormDomains = [...ruleFormDomains, normalized];
          ruleFormDomainInput = "";
        }
      }
      return;
    }
    if (e.key === "Backspace" && !v && ruleFormDomains.length) {
      ruleFormDomains = ruleFormDomains.slice(0, -1);
    }
  }

  function ruleRemoveDomain(domain: string) {
    ruleFormDomains = ruleFormDomains.filter((d) => d !== domain);
  }

  async function saveRule() {
    if (!ruleFormFrontend.trim() || !ruleFormBackend.trim()) {
      ruleFormError = "Frontend und Backend sind Pflicht.";
      return;
    }
    ruleFormSaving = true;
    ruleFormError = "";
    try {
      const body = {
        frontend_name: ruleFormFrontend.trim(),
        backend_name: ruleFormBackend.trim(),
        domains: ruleFormDomains,
        ssl_certificate: ruleFormSslCertificate.trim() || undefined,
        redirect_http_to_https: ruleFormRedirectHttpToHttps,
      };
      if (ruleModalId != null) {
        const res = await fetch(`/api/config/rules/${ruleModalId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          ruleFormError = (j.error as string) || res.statusText;
          return;
        }
      } else {
        const res = await fetch("/api/config/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          ruleFormError = (j.error as string) || res.statusText;
          return;
        }
      }
      await invalidateAll();
      closeRuleModal();
    } catch (e) {
      ruleFormError = e instanceof Error ? e.message : String(e);
    } finally {
      ruleFormSaving = false;
    }
  }

  async function deleteRule(rule: RuleRow) {
    if (!confirm(`Regel „${rule.frontend_name}“ / ${(rule.domains || []).join(", ") || "—"} wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/config/rules/${rule.id}`, { method: "DELETE" });
      if (res.ok) {
        await invalidateAll();
      }
    } catch {
      // ignore
    }
  }

  let defaultSslCertCrtList = data.defaultSslCertCrtList ?? "";
  $: if (typeof data.defaultSslCertCrtList === "string") defaultSslCertCrtList = data.defaultSslCertCrtList;
  let defaultSslCertSaving = false;
  let defaultSslCertError = "";
  async function saveDefaultSslCert() {
    defaultSslCertSaving = true;
    defaultSslCertError = "";
    try {
      const res = await fetch("/api/config/default-ssl-cert", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: defaultSslCertCrtList.trim() || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        defaultSslCertError = (j.error as string) || res.statusText;
        return;
      }
      await invalidateAll();
    } catch (e) {
      defaultSslCertError = e instanceof Error ? e.message : String(e);
    } finally {
      defaultSslCertSaving = false;
    }
  }

  async function openBackendDetail(name: string) {
    showBackendModal = true;
    detailBackendName = name;
    detailBackendData = null;
    detailBackendLoading = true;
    try {
      const res = await fetch(
        `/api/config/backends/${encodeURIComponent(name)}`,
      );
      const json = await res.json();
      detailBackendData = json;
      backendName = (json.backend?.name as string) ?? name;
      const mode = (json.backend?.mode as string) ?? "http";
      backendMode = mode === "tcp" ? "tcp" : mode === "udp" ? "udp" : "http";
      const bal = (json.backend as { balance?: { algorithm?: string } })
        ?.balance?.algorithm;
      balanceAlgorithm = typeof bal === "string" ? bal : "roundrobin";
    } finally {
      detailBackendLoading = false;
    }
  }
  function closeBackendDetail() {
    detailBackendName = null;
    detailBackendData = null;
    showBackendModal = false;
  }

  async function openFrontendDetail(name: string) {
    showFrontendModal = true;
    detailFrontendName = name;
    detailFrontendData = null;
    detailFrontendLoading = true;
    try {
      const res = await fetch(
        `/api/config/frontends/${encodeURIComponent(name)}`,
      );
      const json = await res.json();
      detailFrontendData = json;
      detailDefaultBackend = (json.frontend?.default_backend as string) ?? "";
      const opts = json.options as
        | {
            forwardClientIp?: boolean;
            forwardProto?: boolean;
            websocketSupport?: boolean;
            redirectHttpToHttps?: boolean;
          }
        | undefined;
      detailForwardClientIp = opts?.forwardClientIp ?? false;
      detailForwardProto = opts?.forwardProto ?? false;
      detailWebsocketSupport = opts?.websocketSupport ?? false;
    } finally {
      detailFrontendLoading = false;
    }
  }
  function closeFrontendDetail() {
    detailFrontendName = null;
    detailFrontendData = null;
    showFrontendModal = false;
  }

  async function detailSaveBackend() {
    const backendName = detailBackendData?.backend?.name;
    if (!backendName) return;
    detailBackendSaving = true;
    detailBackendSaveError = "";
    try {
      const res = await fetch(
        `/api/config/backends/${encodeURIComponent(String(backendName))}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(detailBackendData?.backend ?? {}),
            mode: backendMode,
            balance: { algorithm: balanceAlgorithm },
          }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        detailBackendSaveError = j.error || res.statusText;
        return;
      }
      await invalidateAll();
      const refetch = await fetch(
        `/api/config/backends/${encodeURIComponent(String(backendName))}`,
      );
      detailBackendData = await refetch.json();
      const mode = (detailBackendData?.backend?.mode as string) ?? "http";
      backendMode = mode === "tcp" ? "tcp" : mode === "udp" ? "udp" : "http";
      const bal = (
        detailBackendData?.backend as { balance?: { algorithm?: string } }
      )?.balance?.algorithm;
      balanceAlgorithm = typeof bal === "string" ? bal : "roundrobin";
    } catch (e) {
      detailBackendSaveError = e instanceof Error ? e.message : String(e);
    } finally {
      detailBackendSaving = false;
    }
  }
  async function detailAddServer() {
    if (!detailBackendData?.backend?.name || !detailAddServerAddress.trim()) {
      detailAddServerError = "Adresse ist Pflicht.";
      return;
    }
    detailAdding = true;
    detailAddServerError = "";
    try {
      const res = await fetch(
        `/api/config/backends/${encodeURIComponent(String(detailBackendData.backend.name))}/servers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:
              detailAddServerName.trim() ||
              detailAddServerAddress.replace(/[.:]/g, "_"),
            address: detailAddServerAddress.trim(),
            port: detailAddServerPort,
          }),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        detailAddServerError = j.error || res.statusText;
        return;
      }
      detailAddServerName = "";
      detailAddServerAddress = "";
      detailAddServerPort = 80;
      await invalidateAll();
      const refetch = await fetch(
        `/api/config/backends/${encodeURIComponent(String(detailBackendData.backend.name))}`,
      );
      detailBackendData = await refetch.json();
    } catch (e) {
      detailAddServerError = e instanceof Error ? e.message : String(e);
    } finally {
      detailAdding = false;
    }
  }
  async function detailRemoveServer(serverName: string) {
    if (
      !detailBackendData?.backend?.name ||
      !confirm(`Server „${serverName}“ entfernen?`)
    )
      return;
    try {
      const res = await fetch(
        `/api/config/backends/${encodeURIComponent(String(detailBackendData.backend.name))}/servers/${encodeURIComponent(serverName)}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        await invalidateAll();
        const refetch = await fetch(
          `/api/config/backends/${encodeURIComponent(String(detailBackendData.backend.name))}`,
        );
        detailBackendData = await refetch.json();
      }
    } catch {
      // ignore
    }
  }
  async function detailDisableCheck(srv: {
    name?: string;
    address?: string;
    port?: number;
    check?: string;
  }) {
    const name = String(srv.name ?? "");
    if (!detailBackendData?.backend?.name || !name) return;
    detailDisablingCheck = name;
    detailDisableCheckError = "";
    try {
      const res = await fetch(
        `/api/config/backends/${encodeURIComponent(String(detailBackendData.backend.name))}/servers/${encodeURIComponent(name)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ check: "disabled" }),
        },
      );
      if (res.ok) {
        await invalidateAll();
        const refetch = await fetch(
          `/api/config/backends/${encodeURIComponent(String(detailBackendData.backend.name))}`,
        );
        detailBackendData = await refetch.json();
      } else {
        const j = await res.json().catch(() => ({}));
        detailDisableCheckError = j.error || res.statusText;
      }
    } catch (e) {
      detailDisableCheckError = e instanceof Error ? e.message : String(e);
    } finally {
      detailDisablingCheck = null;
    }
  }
  async function detailDeleteBackend() {
    if (!detailBackendData?.canDelete || !detailBackendData?.backend?.name)
      return;
    if (
      !confirm(`Backend „${detailBackendData.backend.name}“ wirklich löschen?`)
    )
      return;
    detailBackendDeleting = true;
    detailBackendDeleteError = "";
    try {
      const res = await fetch(
        `/api/config/backends/${encodeURIComponent(String(detailBackendData.backend.name))}`,
        { method: "DELETE" },
      );
      if (res.status === 409) {
        const j = await res.json();
        detailBackendDeleteError = j.error || "Löschen nicht möglich.";
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        detailBackendDeleteError = j.error || res.statusText;
        return;
      }
      closeBackendDetail();
      await invalidateAll();
    } catch (e) {
      detailBackendDeleteError = e instanceof Error ? e.message : String(e);
    } finally {
      detailBackendDeleting = false;
    }
  }

  async function detailSaveFrontend() {
    const frontendName = detailFrontendData?.frontend?.name;
    if (!frontendName) return;
    if (!detailDefaultBackend.trim()) {
      detailFrontendSaveError = "Bitte ein Backend wählen.";
      return;
    }
    detailFrontendSaving = true;
    detailFrontendSaveError = "";
    try {
      const res = await fetch(
        `/api/config/frontends/${encodeURIComponent(String(frontendName))}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(detailFrontendData?.frontend ?? {}),
            default_backend: detailDefaultBackend.trim(),
            options: {
              forwardClientIp: detailForwardClientIp,
              forwardProto: detailForwardProto,
              websocketSupport: detailWebsocketSupport,
              redirectHttpToHttps: false,
            },
          }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        detailFrontendSaveError = j.error || res.statusText;
        return;
      }
      await invalidateAll();
      closeFrontendDetail();
    } catch (e) {
      detailFrontendSaveError = e instanceof Error ? e.message : String(e);
    } finally {
      detailFrontendSaving = false;
    }
  }
  async function detailAddBind() {
    if (!detailFrontendData?.frontend?.name || detailAddBindRows.length === 0) return;
    const frontendName = String(detailFrontendData.frontend.name);
    detailAddingBind = true;
    detailAddBindError = "";
    try {
      while (detailAddBindRows.length > 0) {
        const row = detailAddBindRows[0];
        const port = Number(row.port);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          detailAddBindError = "Port muss zwischen 1 und 65535 liegen.";
          break;
        }
        const addr = (row.address ?? "").trim() || "*";
        if (!isValidBindAddress(addr)) {
          detailAddBindError = "Adresse muss eine IP oder * sein (z. B. * oder 0.0.0.0).";
          break;
        }
        const bindPayload = { name: `bind_${port}`, address: addr, port };
        if (port === 443) (bindPayload as Record<string, unknown>).ssl = true;
        const res = await fetch(
          `/api/config/frontends/${encodeURIComponent(frontendName)}/binds`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bindPayload),
          },
        );
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          detailAddBindError = (j.error as string) || res.statusText;
          break;
        }
        detailAddBindRows = detailAddBindRows.slice(1);
        const refetch = await fetch(
          `/api/config/frontends/${encodeURIComponent(frontendName)}`,
        );
        detailFrontendData = await refetch.json();
      }
      await invalidateAll();
    } catch (e) {
      detailAddBindError = e instanceof Error ? e.message : String(e);
    } finally {
      detailAddingBind = false;
    }
  }
  async function detailRemoveBind(bindName: string) {
    if (
      !detailFrontendData?.frontend?.name ||
      !confirm(`Bind „${bindName}“ entfernen?`)
    )
      return;
    try {
      const res = await fetch(
        `/api/config/frontends/${encodeURIComponent(String(detailFrontendData.frontend.name))}/binds/${encodeURIComponent(bindName)}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        await invalidateAll();
        const refetch = await fetch(
          `/api/config/frontends/${encodeURIComponent(String(detailFrontendData.frontend.name))}`,
        );
        detailFrontendData = await refetch.json();
      }
    } catch {
      // ignore
    }
  }
  async function detailDeleteFrontend() {
    if (!detailFrontendData?.frontend?.name) return;
    if (
      !confirm(
        `Frontend „${detailFrontendData.frontend.name}“ wirklich löschen?`,
      )
    )
      return;
    detailFrontendDeleting = true;
    detailFrontendDeleteError = "";
    try {
      const res = await fetch(
        `/api/config/frontends/${encodeURIComponent(String(detailFrontendData.frontend.name))}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        detailFrontendDeleteError = j.error || res.statusText;
        return;
      }
      closeFrontendDetail();
      await invalidateAll();
    } catch (e) {
      detailFrontendDeleteError = e instanceof Error ? e.message : String(e);
    } finally {
      detailFrontendDeleting = false;
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (
      (e.target as HTMLElement).getAttribute("data-modal-overlay") === "true"
    ) {
      closeBackendModal();
      closeFrontendModal();
      closeRuleModal();
      closeBackendDetail();
      closeFrontendDetail();
    }
  }
  function handleOverlayKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      closeBackendModal();
      closeFrontendModal();
      closeRuleModal();
      closeBackendDetail();
      closeFrontendDetail();
    }
  }
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      closeBackendModal();
      closeFrontendModal();
      closeBackendDetail();
      closeFrontendDetail();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="page-header">
  <h1 class="page-title">Config</h1>
  <p class="page-intro">
    Frontends & Backends aus der HAProxy-Konfiguration (Data Plane API). Backends
    zuerst anlegen, dann Frontends mit Backend-Auswahl.
  </p>
</div>
<div class="page-actions">
  <button type="button" class="btn btn-primary" on:click={openBackendModal}>
    + Backend anlegen
  </button>
  <button type="button" class="btn btn-secondary" on:click={openFrontendModal}>
    + Frontend anlegen
  </button>
  <button type="button" class="btn btn-secondary" on:click={() => openRuleModal(null)}>
    + Regel anlegen
  </button>
</div>
{#if data.error}
  <p class="gh-error">Fehler: {data.error}</p>
{:else}
  <section class="config-section">
    <div class="gh-info-block">
      <h2 class="config-section-title">Standard-Zertifikat für HTTPS-Binds</h2>
      <p class="config-section-intro">
        Wenn keine Regeln mit Zertifikat existieren, wird der eingebaute Store „default“ (selbstsigniertes Zertifikat) genutzt. Hier kannst du ein anderes Zertifikat oder einen anderen Store als Standard wählen (wird in der DB gespeichert).
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <select
          bind:value={defaultSslCertCrtList}
          class="gh-select"
          style="min-width: 200px;"
        >
          <option value="">Store: default (eingebaut)</option>
          {#each data.crtStores ?? [] as s}
            <option value="store:{s.name}">Store: {s.name}</option>
          {/each}
          {#each mergedCertOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
        <button
          type="button"
          class="btn btn-secondary"
          disabled={defaultSslCertSaving}
          on:click={saveDefaultSslCert}
        >
          {defaultSslCertSaving ? "Speichern …" : "Speichern"}
        </button>
      </div>
      {#if defaultSslCertError}
        <p class="gh-error">{defaultSslCertError}</p>
      {/if}
    </div>
  </section>
  <section class="config-section">
    <h2 class="config-section-title">Frontends</h2>
    {#if Array.isArray(data.frontends) && data.frontends.length > 0}
      <div class="gh-tile-grid">
        {#each data.frontends as f}
          <button
            type="button"
            class="gh-tile"
            on:click={() => openFrontendDetail(f.name)}
          >
            <span class="gh-badge">frontend</span>
            <span class="gh-tile-title">{f.name}</span>
            <p class="gh-tile-meta">Details & Bearbeiten →</p>
          </button>
        {/each}
      </div>
    {:else}
      <p class="config-section-intro" style="margin-bottom: 0;">Keine Frontends.</p>
    {/if}
  </section>
  <section class="config-section">
    <h2 class="config-section-title">Backends</h2>
    {#if Array.isArray(data.backends) && data.backends.length > 0}
      <div class="gh-tile-grid">
        {#each data.backends as b}
          <button
            type="button"
            class="gh-tile"
            on:click={() => openBackendDetail(b.name)}
          >
            <span class="gh-badge">backend</span>
            <span class="gh-tile-title">{b.name}</span>
            <p class="gh-tile-meta">Details & Bearbeiten →</p>
          </button>
        {/each}
      </div>
    {:else}
      <p class="config-section-intro" style="margin-bottom: 0;">Keine Backends.</p>
    {/if}
  </section>
  <section class="config-section">
    <h2 class="config-section-title">Regeln</h2>
    <p class="config-section-intro">
      Pro Regel: Frontend, Domains, Backend, Zertifikat (optional) und optional HTTP→HTTPS-Redirect für diese Domain.
    </p>
    {#if Array.isArray(data.rules) && data.rules.length > 0}
      <div class="gh-tile-grid">
        {#each data.rules as rule (rule.id)}
          <div class="gh-tile-static">
            <span class="gh-badge">Regel</span>
            <p class="gh-truncate" style="font-weight: 600; color: var(--gh-fg);" title={rule.frontend_name}>
              {rule.frontend_name}
            </p>
            <p class="text-[var(--gh-fg-muted)] text-xs">
              {#if rule.domains && rule.domains.length > 0}
                {rule.domains.slice(0, 3).join(", ")}{rule.domains.length > 3 ? "…" : ""}
              {:else}
                — keine Domains —
              {/if}
            </p>
            <p class="text-[var(--gh-fg-muted)] text-xs">→ {rule.backend_name}</p>
            {#if rule.cert_ref}
              <span class="text-xs text-[var(--gh-fg-muted)]">
                {rule.cert_ref.type === "store" ? `Store: ${rule.cert_ref.store}` : (rule.cert_ref.cert || "").split("/").pop()}
              </span>
            {/if}
            {#if rule.redirect_http_to_https}
              <span class="gh-badge gh-badge--hint">HTTP→HTTPS</span>
            {/if}
            <div class="gh-tile-actions">
              <button
                type="button"
                class="btn btn-secondary"
                style="padding: 4px 8px; font-size: 12px;"
                on:click={() => openRuleModal(rule)}
              >
                Bearbeiten
              </button>
              <button
                type="button"
                class="btn btn-delete"
                style="padding: 4px 8px; font-size: 12px;"
                on:click={() => deleteRule(rule)}
              >
                Löschen
              </button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="config-section-intro" style="margin-bottom: 0;">Keine Regeln. „+ Regel anlegen“ um Domain→Backend-Zuordnung zu definieren.</p>
    {/if}
  </section>
{/if}

<!-- Modal: Backend anlegen -->
{#if showBackendModal}
  <!-- svelte-ignore a11y-no-static-element-interactions a11y-no-noninteractive-element-interactions a11y-click-events-have-key-events -->
  <div
    data-modal-overlay="true"
    role="dialog"
    aria-modal="true"
    aria-labelledby="backend-modal-title"
    class="modal-overlay open"
    on:click={handleOverlayClick}
    on:keydown={handleOverlayKeydown}
    tabindex="-1"
  >
    <!-- svelte-ignore a11y-no-static-element-interactions a11y-no-noninteractive-element-interactions a11y-click-events-have-key-events -->
    <div
      class="modal"
      style="max-width: 42rem;"
      on:click|stopPropagation
      role="document"
    >
      <div class="p-6">
        <div class="flex items-center justify-between gap-4 mb-4">
          <h2
            id="backend-modal-title"
            class="text-xl font-semibold text-[var(--gh-fg)]"
          >
            {#if detailBackendName}Backend: {detailBackendName}{:else}Backend
              anlegen{/if}
          </h2>
          <button
            type="button"
            class="text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg)] p-1"
            on:click={detailBackendName
              ? closeBackendDetail
              : closeBackendModal}
            aria-label="Schließen">✕</button
          >
        </div>

        {#if detailBackendName && detailBackendLoading}
          <p class="text-[var(--gh-fg-muted)] text-sm">Wird geladen …</p>
        {:else if detailBackendName && detailBackendData?.error}
          <p class="gh-error">{detailBackendData.error}</p>
        {:else if detailBackendName && detailBackendData?.backend}
          {@const d = detailBackendData}
          <form on:submit|preventDefault={detailSaveBackend} class="space-y-5">
            {#if detailBackendSaveError}
              <div class="gh-alert">{detailBackendSaveError}</div>
            {/if}
            <section class="gh-form-section">
              <h3>Backend</h3>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="block">
                  <span class="text-sm text-[var(--gh-fg-muted)]"
                    >Name (nur Anzeige)</span
                  >
                  <input
                    type="text"
                    bind:value={backendName}
                    disabled
                    class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas-subtle)] px-3 py-2 text-sm text-[var(--gh-fg)]"
                  />
                </label>
                <label class="block">
                  <span class="text-sm text-[var(--gh-fg-muted)]">Mode</span>
                  <select
                    bind:value={backendMode}
                    class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-3 py-2 text-sm"
                  >
                    <option value="http">HTTP</option>
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                  </select>
                </label>
              </div>
              <label class="block mt-3">
                <span class="text-sm text-[var(--gh-fg-muted)]"
                  >Load-Balancing</span
                >
                <select
                  bind:value={balanceAlgorithm}
                  class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-3 py-2 text-sm"
                >
                  {#each BALANCE_OPTIONS as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
              </label>
            </section>
            <section
              class="gh-form-section"
            >
              <h3 class="font-medium text-[var(--gh-fg)] mb-3">
                Health-Check (Zieladressen überwachen)
              </h3>
              <div class="space-y-2 mb-3">
                <span class="text-sm text-[var(--gh-fg-muted)] block"
                  >Check-Typ</span
                >
                <div class="flex flex-wrap gap-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      bind:group={checkType}
                      value="off"
                      class="rounded"
                    />
                    <span class="text-sm text-[var(--gh-fg)]">Aus</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      bind:group={checkType}
                      value="tcp"
                      class="rounded"
                    />
                    <span class="text-sm text-[var(--gh-fg)]"
                      >TCP (Verbindung zum Port)</span
                    >
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      bind:group={checkType}
                      value="http"
                      class="rounded"
                    />
                    <span class="text-sm text-[var(--gh-fg)]"
                      >HTTP (Request + Status 2xx/3xx)</span
                    >
                  </label>
                </div>
              </div>
              {#if checkType === "http"}
                <div class="grid gap-3 sm:grid-cols-2 text-sm mb-3">
                  <label class="block">
                    <span class="text-[var(--gh-fg-muted)]">HTTP-Methode</span>
                    <select
                      bind:value={httpchkMethod}
                      class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-2 py-1.5"
                    >
                      <option value="GET">GET</option>
                      <option value="HEAD">HEAD</option>
                      <option value="OPTIONS">OPTIONS</option>
                    </select>
                  </label>
                  <label class="block">
                    <span class="text-[var(--gh-fg-muted)]"
                      >URI (z. B. /health)</span
                    >
                    <input
                      type="text"
                      bind:value={httpchkUri}
                      class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-[var(--gh-fg)]"
                      placeholder="/health"
                    />
                  </label>
                  <label class="block sm:col-span-2">
                    <span class="text-[var(--gh-fg-muted)]"
                      >Status-Codes als OK (optional)</span
                    >
                    <input
                      type="text"
                      bind:value={httpchkExpectStatus}
                      class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-[var(--gh-fg)]"
                      placeholder="z. B. 200,404 – leer = 2xx/3xx"
                    />
                  </label>
                </div>
              {/if}
              {#if checkType !== "off"}
                <div class="grid gap-3 sm:grid-cols-3 text-sm">
                  <label class="block">
                    <span class="text-[var(--gh-fg-muted)]">Intervall</span>
                    <input
                      type="text"
                      bind:value={checkInter}
                      class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-[var(--gh-fg)]"
                      placeholder="2s"
                    />
                  </label>
                  <label class="block">
                    <span class="text-[var(--gh-fg-muted)]"
                      >Fall (Fehler bis DOWN)</span
                    >
                    <input
                      type="number"
                      bind:value={checkFall}
                      min="1"
                      max="20"
                      class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-[var(--gh-fg)]"
                    />
                  </label>
                  <label class="block">
                    <span class="text-[var(--gh-fg-muted)]"
                      >Rise (Erfolge bis UP)</span
                    >
                    <input
                      type="number"
                      bind:value={checkRise}
                      min="1"
                      max="20"
                      class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-[var(--gh-fg)]"
                    />
                  </label>
                </div>
              {/if}
            </section>
            <section
              class="gh-form-section"
            >
              <h3 class="font-medium text-[var(--gh-fg)] mb-3">Server</h3>
              {#if detailDisableCheckError}<p class="gh-error mb-2">
                  {detailDisableCheckError}
                </p>{/if}
              {#if d.servers.length > 0}
                <ul
                  class="border border-[var(--gh-border)] rounded divide-y divide-[var(--gh-border)] mb-3"
                >
                  {#each d.servers as srv}
                    {@const srvName = srv.name ?? srv.address ?? ""}
                    <li
                      class="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span class="text-[var(--gh-fg)]">{srvName}</span>
                      <span class="text-[var(--gh-fg-muted)]"
                        >{srv.address ?? ""}:{srv.port ?? 80}</span
                      >
                      <span class="flex gap-1">
                        {#if srv.check !== "disabled"}
                          <button
                            type="button"
                            class="text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg)] text-xs"
                            on:click={() => detailDisableCheck(srv)}
                            disabled={detailDisablingCheck === String(srvName)}
                            title="Check deaktivieren"
                          >
                            {detailDisablingCheck === String(srvName)
                              ? "…"
                              : "Check deaktivieren"}
                          </button>
                        {/if}
                        <button
                          type="button"
                          class="text-[var(--gh-fg-muted)] hover:text-[var(--gh-danger)] text-xs"
                          on:click={() => detailRemoveServer(String(srvName))}
                          title="Server entfernen">Entfernen</button
                        >
                      </span>
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="text-[var(--gh-fg-muted)] text-sm mb-2">
                  Keine Server.
                </p>
              {/if}
              <div class="flex flex-wrap gap-2 items-end">
                <input
                  type="text"
                  bind:value={detailAddServerName}
                  placeholder="Name (optional)"
                  class="w-32 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-sm text-[var(--gh-fg)]"
                />
                <input
                  type="text"
                  bind:value={detailAddServerAddress}
                  placeholder="Adresse"
                  class="w-48 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-sm text-[var(--gh-fg)]"
                />
                <input
                  type="number"
                  bind:value={detailAddServerPort}
                  min="1"
                  max="65535"
                  class="w-20 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-sm text-[var(--gh-fg)]"
                />
                <button
                  type="button"
                  class="rounded-lg border border-[var(--gh-border)] px-3 py-2 text-sm hover:bg-[var(--gh-btn-hover)] disabled:opacity-50 text-[var(--gh-fg)]"
                  disabled={detailAdding}
                  on:click={detailAddServer}
                >
                  {detailAdding ? "Hinzufügen …" : "Server hinzufügen"}
                </button>
              </div>
              {#if detailAddServerError}<p class="gh-error mt-2">
                  {detailAddServerError}
                </p>{/if}
            </section>
            <div
              class="flex justify-between items-center pt-4 border-t border-[var(--gh-border)]"
            >
              <div>
                {#if d.frontendsUsingThis.length > 0}
                  <p class="gh-alert-warning">
                    Dieses Backend kann nicht gelöscht werden: <strong
                      >{d.frontendsUsingThis.join(", ")}</strong
                    > verweisen darauf.
                  </p>
                {:else}
                  {#if detailBackendDeleteError}<p class="gh-error">
                      {detailBackendDeleteError}
                    </p>{/if}
                  <button
                    type="button"
                    class="btn btn-delete"
                    disabled={detailBackendDeleting}
                    on:click={detailDeleteBackend}
                  >
                    {detailBackendDeleting
                      ? "Wird gelöscht …"
                      : "Backend löschen"}
                  </button>
                {/if}
              </div>
              <button
                type="submit"
                class="btn btn-primary"
                disabled={detailBackendSaving}
              >
                {detailBackendSaving ? "Speichern …" : "Speichern"}
              </button>
            </div>
          </form>
        {:else}
          <!-- Create mode -->
          {#if backendError}
            <div class="gh-alert">{backendError}</div>
          {/if}
          <form on:submit|preventDefault={submitBackend} class="space-y-5">
            <section
              class="gh-form-section"
            >
              <h3 class="font-medium text-[var(--gh-fg)] mb-3">Backend</h3>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="block">
                  <span class="text-sm text-[var(--gh-fg-muted)]">Name</span>
                  <input
                    type="text"
                    bind:value={backendName}
                    class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-3 py-2 text-sm"
                    placeholder="z. B. myapp_back"
                  />
                </label>
                <label class="block">
                  <span class="text-sm text-[var(--gh-fg-muted)]">Mode</span>
                  <select
                    bind:value={backendMode}
                    class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-3 py-2 text-sm"
                  >
                    <option value="http">HTTP</option>
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                  </select>
                </label>
              </div>
              <label class="block mt-3">
                <span class="text-sm text-[var(--gh-fg-muted)]"
                  >Load-Balancing</span
                >
                <select
                  bind:value={balanceAlgorithm}
                  class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-3 py-2 text-sm"
                >
                  {#each BALANCE_OPTIONS as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
              </label>
            </section>
            <section
              class="gh-form-section"
            >
              <h3 class="font-medium text-[var(--gh-fg)] mb-3">
                Health-Check (Zieladressen überwachen)
              </h3>
              <div class="space-y-2 mb-3">
                <span class="text-sm text-[var(--gh-fg-muted)] block"
                  >Check-Typ</span
                >
                <div class="flex flex-wrap gap-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      bind:group={checkType}
                      value="off"
                      class="rounded"
                    />
                    <span class="text-sm text-[var(--gh-fg)]">Aus</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      bind:group={checkType}
                      value="tcp"
                      class="rounded"
                    />
                    <span class="text-sm text-[var(--gh-fg)]"
                      >TCP (Verbindung zum Port)</span
                    >
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      bind:group={checkType}
                      value="http"
                      class="rounded"
                    />
                    <span class="text-sm text-[var(--gh-fg)]"
                      >HTTP (Request + Status 2xx/3xx)</span
                    >
                  </label>
                </div>
              </div>
              {#if checkType === "http"}
                <div class="grid gap-3 sm:grid-cols-2 text-sm mb-3">
                  <label class="block">
                    <span class="text-[var(--gh-fg-muted)]">HTTP-Methode</span>
                    <select
                      bind:value={httpchkMethod}
                      class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-2 py-1.5"
                    >
                      <option value="GET">GET</option>
                      <option value="HEAD">HEAD</option>
                      <option value="OPTIONS">OPTIONS</option>
                    </select>
                  </label>
                  <label class="block">
                    <span class="text-[var(--gh-fg-muted)]"
                      >URI (z. B. /health)</span
                    >
                    <input
                      type="text"
                      bind:value={httpchkUri}
                      class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-[var(--gh-fg)]"
                      placeholder="/health"
                    />
                  </label>
                  <label class="block sm:col-span-2">
                    <span class="text-[var(--gh-fg-muted)]"
                      >Status-Codes als OK (optional)</span
                    >
                    <input
                      type="text"
                      bind:value={httpchkExpectStatus}
                      class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-[var(--gh-fg)]"
                      placeholder="z. B. 200,404 – leer = 2xx/3xx"
                    />
                  </label>
                </div>
              {/if}
              {#if checkType !== "off"}
                <div class="grid gap-3 sm:grid-cols-3 text-sm">
                  <label class="block">
                    <span class="text-[var(--gh-fg-muted)]">Intervall</span>
                    <input
                      type="text"
                      bind:value={checkInter}
                      class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-[var(--gh-fg)]"
                      placeholder="2s"
                    />
                  </label>
                  <label class="block">
                    <span class="text-[var(--gh-fg-muted)]"
                      >Fall (Fehler bis DOWN)</span
                    >
                    <input
                      type="number"
                      bind:value={checkFall}
                      min="1"
                      max="20"
                      class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-[var(--gh-fg)]"
                    />
                  </label>
                  <label class="block">
                    <span class="text-[var(--gh-fg-muted)]"
                      >Rise (Erfolge bis UP)</span
                    >
                    <input
                      type="number"
                      bind:value={checkRise}
                      min="1"
                      max="20"
                      class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-[var(--gh-fg)]"
                    />
                  </label>
                </div>
              {/if}
            </section>
            <section
              class="gh-form-section"
            >
              <h3 class="font-medium text-[var(--gh-fg)] mb-3">Server</h3>
              {#if backendServers.length > 0}
                <ul
                  class="border border-[var(--gh-border)] rounded divide-y divide-[var(--gh-border)] mb-3"
                >
                  {#each backendServers as srv}
                    {@const srvName = srv.name || srv.address}
                    <li
                      class="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span class="text-[var(--gh-fg)]">{srvName}</span>
                      <span class="text-[var(--gh-fg-muted)]"
                        >{srv.address}:{srv.port ?? 80}</span
                      >
                      <button
                        type="button"
                        class="text-[var(--gh-fg-muted)] hover:text-[var(--gh-danger)] text-xs"
                        on:click={() => removeBackendServer(srvName)}
                        title="Server entfernen">Entfernen</button
                      >
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="text-[var(--gh-fg-muted)] text-sm mb-2">
                  Keine Server. Mindestens einen über die Zeile unten
                  hinzufügen.
                </p>
              {/if}
              <div class="flex flex-wrap gap-2 items-end">
                <input
                  type="text"
                  bind:value={createAddServerName}
                  placeholder="Name (optional)"
                  class="w-32 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-sm text-[var(--gh-fg)]"
                />
                <input
                  type="text"
                  bind:value={createAddServerAddress}
                  placeholder="Adresse"
                  class="w-48 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-sm text-[var(--gh-fg)]"
                />
                <input
                  type="number"
                  bind:value={createAddServerPort}
                  min="1"
                  max="65535"
                  class="w-20 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-sm text-[var(--gh-fg)]"
                />
                <button
                  type="button"
                  class="rounded-lg border border-[var(--gh-border)] px-3 py-2 text-sm hover:bg-[var(--gh-btn-hover)] text-[var(--gh-fg)]"
                  on:click={addBackendServerFromRow}
                >
                  Server hinzufügen
                </button>
              </div>
            </section>
            <div class="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={backendBusy || backendServers.length === 0}
                class="btn btn-primary"
              >
                {backendBusy ? "Wird angelegt …" : "Backend anlegen"}
              </button>
              <button
                type="button"
                on:click={closeBackendModal}
                class="rounded-lg border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-4 py-2 text-sm hover:bg-[var(--gh-btn-hover)]"
                >Abbrechen</button
              >
            </div>
          </form>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Modal: Frontend (Anlegen + Bearbeiten) -->
{#if showFrontendModal}
  <!-- svelte-ignore a11y-no-static-element-interactions a11y-no-noninteractive-element-interactions a11y-click-events-have-key-events -->
  <div
    data-modal-overlay="true"
    role="dialog"
    aria-modal="true"
    aria-labelledby="frontend-modal-title"
    class="modal-overlay open"
    on:click={handleOverlayClick}
    on:keydown={handleOverlayKeydown}
    tabindex="-1"
  >
    <!-- svelte-ignore a11y-no-static-element-interactions a11y-no-noninteractive-element-interactions a11y-click-events-have-key-events -->
    <div
      class="modal"
      style="max-width: 42rem;"
      on:click|stopPropagation
      role="document"
    >
      <div class="p-6">
        <div class="flex items-center justify-between gap-4 mb-4">
          <h2
            id="frontend-modal-title"
            class="text-xl font-semibold text-[var(--gh-fg)]"
          >
            {#if detailFrontendName}Frontend: {detailFrontendName}{:else}Frontend
              anlegen{/if}
          </h2>
          <button
            type="button"
            class="text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg)] p-1"
            on:click={detailFrontendName
              ? closeFrontendDetail
              : closeFrontendModal}
            aria-label="Schließen">✕</button
          >
        </div>

        {#if detailFrontendName && detailFrontendLoading}
          <p class="text-[var(--gh-fg-muted)] text-sm">Wird geladen …</p>
        {:else if detailFrontendName && detailFrontendData?.error}
          <p class="gh-error">
            {detailFrontendData.error}
          </p>
        {:else if detailFrontendName && detailFrontendData?.frontend}
          {@const d = detailFrontendData}
          <form on:submit|preventDefault={detailSaveFrontend} class="space-y-5">
            {#if detailFrontendSaveError}<div
                class="gh-alert"
              >
                {detailFrontendSaveError}
              </div>{/if}
            <section
              class="gh-form-section"
            >
              <h3 class="font-medium text-[var(--gh-fg)] mb-3">
                Frontend (Eingang)
              </h3>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="block">
                  <span class="text-sm text-[var(--gh-fg-muted)]"
                    >Name (nur Anzeige)</span
                  >
                  <input
                    type="text"
                    value={d.frontend?.name}
                    disabled
                    class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas-subtle)] px-3 py-2 text-sm text-[var(--gh-fg)]"
                  />
                </label>
                <label class="block">
                  <span class="text-sm text-[var(--gh-fg-muted)]">Backend</span>
                  <select
                    bind:value={detailDefaultBackend}
                    class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-3 py-2 text-sm"
                  >
                    <option value="">– Backend wählen –</option>
                    {#each d.backends as b}
                      <option value={b.name}>{b.name}</option>
                    {/each}
                  </select>
                </label>
              </div>
            </section>
            <section
              class="gh-form-section"
            >
              <h3 class="font-medium text-[var(--gh-fg)] mb-3">Optionen</h3>
              <ul class="space-y-2 text-sm">
                <li class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    bind:checked={detailForwardClientIp}
                    id="fe-opt-forward"
                    class="rounded"
                  />
                  <label for="fe-opt-forward" class="text-[var(--gh-fg)]"
                    >Client-IP weitergeben (X-Forwarded-For)</label
                  >
                </li>
                <li class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    bind:checked={detailForwardProto}
                    id="fe-opt-proto"
                    class="rounded"
                  />
                  <label for="fe-opt-proto" class="text-[var(--gh-fg)]"
                    >X-Forwarded-Proto setzen (HTTPS hinter Proxy)</label
                  >
                </li>
                <li class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    bind:checked={detailWebsocketSupport}
                    id="fe-opt-ws"
                    class="rounded"
                  />
                  <label for="fe-opt-ws" class="text-[var(--gh-fg)]"
                    >WebSocket-Unterstützung (lange Timeouts)</label
                  >
                </li>
              </ul>
            </section>
            <section
              class="gh-form-section"
            >
              <h3 class="font-medium text-[var(--gh-fg)] mb-3">
                Binds (Listen-Adressen)
              </h3>
              {#if d.binds.length > 0}
                <ul
                  class="border border-[var(--gh-border)] rounded divide-y divide-[var(--gh-border)] mb-3"
                >
                  {#each d.binds as bind, bindIndex}
                    {@const bindName = bind.name ?? `bind_${bind.port ?? ""}`}
                    <li
                      class="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                    >
                      <span
                        class="inline-flex rounded bg-[var(--gh-accent-subtle)] border border-[var(--gh-border)] text-[var(--gh-fg)] px-2 py-0.5 text-xs shrink-0"
                        title="Zeile {bindIndex + 1}"
                      >
                        Zeile {bindIndex + 1}
                      </span>
                      <span class="text-[var(--gh-fg)] shrink-0"
                        >{bindName}</span
                      >
                      <span class="text-[var(--gh-fg-muted)] shrink-0"
                        >{bind.address ?? "*"}:{bind.port ?? ""}</span
                      >
                      <button
                        type="button"
                        class="ml-auto text-[var(--gh-fg-muted)] hover:text-[var(--gh-danger)] text-xs shrink-0"
                        on:click={() => detailRemoveBind(String(bindName))}
                        title="Bind entfernen">Entfernen</button
                      >
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="text-[var(--gh-fg-muted)] text-sm mb-2">
                  Keine Binds.
                </p>
              {/if}
              <p class="text-[var(--gh-fg-muted)] text-xs mb-2">
                Pro Zeile ein Bind: Adresse und Port (80, 443 oder benutzerdefiniert 1–65535). Domain- und Zertifikats-Zuordnung erfolgt über Regeln.
              </p>
              {#each detailAddBindRows as row, rowIndex}
                <div
                  class="flex flex-wrap gap-2 items-end rounded-lg border border-[var(--gh-border)] bg-[var(--gh-canvas-subtle)] p-3 mb-2"
                >
                  <span
                    class="inline-flex rounded bg-[var(--gh-accent-subtle)] border border-[var(--gh-border)] text-[var(--gh-fg)] px-2 py-0.5 text-xs shrink-0"
                    title="Zeile {rowIndex + 1}"
                  >
                    Zeile {rowIndex + 1}
                  </span>
                  <span class="text-[var(--gh-fg-muted)] text-sm">Adresse:</span>
                  <input
                    type="text"
                    bind:value={row.address}
                    placeholder="* oder IP"
                    title="Nur * oder IP"
                    class="w-28 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-sm text-[var(--gh-fg)]"
                  />
                  <span class="text-[var(--gh-fg-muted)] text-sm">Port:</span>
                  <select
                    value={row.port === 80 ? "80" : row.port === 443 ? "443" : "custom"}
                    on:change={(e) => detailPortSelectChange(rowIndex, e.currentTarget.value)}
                    class="w-28 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-sm text-[var(--gh-fg)]"
                  >
                    <option value="80">80 (HTTP)</option>
                    <option value="443">443 (HTTPS)</option>
                    <option value="custom">Benutzerdefiniert</option>
                  </select>
                  {#if row.port !== 80 && row.port !== 443}
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      step="1"
                      bind:value={row.port}
                      class="w-20 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-sm text-[var(--gh-fg)]"
                      title="Port 1–65535"
                    />
                  {/if}
                  <button
                    type="button"
                    class="rounded border border-[var(--gh-border)] px-2 py-1.5 text-sm text-[var(--gh-fg-muted)] hover:bg-[var(--gh-btn-hover)] hover:text-[var(--gh-fg)] disabled:opacity-50"
                    disabled={detailAddingBind}
                    on:click={() => detailAddBindRowRemove(rowIndex)}
                    title="Zeile entfernen"
                  >
                    Zeile entfernen
                  </button>
                </div>
              {/each}
              <div class="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  class="rounded-lg border border-[var(--gh-border)] px-3 py-2 text-sm hover:bg-[var(--gh-btn-hover)] text-[var(--gh-fg)]"
                  on:click={detailAddBindRowAdd}
                  disabled={detailAddingBind}
                >
                  + Zeile hinzufügen
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-[var(--gh-border)] px-3 py-2 text-sm hover:bg-[var(--gh-btn-hover)] disabled:opacity-50 text-[var(--gh-fg)]"
                  disabled={detailAddingBind}
                  on:click={detailAddBind}
                >
                  {detailAddingBind ? "Hinzufügen …" : "Alle Binds hinzufügen"}
                </button>
              </div>
              {#if detailAddBindError}
                <div class="gh-error">
                  {detailAddBindError}
                </div>
              {/if}
            </section>
            {#if detailFrontendDeleteError}<p class="gh-error mb-2">
                {detailFrontendDeleteError}
              </p>{/if}
            <div
              class="flex justify-between items-center pt-4 border-t border-[var(--gh-border)]"
            >
              <button
                type="button"
                class="btn btn-delete"
                disabled={detailFrontendDeleting}
                on:click={detailDeleteFrontend}
              >
                {detailFrontendDeleting
                  ? "Wird gelöscht …"
                  : "Frontend löschen"}
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                disabled={detailFrontendSaving}
              >
                {detailFrontendSaving ? "Speichern …" : "Speichern"}
              </button>
            </div>
          </form>
        {:else}
          <!-- Create mode -->
          {#if !hasBackends}
            <p class="gh-alert-warning config-section">
              Keine Backends vorhanden. Bitte zuerst ein Backend anlegen.
            </p>
          {/if}
          {#if frontendError}
            <div
              class="gh-alert"
            >
              {frontendError}
            </div>
          {/if}
          <form on:submit|preventDefault={submitFrontend} class="space-y-5">
            <section
              class="gh-form-section"
            >
              <h3 class="font-medium text-[var(--gh-fg)] mb-3">
                Frontend (Eingang)
              </h3>
              <div class="grid gap-3">
                <label class="block">
                  <span class="text-sm text-[var(--gh-fg-muted)]">Name</span>
                  <input
                    type="text"
                    bind:value={frontendName}
                    class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-3 py-2 text-sm"
                    placeholder="z. B. myapp_front"
                  />
                </label>
                <label class="block">
                  <span class="text-sm text-[var(--gh-fg-muted)]">Backend</span>
                  <select
                    bind:value={selectedBackend}
                    class="mt-1 block w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-3 py-2 text-sm"
                    disabled={!hasBackends}
                  >
                    <option value="">– Backend wählen –</option>
                    {#each data.backends as b}
                      <option value={b.name}>{b.name}</option>
                    {/each}
                  </select>
                </label>
              </div>
            </section>
            <section
              class="gh-form-section"
            >
              <h3 class="font-medium text-[var(--gh-fg)] mb-3">Optionen</h3>
              <ul class="space-y-2 text-sm">
                <li class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    bind:checked={forwardClientIp}
                    id="opt-forward"
                    class="rounded"
                  />
                  <label for="opt-forward" class="text-[var(--gh-fg)]"
                    >Client-IP weitergeben (X-Forwarded-For)</label
                  >
                </li>
                <li class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    bind:checked={forwardProto}
                    id="opt-proto"
                    class="rounded"
                  />
                  <label for="opt-proto" class="text-[var(--gh-fg)]"
                    >X-Forwarded-Proto setzen (HTTPS hinter Proxy)</label
                  >
                </li>
                <li class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    bind:checked={websocketSupport}
                    id="opt-ws"
                    class="rounded"
                  />
                  <label for="opt-ws" class="text-[var(--gh-fg)]"
                    >WebSocket-Unterstützung (lange Timeouts)</label
                  >
                </li>
              </ul>
            </section>
            <section
              class="gh-form-section"
            >
              <h3 class="font-medium text-[var(--gh-fg)] mb-3">
                Binds (Listen-Adressen)
              </h3>
              {#if frontendBinds.length > 0}
                <ul
                  class="border border-[var(--gh-border)] rounded divide-y divide-[var(--gh-border)] mb-3"
                >
                  {#each frontendBinds as bind}
                    {@const bindName = bind.name || `bind_${bind.port}`}
                    <li
                      class="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span class="text-[var(--gh-fg)]">{bindName}</span>
                      <span class="text-[var(--gh-fg-muted)]"
                        >{bind.address || "*"}:{bind.port}</span
                      >
                      <button
                        type="button"
                        class="text-[var(--gh-fg-muted)] hover:text-[var(--gh-danger)] text-xs"
                        on:click={() => removeFrontendBind(bindName)}
                        title="Bind entfernen">Entfernen</button
                      >
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="text-[var(--gh-fg-muted)] text-sm mb-2">
                  Keine Binds. Mindestens einen über die Zeile unten hinzufügen.
                </p>
              {/if}
              <div class="flex flex-wrap gap-2 items-end">
                <input
                  type="text"
                  bind:value={createAddBindName}
                  placeholder="Name (optional)"
                  class="w-32 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-sm text-[var(--gh-fg)]"
                />
                <input
                  type="text"
                  bind:value={createAddBindAddress}
                  placeholder="IP oder *"
                  title="Nur IP oder * (keine Hostnamen)"
                  class="w-32 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-sm text-[var(--gh-fg)]"
                />
                <span class="text-[var(--gh-fg-muted)] text-sm">Port:</span>
                <select
                  value={createAddBindPort === 80 ? "80" : createAddBindPort === 443 ? "443" : "custom"}
                  on:change={(e) => createPortSelectChange(e.currentTarget.value)}
                  class="w-32 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-sm text-[var(--gh-fg)]"
                >
                  <option value="80">80 (HTTP)</option>
                  <option value="443">443 (HTTPS)</option>
                  <option value="custom">Benutzerdefiniert</option>
                </select>
                {#if createAddBindPort !== 80 && createAddBindPort !== 443}
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    step="1"
                    bind:value={createAddBindPort}
                    class="w-24 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-sm text-[var(--gh-fg)]"
                    title="Port 1–65535"
                  />
                {/if}
                <button
                  type="button"
                  class="rounded-lg border border-[var(--gh-border)] px-3 py-2 text-sm hover:bg-[var(--gh-btn-hover)] text-[var(--gh-fg)]"
                  on:click={addFrontendBindFromRow}
                >
                  Bind hinzufügen
                </button>
              </div>
              {#if createAddBindError}<p class="gh-error mt-2">
                  {createAddBindError}
                </p>{/if}
            </section>
            <div class="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={frontendBusy ||
                  !hasBackends ||
                  !selectedBackend?.trim() ||
                  frontendBinds.length === 0}
                class="btn btn-primary"
              >
                {frontendBusy ? "Wird angelegt …" : "Frontend anlegen"}
              </button>
              <button
                type="button"
                on:click={closeFrontendModal}
                class="rounded-lg border border-[var(--gh-border)] bg-[var(--gh-canvas)] text-[var(--gh-fg)] px-4 py-2 text-sm hover:bg-[var(--gh-btn-hover)]"
                >Abbrechen</button
              >
            </div>
          </form>
        {/if}
      </div>
    </div>
  </div>
{/if}

<RuleModal
  bind:showRuleModal
  bind:ruleModalId
  bind:ruleFormFrontend
  bind:ruleFormDomains
  bind:ruleFormDomainInput
  bind:ruleFormBackend
  bind:ruleFormSslCertificate
  bind:ruleFormRedirectHttpToHttps
  bind:ruleFormError
  bind:ruleFormSaving
  frontends={data.frontends ?? []}
  backends={data.backends ?? []}
  crtStores={data.crtStores ?? []}
  {mergedCertOptions}
  {closeRuleModal}
  {saveRule}
  {ruleRemoveDomain}
  {ruleDomainKeydown}
  {handleOverlayClick}
  {handleOverlayKeydown}
/>
