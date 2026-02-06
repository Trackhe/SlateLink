import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteServer, getServer, updateServer } from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		if (!body || typeof body !== 'object') {
			return json({ error: 'Body must be JSON object' }, { status: 400 });
		}
		// DPA PUT erwartet i. d. R. vollständigen Server; aktuellen holen und Änderungen mergen
		const current = await getServer(params.name, params.server_name);
		const currentObj =
			typeof current === 'object' && current !== null
				? (current as Record<string, unknown>)
				: {};
		const merged = { ...currentObj, ...(body as Record<string, unknown>) };
		await updateServer(params.name, params.server_name, merged);
		logAction({
			action: 'server_updated',
			resource_type: 'backend',
			resource_id: params.name,
			details: `PUT server ${params.server_name} in backend ${params.name}`
		});
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		await deleteServer(params.name, params.server_name);
		logAction({
			action: 'server_deleted',
			resource_type: 'backend',
			resource_id: params.name,
			details: `DELETE server ${params.server_name} from backend ${params.name}`
		});
		return new Response(null, { status: 204 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
