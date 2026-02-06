import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createBind, getAllUsedBindEndpoints, bindEndpointKey } from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		const port = Number(body?.port);
		if (!body || typeof body !== 'object' || !Number.isInteger(port) || port < 1 || port > 65535) {
			return json(
				{ error: 'Body must be JSON with port (1–65535). Optional: name, address' },
				{ status: 400 }
			);
		}
		const address = (body.address ?? '*').trim() || '*';
		const name = body.name ?? `bind_${port}`;
		const used = await getAllUsedBindEndpoints();
		if (used.has(bindEndpointKey(address, port))) {
			return json(
				{ error: `Bind ${address}:${port} ist bereits vergeben.` },
				{ status: 409 }
			);
		}
		await createBind(params.name, { name, address, port });
		logAction({
			action: 'bind_added',
			resource_type: 'frontend',
			resource_id: params.name,
			details: `POST bind ${name} to frontend ${params.name}`
		});
		return json({ ok: true, name, address, port });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
