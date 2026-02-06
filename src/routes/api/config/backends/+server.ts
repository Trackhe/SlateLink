import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createBackend, createServer } from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

type ServerInput = { name?: string; address: string; port?: number };

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		if (!body || typeof body !== 'object' || !body.name) {
			return json(
				{ error: 'Body must be JSON with at least { "name": "..." }. Optional: servers: [ { name?, address, port? } ]' },
				{ status: 400 }
			);
		}
		const name = String(body.name).trim();
		await createBackend({
			name,
			mode: body.mode ?? 'http',
			balance: body.balance ?? { algorithm: 'roundrobin' }
		});
		const servers = Array.isArray(body.servers) ? body.servers : [];
		for (const s of servers as ServerInput[]) {
			if (!s || typeof s.address !== 'string' || !s.address.trim()) continue;
			const port = Number(s.port);
			await createServer(name, {
				name: (s.name && String(s.name).trim()) || s.address.replace(/[.:]/g, '_'),
				address: s.address.trim(),
				port: Number.isInteger(port) && port > 0 ? port : 80
			});
		}
		logAction({
			action: 'backend_created',
			resource_type: 'backend',
			resource_id: name,
			details: 'POST /api/config/backends' + (servers.length ? ` (${servers.length} Server)` : '')
		});
		return json({ ok: true, name, servers: servers.length });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
