import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFrontends } from '$lib/server/dataplane';

export const GET: RequestHandler = async () => {
	try {
		const data = await getFrontends();
		return json(data);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
