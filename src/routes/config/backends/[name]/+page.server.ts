import type { PageServerLoad } from './$types';
import {
	getBackend,
	getFrontends,
	getServers,
	frontendNamesUsingBackend
} from '$lib/server/dataplane';
import { toDpaList } from '$lib/server/dpa-utils';

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
			servers: toDpaList(serversRaw),
			frontendsUsingThis,
			canDelete: frontendsUsingThis.length === 0,
			error: null
		};
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { backend: null, servers: [], frontendsUsingThis: [], canDelete: false, error: message };
	}
};
