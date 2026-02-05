import type { PageServerLoad } from './$types';
import { getFrontends, getBackends } from '$lib/server/dataplane';

export const load: PageServerLoad = async () => {
	try {
		const [frontends, backends] = await Promise.all([
			getFrontends(),
			getBackends()
		]);
		return { frontends, backends, error: null };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { frontends: [], backends: [], error: message };
	}
};
