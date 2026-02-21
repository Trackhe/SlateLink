/**
 * Server-only: Client für die HAProxy Data Plane API v3.
 * Nutzt config aus $lib/server/config (private Env).
 *
 * Stats (Frontends, Backends, Server) kommen aus der Data Plane API,
 * nicht aus der Stats-URL (8404) – HAPROXY_STATS_URL ist damit optional.
 */
import { dpaBaseUrl, dpaAuthHeader } from '$lib/server/config';

const dpaFetch = async (path: string, query?: Record<string, string>) => {
	const url = new URL(path, dpaBaseUrl);
	if (query) {
		for (const [k, v] of Object.entries(query)) {
			if (v != null && v !== '') url.searchParams.set(k, v);
		}
	}
	const res = await fetch(url.toString(), {
		headers: { Authorization: dpaAuthHeader }
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`DPA ${path}: ${res.status} – ${text || res.statusText}`);
	}
	return res.json();
};

/** POST/PUT/DELETE mit Body und version (oder transaction_id). */
const dpaMutate = async (
	method: 'POST' | 'PUT' | 'DELETE',
	path: string,
	body?: unknown,
	opts?: { transaction_id?: string }
) => {
	const url = new URL(path, dpaBaseUrl);
	if (opts?.transaction_id) {
		url.searchParams.set('transaction_id', opts.transaction_id);
	} else {
		const version = await getConfigurationVersion();
		url.searchParams.set('version', String(version));
	}
	const res = await fetch(url.toString(), {
		method,
		headers: {
			Authorization: dpaAuthHeader,
			'Content-Type': 'application/json'
		},
		body: body !== undefined ? JSON.stringify(body) : undefined
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`DPA ${method} ${path}: ${res.status} – ${text || res.statusText}`);
	}
	const contentType = res.headers.get('Content-Type');
	if (contentType?.includes('application/json')) {
		try {
			return await res.json();
		} catch {
			return undefined;
		}
	}
	return undefined;
};

/** Startet eine Transaktion (version erforderlich). Gibt die transaction_id zurück. */
export async function startTransaction(): Promise<string> {
	const version = await getConfigurationVersion();
	const url = new URL('/v3/services/haproxy/transactions', dpaBaseUrl);
	url.searchParams.set('version', String(version));
	const res = await fetch(url.toString(), {
		method: 'POST',
		headers: { Authorization: dpaAuthHeader }
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`DPA POST /transactions: ${res.status} – ${text || res.statusText}`);
	}
	const data = (await res.json()) as { id?: string };
	const id = data?.id;
	if (typeof id !== 'string' || !id) {
		throw new Error('DPA POST /transactions: response missing id');
	}
	return id;
}

/** Committet eine Transaktion (alle Änderungen werden gemeinsam angewendet). */
export async function commitTransaction(transactionId: string): Promise<void> {
	const path = `/v3/services/haproxy/transactions/${encodeURIComponent(transactionId)}`;
	const res = await fetch(new URL(path, dpaBaseUrl).toString(), {
		method: 'PUT',
		headers: { Authorization: dpaAuthHeader }
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`DPA PUT ${path}: ${res.status} – ${text || res.statusText}`);
	}
}

/** Response plus optional Configuration-Version header (für Schreibzugriffe). */
const dpaFetchWithHeaders = async (path: string) => {
	const url = new URL(path, dpaBaseUrl);
	const res = await fetch(url.toString(), {
		headers: { Authorization: dpaAuthHeader }
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`DPA ${path}: ${res.status} – ${text || res.statusText}`);
	}
	const data = await res.json();
	const version = res.headers.get('Configuration-Version');
	return { data, version: version != null ? parseInt(version, 10) : undefined };
};

export async function getInfo(): Promise<unknown> {
	return dpaFetch('/v3/info');
}

