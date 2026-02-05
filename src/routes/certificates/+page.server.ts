import type { PageServerLoad } from './$types';
import { getSslCertificates } from '$lib/server/dataplane';

export const load: PageServerLoad = async () => {
	try {
		const certificates = await getSslCertificates();
		return { certificates, error: null };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { certificates: [], error: message };
	}
};
