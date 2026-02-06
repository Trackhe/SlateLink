import type { PageServerLoad } from './$types';
import {
	getBackend,
	getFrontends,
	getServers,
	frontendNamesUsingBackend
} from '$lib/server/dataplane';

function toList(raw: unknown): unknown[] {
	return Array.isArray(raw) ? raw : (raw as { data?: unknown[] })?.data ?? [];
}

export const load: PageServerLoad = async ({ params }) => {
	try {
		const [backend, frontendsRaw, serversRaw] = await Promise.all([
			getBackend(params.name),
			getFrontends(),
			getServers(params.name)
		]);
		const frontendsUsingThis = frontendNamesUsingBackend(frontendsRaw, params.name);
		return {
			backend,
			servers: toList(serversRaw),
			frontendsUsingThis,
			canDelete: frontendsUsingThis.length === 0,
			error: null
		};
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { backend: null, servers: [], frontendsUsingThis: [], canDelete: false, error: message };
	}
};
