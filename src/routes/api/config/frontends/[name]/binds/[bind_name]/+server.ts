import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBind, updateBind, deleteBind } from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';
import { removeBindDomains, removeBindCertRef } from '$lib/server/db';
import { writeDomainMappingFile } from '$lib/server/domain-mapping';

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		const current = (await getBind(params.name, params.bind_name)) as Record<string, unknown> | undefined;
		if (!current || typeof current !== 'object') {
			return json({ error: 'Bind nicht gefunden' }, { status: 404 });
		}
		const payload: Record<string, unknown> = { ...current, ...body };
		await updateBind(params.name, params.bind_name, payload);
		logAction({
			action: 'bind_updated',
			resource_type: 'frontend',
			resource_id: params.name,
			details: `PUT bind ${params.bind_name}`
		});
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		await deleteBind(params.name, params.bind_name);
		removeBindDomains(params.name, params.bind_name);
		removeBindCertRef(params.name, params.bind_name);
		await writeDomainMappingFile();
		logAction({
			action: 'bind_deleted',
			resource_type: 'frontend',
			resource_id: params.name,
			details: `DELETE bind ${params.bind_name} from frontend ${params.name}`
		});
		return new Response(null, { status: 204 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
