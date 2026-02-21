import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getCrtLoad,
	updateCrtLoad,
	deleteCrtLoad
} from '$lib/server/dataplane';
import { deleteCertFileFromSslDir } from '$lib/server/haproxy-certs-dir';
import { logAction } from '$lib/server/audit';
import { DEFAULT_CRT_STORE_NAME, DEFAULT_CRT_FILENAME } from '$lib/server/default-crt-store';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const data = await getCrtLoad(params.name, params.certificate);
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
		await updateCrtLoad(params.name, params.certificate, body);
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	if (
		(params.name ?? '').trim() === DEFAULT_CRT_STORE_NAME &&
		(params.certificate ?? '').trim() === DEFAULT_CRT_FILENAME
	) {
		return json(
			{ error: 'Das eingebaute Zertifikat "default.pem" im Store "default" darf nicht gelöscht werden.' },
			{ status: 403 }
		);
	}
	try {
		await deleteCrtLoad(params.name, params.certificate);
		try {
			await deleteCertFileFromSslDir(params.certificate);
		} catch {
			// SSL-Dir nicht verfügbar oder Datei schon weg – ignorieren
		}
		logAction({
			action: 'crt_load_deleted',
			resource_type: 'crt_store',
			resource_id: params.name,
			details: `CrtLoad ${params.certificate} aus Store ${params.name} entfernt`
		});
		return new Response(null, { status: 204 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
