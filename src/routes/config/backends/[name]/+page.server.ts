import type { PageServerLoad } from './$types';
import {
	getBackend,
	getFrontends,
	frontendNamesUsingBackend
} from '$lib/server/dataplane';

export const load: PageServerLoad = async ({ params }) => {
	try {
		const [backend, frontendsRaw] = await Promise.all([
			getBackend(params.name),
			getFrontends()
		]);
		const frontendsUsingThis = frontendNamesUsingBackend(frontendsRaw, params.name);
		return {
			backend,
			frontendsUsingThis,
			canDelete: frontendsUsingThis.length === 0,
			error: null
		};
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { backend: null, frontendsUsingThis: [], canDelete: false, error: message };
	}
};
