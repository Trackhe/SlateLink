/**
 * ACME-Zertifikat jetzt anfordern/erneuern (Runtime).
 * Body: { certificate: "@default/testcert" } – ID aus Runtime-Status.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { triggerAcmeRenew } from '$lib/server/dataplane';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json().catch(() => ({}));
		const certificate = typeof body?.certificate === 'string' ? body.certificate.trim() : '';
		if (!certificate) {
			return json(
				{ error: 'Body muss { "certificate": "@store/name" } enthalten (z. B. @default/testcert).' },
				{ status: 400 }
			);
		}
		await triggerAcmeRenew(certificate);
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
