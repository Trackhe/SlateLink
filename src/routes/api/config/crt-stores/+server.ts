import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCrtStores, createCrtStore } from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';
import { DEFAULT_CRT_STORE_NAME } from '$lib/server/default-crt-store';
import { toArray } from '$lib/server/dpa-utils';

export const GET: RequestHandler = async () => {
	try {
		const raw = await getCrtStores();
		return json(toArray(raw));
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

/** Standard-Verzeichnis für Zertifikate (muss zu dataplaneapi resources.ssl_certs_dir passen). */
const DEFAULT_CRT_BASE = '/usr/local/etc/haproxy/ssl';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		if (!body || typeof body !== 'object' || !body.name) {
			return json(
				{ error: 'Body muss name enthalten (nur A-Za-z0-9-_).' },
				{ status: 400 }
			);
		}
		if (String(body.name).trim() === DEFAULT_CRT_STORE_NAME) {
			return json(
				{ error: `Der Name "${DEFAULT_CRT_STORE_NAME}" ist für den eingebauten Store reserviert.` },
				{ status: 400 }
			);
		}
		// HAProxy verlangt crt-base mit Pfad; ohne Pfad kommt "crt-base requires a <path> argument"
		const payload = {
			...body,
			crt_base: body.crt_base ?? DEFAULT_CRT_BASE,
			key_base: body.key_base ?? DEFAULT_CRT_BASE
		};
		await createCrtStore(payload);
		logAction({
			action: 'crt_store_created',
			resource_type: 'crt_store',
			resource_id: String(body.name),
			details: `Zertifikat-Store ${body.name} angelegt`
		});
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
