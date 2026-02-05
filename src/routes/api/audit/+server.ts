import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuditLog } from '$lib/server/audit';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const from = url.searchParams.get('from') ?? undefined;
		const to = url.searchParams.get('to') ?? undefined;
		const action = url.searchParams.get('action') ?? undefined;
		const resource_type = url.searchParams.get('resource_type') ?? undefined;
		const limit = url.searchParams.get('limit');
		const offset = url.searchParams.get('offset');
		const data = getAuditLog({
			from,
			to,
			action,
			resource_type,
			limit: limit != null ? parseInt(limit, 10) : undefined,
			offset: offset != null ? parseInt(offset, 10) : undefined
		});
		return json(data);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 500 });
	}
};