/** Aktuelle Konfigurationsversion (für PUT/POST/DELETE mit ?version=). */
export async function getConfigurationVersion(): Promise<number> {
	const { version } = await dpaFetchWithHeaders(
		'/v3/services/haproxy/configuration/version'
	);
	if (version === undefined) {
		throw new Error('DPA: Configuration-Version header missing');
	}
	return version;
}

/** Frontends aus der HAProxy-Konfiguration. */
export async function getFrontends(): Promise<unknown> {
	return dpaFetch('/v3/services/haproxy/configuration/frontends');
}

/** Ein Frontend nach Name. */
export async function getFrontend(name: string): Promise<unknown> {
	return dpaFetch(
		`/v3/services/haproxy/configuration/frontends/${encodeURIComponent(name)}`
	);
}

/** Backends aus der HAProxy-Konfiguration. */
export async function getBackends(): Promise<unknown> {
	return dpaFetch('/v3/services/haproxy/configuration/backends');
}

/** Ein Backend nach Name. */
export async function getBackend(name: string): Promise<unknown> {
	return dpaFetch(
		`/v3/services/haproxy/configuration/backends/${encodeURIComponent(name)}`
	);
}

function toNameList(raw: unknown): string[] {
	const list = Array.isArray(raw) ? raw : (raw as { data?: unknown[] })?.data ?? [];
	return list
		.filter((x): x is { name?: string } => typeof x === 'object' && x !== null && 'name' in x)
		.map((x) => (typeof x.name === 'string' ? x.name : ''))
		.filter(Boolean);
}

/** Alle Namen, die bereits als Frontend oder Backend existieren (HAProxy: Namen sind global eindeutig). */
export function usedConfigNames(frontendsRaw: unknown, backendsRaw: unknown): Set<string> {
	return new Set([...toNameList(frontendsRaw), ...toNameList(backendsRaw)]);
}

/**
 * Aus der DPA-Frontend-Liste (Array oder { data: [] }) die Namen der Frontends,
 * die auf das angegebene Backend verweisen. Für Backend-Löschprüfung.
 */
export function frontendNamesUsingBackend(
	frontendsRaw: unknown,
	backendName: string
): string[] {
	const list = Array.isArray(frontendsRaw)
		? frontendsRaw
		: (frontendsRaw as { data?: unknown[] })?.data ?? [];
	return list
		.filter(
			(f): f is { name?: string; default_backend?: string } =>
				typeof f === 'object' && f !== null && 'default_backend' in f
		)
		.filter((f) => f.default_backend === backendName)
		.map((f) => (typeof f.name === 'string' ? f.name : ''))
		.filter(Boolean);
}

/** Frontend anlegen (POST). Body: { name, default_backend?, mode?, ... }. */
export async function createFrontend(body: Record<string, unknown>): Promise<unknown> {
	return dpaMutate('POST', '/v3/services/haproxy/configuration/frontends', body);
}

/** Frontend aktualisieren (PUT). */
export async function updateFrontend(
	name: string,
	body: Record<string, unknown>
): Promise<unknown> {
	return dpaMutate(
		'PUT',
		`/v3/services/haproxy/configuration/frontends/${encodeURIComponent(name)}`,
		body
	);
}

/** Frontend löschen (DELETE). */
export async function deleteFrontend(name: string): Promise<void> {
	await dpaMutate(
		'DELETE',
		`/v3/services/haproxy/configuration/frontends/${encodeURIComponent(name)}`
	);
}

/** Backend anlegen (POST). Body: { name, mode?, ... }. */
export async function createBackend(body: Record<string, unknown>): Promise<unknown> {
	return dpaMutate('POST', '/v3/services/haproxy/configuration/backends', body);
}

/** Backend aktualisieren (PUT). */
export async function updateBackend(
	name: string,
	body: Record<string, unknown>
): Promise<unknown> {
	return dpaMutate(
		'PUT',
		`/v3/services/haproxy/configuration/backends/${encodeURIComponent(name)}`,
		body
	);
}

