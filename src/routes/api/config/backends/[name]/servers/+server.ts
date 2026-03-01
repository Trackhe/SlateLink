import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createServer } from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		if (!body || typeof body !== 'object' || typeof body.address !== 'string' || !body.address.trim()) {
			return json(
				{ error: 'Body must be JSON with at least { "address": "..." }. Optional: name, port, ssl (true = Backend über HTTPS ansprechen)' },
				{ status: 400 }
			);
		}
		const name = (body.name && String(body.name).trim()) || body.address.replace(/[.:]/g, '_');
		const port = Number(body.port);
		const useSsl = body.ssl === true;
		const serverPayload: Record<string, unknown> = {
			name,
			address: body.address.trim(),
			port: Number.isInteger(port) && port > 0 ? port : useSsl ? 443 : 80
		};
		if (useSsl) {
			serverPayload.ssl = 'enabled';
			serverPayload.verify = 'none';
		}
		await createServer(params.name, serverPayload);
		logAction({
			action: 'server_added',
			resource_type: 'backend',
			resource_id: params.name,
			details: `POST server ${name} to backend ${params.name}`
		});
		const usedPort = Number.isInteger(port) && port > 0 ? port : useSsl ? 443 : 80;
		return json({ ok: true, name, address: body.address.trim(), port: usedPort });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
