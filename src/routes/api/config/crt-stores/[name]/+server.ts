import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getCrtStore,
	updateCrtStore,
	deleteCrtStore
} from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';
import { DEFAULT_CRT_STORE_NAME } from '$lib/server/default-crt-store';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const data = await getCrtStore(params.name);
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
		await updateCrtStore(params.name, { ...body, name: params.name });
		logAction({
			action: 'crt_store_updated',
			resource_type: 'crt_store',
			resource_id: params.name,
			details: `Zertifikat-Store ${params.name} aktualisiert`
		});
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	if ((params.name ?? '').trim() === DEFAULT_CRT_STORE_NAME) {
		return json(
			{ error: 'Der eingebaute Store "default" darf nicht gelöscht werden.' },
			{ status: 403 }
		);
	}
	try {
		await deleteCrtStore(params.name);
		logAction({
			action: 'crt_store_deleted',
			resource_type: 'crt_store',
			resource_id: params.name,
			details: `Zertifikat-Store ${params.name} gelöscht`
		});
		return new Response(null, { status: 204 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
