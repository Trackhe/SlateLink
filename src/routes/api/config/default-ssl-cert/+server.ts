/**
 * Standard-Zertifikat für die crt_list (domain_mapping.txt).
 * Wenn keine Regeln mit Zertifikat existieren, wird diese Angabe genutzt, damit *:443 gültig ist.
 * Wert: "store:StoreName" oder Dateiname (z. B. "test.pem") relativ zum ssl-Verzeichnis.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConfig, setConfig, CONFIG_KEY_DEFAULT_SSL_CRT_LIST } from '$lib/server/db';

export const GET: RequestHandler = async () => {
	try {
		const value = getConfig(CONFIG_KEY_DEFAULT_SSL_CRT_LIST);
		return json({ value: value ?? null });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const PUT: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { value?: string | null };
		const value = body.value === undefined ? null : (body.value === null ? null : String(body.value).trim() || null);
		setConfig(CONFIG_KEY_DEFAULT_SSL_CRT_LIST, value);
		return json({ ok: true, value });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
