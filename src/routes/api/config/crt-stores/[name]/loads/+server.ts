import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCrtLoads, createCrtLoad } from '$lib/server/dataplane';
import { toArray } from '$lib/server/dpa-utils';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const raw = await getCrtLoads(params.name);
		return json(toArray(raw));
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		if (!body || typeof body !== 'object' || body.certificate === undefined) {
			return json(
				{ error: 'Body muss certificate (Dateiname) oder acme (ACME-Provider-Name) enthalten.' },
				{ status: 400 }
			);
		}
		// Für ACME: acme + optional domains; für manuell: certificate (Filename)
		await createCrtLoad(params.name, body);
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
