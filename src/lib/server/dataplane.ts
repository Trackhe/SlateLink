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

/** POST/PUT/DELETE mit Body und version. */
const dpaMutate = async (
	method: 'POST' | 'PUT' | 'DELETE',
	path: string,
	body?: unknown
) => {
	const version = await getConfigurationVersion();
	const url = new URL(path, dpaBaseUrl);
	url.searchParams.set('version', String(version));
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

/** Bind an Frontend anlegen (POST). Body: { name, address?, port }. */
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

/** Server eines Backends (GET). */
export async function getServers(backendName: string): Promise<unknown> {
	return dpaFetch(
		`/v3/services/haproxy/configuration/backends/${encodeURIComponent(backendName)}/servers`
	);
}

/** Server an Backend anlegen (POST). Body: { name, address, port?, check?, ... }. */
export async function createServer(
	backendName: string,
	body: Record<string, unknown>
): Promise<unknown> {
	return dpaMutate(
		'POST',
		`/v3/services/haproxy/configuration/backends/${encodeURIComponent(backendName)}/servers`,
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

/** Liste der SSL-Zertifikate (Storage). */
export async function getSslCertificates(): Promise<unknown> {
	return dpaFetch('/v3/services/haproxy/storage/ssl_certificates');
}

/** Neues Zertifikat hochladen (multipart, storage_name = Dateiname). */
export async function uploadSslCertificate(
	storageName: string,
	pemContent: string
): Promise<unknown> {
	const version = await getConfigurationVersion();
	const form = new FormData();
	form.append(
		'file_upload',
		new Blob([pemContent], { type: 'application/x-pem-file' }),
		storageName
	);
	const url = new URL(
		`/v3/services/haproxy/storage/ssl_certificates?version=${version}`,
		dpaBaseUrl
	);
	const res = await fetch(url.toString(), {
		method: 'POST',
		headers: { Authorization: dpaAuthHeader },
		body: form
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`DPA POST ssl_certificates: ${res.status} – ${text || res.statusText}`);
	}
	return res.json();
}

/** Vorhandenes Zertifikat ersetzen (PEM-Inhalt). */
export async function replaceSslCertificate(
	storageName: string,
	pemContent: string
): Promise<unknown> {
	const version = await getConfigurationVersion();
	const url = new URL(
		`/v3/services/haproxy/storage/ssl_certificates/${encodeURIComponent(storageName)}?version=${version}`,
		dpaBaseUrl
	);
	const res = await fetch(url.toString(), {
		method: 'PUT',
		headers: {
			Authorization: dpaAuthHeader,
			'Content-Type': 'text/plain'
		},
		body: pemContent
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`DPA PUT ssl_certificates: ${res.status} – ${text || res.statusText}`);
	}
	return res.json();
}
