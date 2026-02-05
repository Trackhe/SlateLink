import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createFrontend } from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		if (!body || typeof body !== 'object' || !body.name) {
			return json(
				{ error: 'Body must be JSON with at least { "name": "..." }' },
				{ status: 400 }
			);
		}
		const result = await createFrontend(body as Record<string, unknown>);
		logAction({
			action: 'frontend_created',
			resource_type: 'frontend',
			resource_id: String(body.name),
			details: 'POST /api/config/frontends'
		});
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
