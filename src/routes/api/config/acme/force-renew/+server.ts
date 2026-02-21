/**
 * ACME-Retry: CrtLoad löschen, mit gleicher Config neu anlegen, dann Renew auslösen.
 * Hilft wenn die Challenge fehlgeschlagen ist und der Status "running" hängt oder
 * ein Platzhalter-Zertifikat im RAM einen erneuten Versuch blockiert.
 * Body: { store: string, certificate: string } oder { certificate: "@store/name" }
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getCrtLoad,
	deleteCrtLoad,
	createCrtLoad,
	triggerAcmeRenew
} from '$lib/server/dataplane';

function parseCertId(certificate: string): { store: string; cert: string } | null {
	const s = certificate.trim();
	if (s.startsWith('@') && s.includes('/')) {
		const idx = s.indexOf('/');
		const store = s.slice(1, idx).trim();
		const cert = s.slice(idx + 1).trim();
		if (store && cert) return { store, cert };
	}
	return null;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as {
			certificate?: string;
			store?: string;
		};
		let store: string;
		let cert: string;
		if (body.store != null && body.certificate != null) {
			store = String(body.store).trim();
			cert = String(body.certificate).trim();
		} else if (typeof body.certificate === 'string') {
			const parsed = parseCertId(body.certificate);
			if (!parsed) {
				return json(
					{ error: 'Body muss { "certificate": "@store/name" } oder { "store", "certificate" } enthalten.' },
					{ status: 400 }
				);
			}
			store = parsed.store;
			cert = parsed.cert;
		} else {
			return json(
				{ error: 'Body muss { "certificate": "@store/name" } oder { "store", "certificate" } enthalten.' },
				{ status: 400 }
			);
		}
		if (!store || !cert) {
			return json({ error: 'Store und certificate dürfen nicht leer sein.' }, { status: 400 });
		}

		const load = (await getCrtLoad(store, cert)) as Record<string, unknown> | null;
		if (!load || typeof load !== 'object') {
			return json({ error: `CrtLoad „${cert}“ im Store „${store}“ nicht gefunden.` }, { status: 404 });
		}

		const recreateBody: Record<string, unknown> = {
			certificate: load.certificate ?? cert
		};
		if (load.acme != null) recreateBody.acme = load.acme;
		if (load.domains != null) recreateBody.domains = load.domains;

		await deleteCrtLoad(store, cert);
		await createCrtLoad(store, recreateBody);
		const certId = `@${store}/${cert}`;
		await triggerAcmeRenew(certId);
		return json({ ok: true, message: 'CrtLoad neu angelegt, ACME-Anforderung gestartet.' });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
