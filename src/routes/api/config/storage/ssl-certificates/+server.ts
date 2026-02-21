import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getStorageSslCertificates,
	createStorageSslCertificate
} from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

function toList(raw: unknown): unknown[] {
	return Array.isArray(raw) ? raw : [];
}

export const GET: RequestHandler = async () => {
	try {
		const raw = await getStorageSslCertificates();
		return json(toList(raw));
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const contentType = request.headers.get('Content-Type') ?? '';
		if (!contentType.includes('multipart/form-data')) {
			return json(
				{ error: 'Upload als multipart/form-data mit Feld file_upload (PEM-Datei).' },
				{ status: 400 }
			);
		}
		const formData = await request.formData();
		const file = formData.get('file_upload');
		if (!file || !(file instanceof File)) {
			return json(
				{ error: 'Keine Datei im Feld file_upload.' },
				{ status: 400 }
			);
		}
		const uploadFormData = new FormData();
		uploadFormData.append('file_upload', file, file.name);
		const result = await createStorageSslCertificate(uploadFormData);
		const storageName = (result as { storage_name?: string })?.storage_name ?? file.name;
		logAction({
			action: 'ssl_certificate_uploaded',
			resource_type: 'storage',
			resource_id: storageName,
			details: `SSL-Zertifikat ${storageName} hochgeladen`
		});
		return json({ ok: true, storage_name: storageName });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
