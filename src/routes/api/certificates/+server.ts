import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSslCertificates } from '$lib/server/dataplane';

export const GET: RequestHandler = async () => {
	try {
		const data = await getSslCertificates();
		return json(data);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
