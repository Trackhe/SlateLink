import type { PageServerLoad } from './$types';
import { getAuditLog } from '$lib/server/audit';

export const load: PageServerLoad = async ({ url }) => {
	const limit = url.searchParams.get('limit');
	const data = getAuditLog({
		limit: limit != null ? parseInt(limit, 10) : 50,
		offset: 0
	});
	return { entries: data };
};
