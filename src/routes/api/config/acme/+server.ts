import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getAcmeProviders,
	createAcmeProvider
} from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

function toList(raw: unknown): unknown[] {
	return Array.isArray(raw) ? raw : [];
}

export const GET: RequestHandler = async () => {
	try {
		const raw = await getAcmeProviders();
		return json(toList(raw));
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		if (!body || typeof body !== 'object' || !body.name || !body.directory) {
			return json(
				{ error: 'Body muss name und directory (ACME-URL) enthalten.' },
				{ status: 400 }
			);
		}
		await createAcmeProvider(body);
		logAction({
			action: 'acme_created',
			resource_type: 'acme',
			resource_id: String(body.name),
			details: `ACME-Provider ${body.name} angelegt`
		});
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
