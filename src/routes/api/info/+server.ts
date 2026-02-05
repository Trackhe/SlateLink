import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getInfo } from '$lib/server/dataplane';

export const GET: RequestHandler = async () => {
	try {
		const info = await getInfo();
		return json(info);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message, url: '/v3/info' }, { status: 502 });
	}
};