/** Backend löschen (DELETE). */
export async function deleteBackend(name: string): Promise<void> {
	await dpaMutate(
		'DELETE',
		`/v3/services/haproxy/configuration/backends/${encodeURIComponent(name)}`
	);
}

/** Binds eines Frontends (GET). */
export async function getBinds(frontendName: string): Promise<unknown> {
	return dpaFetch(
		`/v3/services/haproxy/configuration/frontends/${encodeURIComponent(frontendName)}/binds`
	);
}

/** Eindeutiger Schlüssel für einen Bind (Adresse:Port). */
export function bindEndpointKey(address: string | undefined, port: number): string {
	const addr = (address ?? '*').trim() || '*';
	return `${addr}:${port}`;
}

function toBindKey(address: string | undefined, port: number): string {
	return bindEndpointKey(address, port);
}

function bindKeysFromRaw(raw: unknown): string[] {
	const list = Array.isArray(raw) ? raw : (raw as { data?: unknown[] })?.data ?? [];
	return list
		.filter((x): x is { address?: string; port?: number } => typeof x === 'object' && x !== null)
		.map((x) => toBindKey(x.address, Number(x.port)))
		.filter((k) => k.endsWith(':') === false && !/:\s*NaN$/.test(k));
}

/** Alle belegten Bind-Endpunkte (address:port) über alle Frontends. Für Eindeutigkeitsprüfung. */
export async function getAllUsedBindEndpoints(): Promise<Set<string>> {
	const frontendsRaw = await getFrontends();
	const nameList = toNameList(frontendsRaw);
	const keys = new Set<string>();
	for (const name of nameList) {
		const bindsRaw = await getBinds(name);
		for (const k of bindKeysFromRaw(bindsRaw)) {
			keys.add(k);
		}
	}
	return keys;
}

/** Alle ssl_certificate-Werte aus allen Frontend-Binds. Ein Zertifikat gilt als „in Frontend verwendet“, wenn es in dieser Menge vorkommt. */
export async function getSslCertificatesUsedInBinds(): Promise<Set<string>> {
	const frontendsRaw = await getFrontends();
	const list = Array.isArray(frontendsRaw)
		? (frontendsRaw as { name?: string }[])
		: (frontendsRaw as { data?: { name?: string }[] })?.data ?? [];
	const names = list
		.filter((x): x is { name: string } => typeof x === 'object' && x !== null && typeof (x as { name?: string }).name === 'string')
		.map((x) => x.name);
	const used = new Set<string>();
	for (const feName of names) {
		const bindsRaw = await getBinds(feName);
		const binds = Array.isArray(bindsRaw) ? bindsRaw : (bindsRaw as { data?: unknown[] })?.data ?? [];
		for (const b of binds) {
			const cert = typeof (b as { ssl_certificate?: string }).ssl_certificate === 'string'
				? (b as { ssl_certificate: string }).ssl_certificate.trim()
				: '';
			if (cert) used.add(cert);
		}
	}
	return used;
}

/** Einzelnen Bind (GET). */
export async function getBind(frontendName: string, bindName: string): Promise<unknown> {
	return dpaFetch(
		`/v3/services/haproxy/configuration/frontends/${encodeURIComponent(frontendName)}/binds/${encodeURIComponent(bindName)}`
	);
}

/** Bind an Frontend anlegen (POST). Body: { name, address?, port, ssl?, ssl_certificate? }. */
export async function createBind(
	frontendName: string,
	body: Record<string, unknown>
): Promise<unknown> {
	return dpaMutate(
		'POST',
		`/v3/services/haproxy/configuration/frontends/${encodeURIComponent(frontendName)}/binds`,
		body
	);
}

