/**
 * ACME-Scheduler in der Global-Config auf "auto" setzen.
 * Optional: insecure=1 setzt httpclient.ssl.verify auf "none", damit HAProxy
 * beim Verbinden zum ACME-Server (HTTPS) selbstsignierte Zertifikate akzeptiert.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGlobal, updateGlobal } from '$lib/server/dataplane';

export const POST: RequestHandler = async ({ url }) => {
	try {
		const globalRaw = await getGlobal();
		const global = globalRaw as Record<string, unknown>;
		const updated: Record<string, unknown> = {
			...global,
			ssl_options: {
				...(typeof global?.ssl_options === 'object' && global.ssl_options !== null
					? (global.ssl_options as Record<string, unknown>)
					: {}),
				acme_scheduler: 'auto'
			}
		};
		const insecure = url.searchParams.get('insecure') === '1';
		if (insecure) {
			updated.httpclient = {
				...(typeof global?.httpclient === 'object' && global.httpclient !== null
					? (global.httpclient as Record<string, unknown>)
					: {}),
				ssl: {
					...((typeof (global?.httpclient as Record<string, unknown>)?.ssl === 'object' &&
						(global?.httpclient as Record<string, unknown>)?.ssl !== null)
						? ((global.httpclient as Record<string, unknown>).ssl as Record<string, unknown>)
						: {}),
					verify: 'none'
				}
			};
		}
		await updateGlobal(updated);
		const msg = insecure
			? 'ACME-Scheduler auf "auto" und httpclient.ssl.verify auf "none" gesetzt (selbstsignierter ACME-Server).'
			: 'ACME-Scheduler auf "auto" gesetzt. HAProxy lädt die Config neu.';
		return json({ ok: true, message: msg });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
