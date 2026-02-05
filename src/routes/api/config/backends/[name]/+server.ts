import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateBackend, deleteBackend } from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		if (!body || typeof body !== 'object') {
			return json({ error: 'Body must be JSON object' }, { status: 400 });
		}
		const result = await updateBackend(params.name, body as Record<string, unknown>);
		logAction({
			action: 'backend_updated',
			resource_type: 'backend',
			resource_id: params.name,
			details: 'PUT /api/config/backends/' + params.name
		});
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		await deleteBackend(params.name);
		logAction({
			action: 'backend_deleted',
			resource_type: 'backend',
			resource_id: params.name,
			details: 'DELETE /api/config/backends/' + params.name
		});
		return new Response(null, { status: 204 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