/** Bind aktualisieren (PUT). Body: address?, port?, ssl?, ssl_certificate? etc. */
export async function updateBind(
	frontendName: string,
	bindName: string,
	body: Record<string, unknown>
): Promise<unknown> {
	return dpaMutate(
		'PUT',
		`/v3/services/haproxy/configuration/frontends/${encodeURIComponent(frontendName)}/binds/${encodeURIComponent(bindName)}`,
		body
	);
}

/** Bind löschen (DELETE). */
export async function deleteBind(
	frontendName: string,
	bindName: string
): Promise<void> {
	await dpaMutate(
		'DELETE',
		`/v3/services/haproxy/configuration/frontends/${encodeURIComponent(frontendName)}/binds/${encodeURIComponent(bindName)}`
	);
}

const frontendHttpRequestRulesPath = (name: string) =>
	`/v3/services/haproxy/configuration/frontends/${encodeURIComponent(name)}/http_request_rules`;

/** HTTP-Request-Regeln eines Frontends (GET). */
export async function getHttpRequestRules(frontendName: string): Promise<unknown> {
	const list = await dpaFetch(frontendHttpRequestRulesPath(frontendName));
	return Array.isArray(list) ? list : (list as { data?: unknown[] })?.data ?? [];
}

/** HTTP-Request-Regel an Frontend anlegen (POST). index = Einfügeposition (0-basiert). Body z. B. { type: "redirect", redir_type: "scheme", redir_value: "https", cond: "unless", cond_test: "ssl_fc" }. */
export async function createHttpRequestRule(
	frontendName: string,
	body: Record<string, unknown>,
	index: number
): Promise<unknown> {
	const { index: _i, ...payload } = body as Record<string, unknown> & { index?: number };
	const path = `${frontendHttpRequestRulesPath(frontendName)}/${index}`;
	return dpaMutate('POST', path, payload);
}

/** HTTP-Request-Regel löschen (DELETE). index = Position (0-basiert). */
export async function deleteHttpRequestRule(frontendName: string, index: number): Promise<void> {
	const path = `${frontendHttpRequestRulesPath(frontendName)}/${index}`;
	await dpaMutate('DELETE', path);
}

/** Redirect HTTP→HTTPS an Frontend an-/abschalten (http-request redirect scheme https unless { ssl_fc }). */
export async function syncRedirectHttpToHttps(frontendName: string, enable: boolean): Promise<void> {
	try {
		const rules = (await getHttpRequestRules(frontendName)) as { type?: string; redir_type?: string; cond_test?: string; index?: number }[];
		const redirectRuleIndex = rules.findIndex(
			(r) => r?.type === 'redirect' && r?.redir_type === 'scheme' && (r?.cond_test === 'ssl_fc' || r?.cond_test === '{ ssl_fc }')
		);
		if (enable && redirectRuleIndex === -1) {
			await createHttpRequestRule(
				frontendName,
				{
					type: 'redirect',
					redir_type: 'scheme',
					redir_value: 'https',
					redir_code: 301,
					cond: 'unless',
					cond_test: '{ ssl_fc }'
				},
				0
			);
		} else if (!enable && redirectRuleIndex !== -1) {
			const idx = rules[redirectRuleIndex]?.index ?? redirectRuleIndex;
			await deleteHttpRequestRule(frontendName, idx);
		}
	} catch {
		// DPA oder Version unterstützt http_request_rules ggf. nicht
	}
}

/** ACLs eines Frontends (GET). */
export async function getFrontendAcls(frontendName: string): Promise<unknown> {
	const list = await dpaFetch(
		`/v3/services/haproxy/configuration/frontends/${encodeURIComponent(frontendName)}/acls`
	);
	return Array.isArray(list) ? list : (list as { data?: unknown[] })?.data ?? [];
}

/** ACL-Liste eines Frontends ersetzen (PUT). Body = Array von { acl_name, criterion, value? }. Optional transaction_id für Transaktion. */
export async function replaceFrontendAcls(
	frontendName: string,
	acls: { acl_name: string; criterion: string; value?: string }[],
	opts?: { transaction_id?: string }
): Promise<unknown> {
	const path = `/v3/services/haproxy/configuration/frontends/${encodeURIComponent(frontendName)}/acls`;
	return dpaMutate('PUT', path, acls, opts);
}

