import type { PageServerLoad } from './$types';
import { getFrontend } from '$lib/server/dataplane';

export const load: PageServerLoad = async ({ params }) => {
	try {
		const frontend = await getFrontend(params.name);
		return { frontend, error: null };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { frontend: null, error: message };
	}
};
