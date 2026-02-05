import type { PageServerLoad } from './$types';
import { getInfo } from '$lib/server/dataplane';

export const load: PageServerLoad = async () => {
	try {
		const info = await getInfo();
		return { data: info as Record<string, unknown>, error: null };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { data: null, error: message };
	}
};