/** Backend-Switching-Regeln eines Frontends (GET). */
export async function getBackendSwitchingRules(frontendName: string): Promise<unknown> {
	const list = await dpaFetch(
		`/v3/services/haproxy/configuration/frontends/${encodeURIComponent(frontendName)}/backend_switching_rules`
	);
	return Array.isArray(list) ? list : (list as { data?: unknown[] })?.data ?? [];
}

/** Backend-Switching-Regeln eines Frontends ersetzen (PUT). Body = Array von { name, cond?, cond_test? }. Optional transaction_id für Transaktion. */
export async function replaceBackendSwitchingRules(
	frontendName: string,
	rules: { name: string; cond?: string; cond_test?: string }[],
	opts?: { transaction_id?: string }
): Promise<unknown> {
	const path = `/v3/services/haproxy/configuration/frontends/${encodeURIComponent(frontendName)}/backend_switching_rules`;
	return dpaMutate('PUT', path, rules, opts);
}

/** Server eines Backends (GET). */
export async function getServers(backendName: string): Promise<unknown> {
	return dpaFetch(
		`/v3/services/haproxy/configuration/backends/${encodeURIComponent(backendName)}/servers`
	);
}

/** Einzelnen Server per Name (GET). Für PUT-Merge (z. B. check: disabled). */
export async function getServer(
	backendName: string,
	serverName: string
): Promise<unknown> {
	return dpaFetch(
		`/v3/services/haproxy/configuration/backends/${encodeURIComponent(backendName)}/servers/${encodeURIComponent(serverName)}`
	);
}

/** Server an Backend anlegen (POST). Body: { name, address, port?, check?, ... }. Ohne check = DPA setzt ggf. Check; check: "disabled" = kein Health-Check. */
export async function createServer(
	backendName: string,
	body: Record<string, unknown>
): Promise<unknown> {
	const payload = { ...body };
	if (payload.check === undefined) payload.check = 'disabled';
	return dpaMutate(
		'POST',
		`/v3/services/haproxy/configuration/backends/${encodeURIComponent(backendName)}/servers`,
		payload
	);
}

/** Server im Backend aktualisieren (PUT). Z. B. check: "disabled" um Health-Check auszuschalten. */
export async function updateServer(
	backendName: string,
	serverName: string,
	body: Record<string, unknown>
): Promise<unknown> {
	return dpaMutate(
		'PUT',
		`/v3/services/haproxy/configuration/backends/${encodeURIComponent(backendName)}/servers/${encodeURIComponent(serverName)}`,
		body
	);
}

/** Server aus Backend entfernen (DELETE). */
export async function deleteServer(
	backendName: string,
	serverName: string
): Promise<void> {
	await dpaMutate(
		'DELETE',
		`/v3/services/haproxy/configuration/backends/${encodeURIComponent(backendName)}/servers/${encodeURIComponent(serverName)}`
	);
}

/** Defaults-Sektionen (GET). Rückgabe: Array mit { name, forwardfor?, client_timeout?, ... }. */
export async function getDefaults(): Promise<unknown> {
	return dpaFetch('/v3/services/haproxy/configuration/defaults');
}

/** Global-Config (GET). Enthält ggf. ssl_options.acme_scheduler. */
export async function getGlobal(): Promise<unknown> {
	return dpaFetch('/v3/services/haproxy/configuration/global');
}

/** Global-Config ersetzen (PUT). Body = komplette Global-Sektion. */
export async function updateGlobal(body: Record<string, unknown>): Promise<unknown> {
	return dpaMutate('PUT', '/v3/services/haproxy/configuration/global', body);
}

// ---------------------------------------------------------------------------
// ACME (v3.2+)
// ---------------------------------------------------------------------------

