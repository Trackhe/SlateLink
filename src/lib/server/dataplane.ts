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

export async function getInfo(): Promise<unknown> {
	return dpaFetch('/v3/info');
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
