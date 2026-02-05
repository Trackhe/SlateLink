import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStatsHistory } from '$lib/server/stats';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const from = url.searchParams.get('from') ?? undefined;
		const to = url.searchParams.get('to') ?? undefined;
		const limit = url.searchParams.get('limit');
		const offset = url.searchParams.get('offset');
		const data = getStatsHistory({
			from,
			to,
			limit: limit != null ? parseInt(limit, 10) : undefined,
			offset: offset != null ? parseInt(offset, 10) : undefined
		});
		return json(data);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 500 });
	}
};