export async function getAcmeProviders(): Promise<unknown> {
	return dpaFetch('/v3/services/haproxy/configuration/acme');
}

export async function getAcmeProvider(name: string): Promise<unknown> {
	return dpaFetch(
		`/v3/services/haproxy/configuration/acme/${encodeURIComponent(name)}`
	);
}

export async function createAcmeProvider(body: Record<string, unknown>): Promise<unknown> {
	return dpaMutate('POST', '/v3/services/haproxy/configuration/acme', body);
}

export async function updateAcmeProvider(
	name: string,
	body: Record<string, unknown>
): Promise<unknown> {
	return dpaMutate(
		'PUT',
		`/v3/services/haproxy/configuration/acme/${encodeURIComponent(name)}`,
		body
	);
}

export async function deleteAcmeProvider(name: string): Promise<void> {
	await dpaMutate(
		'DELETE',
		`/v3/services/haproxy/configuration/acme/${encodeURIComponent(name)}`
	);
}

/** Runtime: Status aller ACME-Zertifikate (state, expiry, scheduled_renewal). */
export async function getAcmeRuntimeStatus(): Promise<unknown> {
	return dpaFetch('/v3/services/haproxy/runtime/acme');
}

/**
 * Runtime: ACME-Zertifikat jetzt anfordern/erneuern.
 * certificate = ID aus Runtime-Status, z. B. "@default/testcert" (Store/CrtLoad).
 */
