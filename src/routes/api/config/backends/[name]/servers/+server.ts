import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createServer } from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		if (!body || typeof body !== 'object' || typeof body.address !== 'string' || !body.address.trim()) {
			return json(
				{ error: 'Body must be JSON with at least { "address": "..." }. Optional: name, port' },
				{ status: 400 }
			);
		}
		const name = (body.name && String(body.name).trim()) || body.address.replace(/[.:]/g, '_');
		const port = Number(body.port);
		await createServer(params.name, {
			name,
			address: body.address.trim(),
			port: Number.isInteger(port) && port > 0 ? port : 80
		});
		logAction({
			action: 'server_added',
			resource_type: 'backend',
			resource_id: params.name,
			details: `POST server ${name} to backend ${params.name}`
		});
		return json({ ok: true, name, address: body.address.trim(), port: Number.isInteger(port) && port > 0 ? port : 80 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
