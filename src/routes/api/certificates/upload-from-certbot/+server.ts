import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getSslCertificates,
	uploadSslCertificate,
	replaceSslCertificate
} from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

/** Certbot-Hook: JSON { pem, storage_name } oder text/plain + Header x-storage-name. */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const contentType = request.headers.get('Content-Type') ?? '';
		let pem: string;
		let storageName: string;

		if (contentType.includes('application/json')) {
			const body = await request.json();
			if (typeof body.pem !== 'string' || typeof body.storage_name !== 'string') {
				return json(
					{ error: 'JSON body must contain pem and storage_name (strings)' },
					{ status: 400 }
				);
			}
			pem = body.pem;
			storageName = body.storage_name;
		} else {
			pem = await request.text();
			storageName = request.headers.get('x-storage-name')?.trim() ?? '';
			if (!storageName) {
				return json(
					{ error: 'Header x-storage-name required for text/plain body' },
					{ status: 400 }
				);
			}
		}

		const list = (await getSslCertificates()) as { storage_name?: string }[];
		const exists = Array.isArray(list) && list.some((c) => c.storage_name === storageName);

		if (exists) {
			await replaceSslCertificate(storageName, pem);
			logAction({
				action: 'certificate_replaced',
				resource_type: 'certificate',
				resource_id: storageName,
				details: 'Certbot upload-from-certbot'
			});
			return json({ ok: true, action: 'replaced', storage_name: storageName });
		} else {
			await uploadSslCertificate(storageName, pem);
			logAction({
				action: 'certificate_uploaded',
				resource_type: 'certificate',
				resource_id: storageName,
				details: 'Certbot upload-from-certbot'
			});
			return json({ ok: true, action: 'uploaded', storage_name: storageName });
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
