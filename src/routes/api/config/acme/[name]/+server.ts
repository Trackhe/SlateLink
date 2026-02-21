import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getAcmeProvider,
	updateAcmeProvider,
	deleteAcmeProvider
} from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const data = await getAcmeProvider(params.name);
		return json(data);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		if (!body || typeof body !== 'object') {
			return json({ error: 'Body erforderlich.' }, { status: 400 });
		}
		await updateAcmeProvider(params.name, { ...body, name: params.name });
		logAction({
			action: 'acme_updated',
			resource_type: 'acme',
			resource_id: params.name,
			details: `ACME-Provider ${params.name} aktualisiert`
		});
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		await deleteAcmeProvider(params.name);
		logAction({
			action: 'acme_deleted',
			resource_type: 'acme',
			resource_id: params.name,
			details: `ACME-Provider ${params.name} gelöscht`
		});
		return new Response(null, { status: 204 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
