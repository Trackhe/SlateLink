import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncRuntimeCertsToStorage } from '$lib/server/certificates-sync';

/**
 * POST /api/config/certificates/sync-from-runtime
 * Speichert alle Runtime-Zertifikate, die nur im RAM sind und noch nicht im Storage,
 * in den DPA-Storage (ssl_certs_dir). HAProxy lädt sie beim nächsten Start von der Platte.
 */
export const POST: RequestHandler = async () => {
	try {
		const result = await syncRuntimeCertsToStorage();
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ saved: [], errors: [{ name: '', error: message }] }, { status: 502 });
	}
};