export async function triggerAcmeRenew(certificateId: string): Promise<unknown> {
	const path = `/v3/services/haproxy/runtime/acme?certificate=${encodeURIComponent(certificateId)}`;
	const url = new URL(path, dpaBaseUrl);
	const res = await fetch(url.toString(), {
		method: 'PUT',
		headers: { Authorization: dpaAuthHeader, 'Content-Type': 'application/json' }
	});
	if (!res.ok) {
		const text = await res.text();
		let msg = text || res.statusText;
		try {
			const o = JSON.parse(text) as { message?: string };
			if (typeof o?.message === 'string') msg = o.message;
		} catch {
			// keep msg as text
		}
		throw new Error(msg);
	}
	const ct = res.headers.get('Content-Type');
	if (ct?.includes('application/json')) {
		try {
			return await res.json();
		} catch {
			return undefined;
		}
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// CrtStore (Certificate Store)
// ---------------------------------------------------------------------------

export async function getCrtStores(): Promise<unknown> {
	return dpaFetch('/v3/services/haproxy/configuration/crt_stores');
}

export async function getCrtStore(name: string): Promise<unknown> {
	return dpaFetch(
		`/v3/services/haproxy/configuration/crt_stores/${encodeURIComponent(name)}`
	);
}

export async function createCrtStore(body: Record<string, unknown>): Promise<unknown> {
	return dpaMutate('POST', '/v3/services/haproxy/configuration/crt_stores', body);
}

export async function updateCrtStore(
	name: string,
	body: Record<string, unknown>
): Promise<unknown> {
	return dpaMutate(
		'PUT',
		`/v3/services/haproxy/configuration/crt_stores/${encodeURIComponent(name)}`,
		body
	);
}

export async function deleteCrtStore(name: string): Promise<void> {
	await dpaMutate(
		'DELETE',
		`/v3/services/haproxy/configuration/crt_stores/${encodeURIComponent(name)}`
	);
}

// ---------------------------------------------------------------------------
// CrtLoad (load entries inside a CrtStore)
// ---------------------------------------------------------------------------

export async function getCrtLoads(crtStoreName: string): Promise<unknown> {
	return dpaFetch('/v3/services/haproxy/configuration/crt_loads', {
		crt_store: crtStoreName
	});
}

/** Findet einen Store, der das Zertifikat (Dateiname, z. B. test.pem) lädt. Für domain_mapping @store/cert statt Pfad. */
export async function resolveCertToStore(
	certFilename: string
): Promise<{ store: string; cert: string } | null> {
	const raw = await getCrtStores();
	const stores = Array.isArray(raw)
		? (raw as { name?: string }[])
		: ((raw as { data?: { name?: string }[] })?.data ?? []);
	const want = certFilename.trim().replace(/^.*\//, '');
	if (!want) return null;
	for (const s of stores) {
		const name = (s?.name ?? '').trim();
		if (!name) continue;
		try {
			const loadsRaw = await getCrtLoads(name);
			const loads = Array.isArray(loadsRaw)
				? (loadsRaw as { certificate?: string }[])
				: ((loadsRaw as { data?: { certificate?: string }[] })?.data ?? []);
			const match = loads.find(
				(l) => (l?.certificate ?? '').trim().replace(/^.*\//, '') === want
			);
			if (match?.certificate) {
				const cert = (match.certificate ?? '').trim().replace(/^.*\//, '') || want;
				return { store: name, cert };
			}
		} catch {
			// Store nicht lesbar
		}
	}
	return null;
}

export async function getCrtLoad(crtStoreName: string, certificate: string): Promise<unknown> {
	return dpaFetch(
		`/v3/services/haproxy/configuration/crt_loads/${encodeURIComponent(certificate)}`,
		{ crt_store: crtStoreName }
	);
}

export async function createCrtLoad(
	crtStoreName: string,
	body: Record<string, unknown>
): Promise<unknown> {
	const path = `/v3/services/haproxy/configuration/crt_loads?crt_store=${encodeURIComponent(crtStoreName)}`;
	return dpaMutate('POST', path, body);
}

export async function updateCrtLoad(
	crtStoreName: string,
	certificate: string,
	body: Record<string, unknown>
): Promise<unknown> {
	const path = `/v3/services/haproxy/configuration/crt_loads/${encodeURIComponent(certificate)}?crt_store=${encodeURIComponent(crtStoreName)}`;
	return dpaMutate('PUT', path, body);
}

export async function deleteCrtLoad(crtStoreName: string, certificate: string): Promise<void> {
	const path = `/v3/services/haproxy/configuration/crt_loads/${encodeURIComponent(certificate)}?crt_store=${encodeURIComponent(crtStoreName)}`;
	await dpaMutate('DELETE', path);
}

// ---------------------------------------------------------------------------
// Runtime: geladene SSL-Zertifikate (mit Subject, Issuer/CA, not_after)
// ---------------------------------------------------------------------------

export async function getRuntimeSslCerts(): Promise<unknown> {
	return dpaFetch('/v3/services/haproxy/runtime/ssl_certs');
}

/** Einzelnes Zertifikat aus der Runtime (mehr Felder als in der Liste). */
export async function getRuntimeSslCert(name: string): Promise<unknown> {
	return dpaFetch(
		`/v3/services/haproxy/runtime/ssl_certs/${encodeURIComponent(name)}`
	);
}

/** Storage-Zertifikat als Rohtext abrufen (falls die DPA PEM zurückgibt). */
export async function getStorageSslCertificateAsText(name: string): Promise<string | null> {
	const url = new URL(
		`/v3/services/haproxy/storage/ssl_certificates/${encodeURIComponent(name)}`,
		dpaBaseUrl
	);
	const res = await fetch(url.toString(), {
		headers: { Authorization: dpaAuthHeader }
	});
	if (!res.ok) return null;
	const text = await res.text();
	// Wenn es wie PEM aussieht, zurückgeben; sonst (JSON) null
	if (text.trimStart().startsWith('-----BEGIN')) return text;
	return null;
}

// ---------------------------------------------------------------------------
// Storage: SSL certificates (files on disk)
// ---------------------------------------------------------------------------

export async function getStorageSslCertificates(): Promise<unknown> {
	return dpaFetch('/v3/services/haproxy/storage/ssl_certificates');
}

export async function getStorageSslCertificate(name: string): Promise<unknown> {
	return dpaFetch(
		`/v3/services/haproxy/storage/ssl_certificates/${encodeURIComponent(name)}`
	);
}

/**
 * Speichert ein Zertifikat (PEM-String) im Storage (ssl_certs_dir).
 * name z. B. @customdocker/asd.pem – wird als Dateiname an die DPA übergeben.
 */
export async function createStorageSslCertificateFromPem(name: string, pem: string): Promise<unknown> {
	const form = new FormData();
	form.append('file_upload', new Blob([pem], { type: 'text/plain' }), name);
	return createStorageSslCertificate(form);
}

/** Upload SSL certificate (multipart/form-data with file_upload). */
export async function createStorageSslCertificate(formData: FormData): Promise<unknown> {
	const version = await getConfigurationVersion();
	const url = new URL('/v3/services/haproxy/storage/ssl_certificates', dpaBaseUrl);
	url.searchParams.set('version', String(version));
	const res = await fetch(url.toString(), {
		method: 'POST',
		headers: { Authorization: dpaAuthHeader },
		body: formData
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`DPA POST storage/ssl_certificates: ${res.status} – ${text || res.statusText}`);
	}
	const contentType = res.headers.get('Content-Type');
	if (contentType?.includes('application/json')) {
		try {
			return await res.json();
		} catch {
			return undefined;
		}
	}
	return undefined;
}

/**
 * Ersetzt ein vorhandenes Zertifikat im Storage (ssl_certs_dir) durch neues PEM.
 * Für Renewal: neues Cert aus RAM auf Disk schreiben.
 */
export async function replaceStorageSslCertificate(name: string, pem: string): Promise<unknown> {
	const version = await getConfigurationVersion();
	const url = new URL(
		`/v3/services/haproxy/storage/ssl_certificates/${encodeURIComponent(name)}`,
		dpaBaseUrl
	);
	url.searchParams.set('version', String(version));
	const res = await fetch(url.toString(), {
		method: 'PUT',
		headers: {
			Authorization: dpaAuthHeader,
			'Content-Type': 'text/plain'
		},
		body: pem
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`DPA PUT storage/ssl_certificates: ${res.status} – ${text || res.statusText}`);
	}
	const contentType = res.headers.get('Content-Type');
	if (contentType?.includes('application/json')) {
		try {
			return await res.json();
		} catch {
			return undefined;
		}
	}
	return undefined;
}

export async function deleteStorageSslCertificate(name: string): Promise<void> {
	const version = await getConfigurationVersion();
	const url = new URL(
		`/v3/services/haproxy/storage/ssl_certificates/${encodeURIComponent(name)}`,
		dpaBaseUrl
	);
	url.searchParams.set('version', String(version));
	const res = await fetch(url.toString(), {
		method: 'DELETE',
		headers: { Authorization: dpaAuthHeader }
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`DPA DELETE storage/ssl_certificates: ${res.status} – ${text || res.statusText}`);
	}
}

/** Defaults-Sektion ersetzen (PUT). Für option forwardfor, timeouts (WebSocket) etc. */
export async function updateDefaults(
	defaultsName: string,
	body: Record<string, unknown>
): Promise<unknown> {
	return dpaMutate(
		'PUT',
		`/v3/services/haproxy/configuration/defaults/${encodeURIComponent(defaultsName)}`,
		body
	);
}

/** Laufzeit-Statistiken (wie Stats-Seite, aber JSON) – Filter optional. */
export async function getStats(options?: {
	type?: 'frontend' | 'backend' | 'server';
	name?: string;
	parent?: string;
}): Promise<unknown> {
	const query: Record<string, string> = {};
	if (options?.type) query.type = options.type;
	if (options?.name) query.name = options.name;
	if (options?.parent) query.parent = options.parent;
	return dpaFetch('/v3/services/haproxy/stats/native', query);
}

