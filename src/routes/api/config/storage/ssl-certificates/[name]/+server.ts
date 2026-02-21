import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getStorageSslCertificate,
	deleteStorageSslCertificate
} from '$lib/server/dataplane';
import { deleteCertFileFromSslDir } from '$lib/server/haproxy-certs-dir';
import { logAction } from '$lib/server/audit';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const data = await getStorageSslCertificate(params.name);
		return json(data);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		await deleteStorageSslCertificate(params.name);
		try {
			await deleteCertFileFromSslDir(params.name);
		} catch {
			// SSL-Dir nicht verfügbar oder Datei schon weg – ignorieren
		}
		logAction({
			action: 'ssl_certificate_deleted',
			resource_type: 'storage',
			resource_id: params.name,
			details: `SSL-Zertifikat ${params.name} gelöscht`
		});
		return new Response(null, { status: 204 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
