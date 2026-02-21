/**
 * Schreibt domain_mapping.txt neu (aus allen Frontends/Binds + DB).
 * Nützlich nach Änderung von HAPROXY_SSL_CERTS_DIR oder zum manuellen Aktualisieren.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeDomainMappingFile } from '$lib/server/domain-mapping';
import { haproxySslCertsDir } from '$lib/server/config';

export const POST: RequestHandler = async () => {
	if (!haproxySslCertsDir) {
		return json(
			{ error: 'HAPROXY_SSL_CERTS_DIR ist nicht gesetzt. Bitte in .env eintragen (z. B. haproxy/ssl).' },
			{ status: 400 }
		);
	}
	try {
		await writeDomainMappingFile();
		return json({ ok: true, path: `${haproxySslCertsDir}/domain_mapping.txt` });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
