/**
 * Konfigurationsdateien lesen (GET) und schreiben (PUT).
 * Erlaubte Keys: domain_mapping, haproxy_cfg, dataplaneapi_yml
 */
import { readFile, writeFile } from 'node:fs/promises';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	isAllowedConfigFileKey,
	getConfigFilePath,
	type ConfigFileKey,
} from '$lib/server/config-files';

export const GET: RequestHandler = async ({ params }) => {
	const key = params.key;
	if (!isAllowedConfigFileKey(key)) {
		return json({ error: 'Unbekannte oder nicht erlaubte Datei.' }, { status: 400 });
	}
	const path = getConfigFilePath(key as ConfigFileKey);
	if (!path) {
		return json(
			{ error: 'Pfad für domain_mapping.txt nicht konfiguriert (HAPROXY_SSL_CERTS_DIR / getSslCertsWriteDir).' },
			{ status: 400 }
		);
	}
	try {
		const content = await readFile(path, 'utf8');
		return json({ content, path });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: `Datei konnte nicht gelesen werden: ${message}` }, { status: 404 });
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const key = params.key;
	if (!isAllowedConfigFileKey(key)) {
		return json({ error: 'Unbekannte oder nicht erlaubte Datei.' }, { status: 400 });
	}
	const path = getConfigFilePath(key as ConfigFileKey);
	if (!path) {
		return json(
			{ error: 'Pfad für domain_mapping.txt nicht konfiguriert.' },
			{ status: 400 }
		);
	}
	let body: { content?: string };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Ungültiger JSON-Body (erwartet: { content: string }).' }, { status: 400 });
	}
	const content = typeof body?.content === 'string' ? body.content : '';
	try {
		await writeFile(path, content, 'utf8');
		return json({ ok: true, path });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: `Datei konnte nicht geschrieben werden: ${message}` }, { status: 502 });
	}
};
