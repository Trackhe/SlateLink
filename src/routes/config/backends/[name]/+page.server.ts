import type { PageServerLoad } from './$types';
import { getBackend } from '$lib/server/dataplane';

export const load: PageServerLoad = async ({ params }) => {
	try {
		const backend = await getBackend(params.name);
		return { backend, error: null };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { backend: null, error: message };
	}
};
