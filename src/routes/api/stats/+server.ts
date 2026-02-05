import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStats } from '$lib/server/dataplane';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const type = url.searchParams.get('type') as
			| 'frontend'
			| 'backend'
			| 'server'
			| null;
		const name = url.searchParams.get('name') ?? undefined;
		const parent = url.searchParams.get('parent') ?? undefined;
		const data = await getStats(
			type && ['frontend', 'backend', 'server'].includes(type)
				? { type, name, parent }
				: undefined
		);
		return json(data);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
