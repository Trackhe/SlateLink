import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createBackend,
	createServer,
	createFrontend,
	createBind,
	getDefaults,
	updateDefaults
} from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

type ProxyServer = { name: string; address: string; port: number };
type ProxyBody = {
	frontendName: string;
	bindPort: number;
	bindAddress?: string;
	bindName?: string;
	backendName: string;
	servers: ProxyServer[];
	options?: {
		forwardClientIp?: boolean;
		websocketSupport?: boolean;
		forwardProto?: boolean;
	};
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as ProxyBody;
		if (
			!body ||
			typeof body !== 'object' ||
			!body.frontendName ||
			!body.backendName ||
			!(Array.isArray(body.servers) && body.servers.length > 0)
		) {
			return json(
				{
					error:
						'Body must be JSON: { frontendName, backendName, bindPort, servers: [ { name, address, port } ] }'
				},
				{ status: 400 }
			);
		}
		const bindPort = Number(body.bindPort);
		if (!Number.isInteger(bindPort) || bindPort < 1 || bindPort > 65535) {
			return json({ error: 'bindPort must be 1–65535' }, { status: 400 });
		}
		const bindAddress = body.bindAddress ?? '*';
		const bindName = body.bindName ?? `bind_${bindPort}`;
		const options = body.options ?? {};

		// 1) Backend anlegen
		await createBackend({
			name: body.backendName,
			mode: 'http',
			balance: { algorithm: 'roundrobin' }
		});

		// 2) Server im Backend
		for (const srv of body.servers) {
			const port = Number(srv.port);
			await createServer(body.backendName, {
				name: srv.name || srv.address.replace(/[.:]/g, '_'),
				address: srv.address,
				port: Number.isInteger(port) ? port : 80
			});
		}

		// 3) Frontend mit default_backend
		await createFrontend({
			name: body.frontendName,
			mode: 'http',
			default_backend: body.backendName,
			maxconn: 3000
		});

		// 4) Bind am Frontend
		await createBind(body.frontendName, {
			name: bindName,
			address: bindAddress,
			port: bindPort
		});

		// 5) Optionen: Defaults anpassen (forwardfor, WebSocket-Timeouts). forwardProto: Hinweis in UI.
		if (options.forwardClientIp || options.websocketSupport) {
			const defaultsRaw = await getDefaults();
			const defaultsList = Array.isArray(defaultsRaw)
				? defaultsRaw
				: (defaultsRaw as { data?: unknown[] })?.data
					? (defaultsRaw as { data: unknown[] }).data
					: [];
			const first = defaultsList[0] as Record<string, unknown> | undefined;
			if (first && typeof first.name === 'string') {
				const payload: Record<string, unknown> = { ...first };
				if (options.forwardClientIp) {
					payload.forwardfor = { enabled: 'enabled', except: '127.0.0.0/8' };
				}
				if (options.websocketSupport) {
					// Lange Timeouts für WebSocket (1 h)
					const oneHourMs = 3600000;
					payload.client_timeout = oneHourMs;
					payload.server_timeout = oneHourMs;
					payload.connect_timeout = 10000;
				}
				// forwardProto (X-Forwarded-Proto) wird oft per http-request gesetzt; in defaults gibt es kein direktes Feld
				await updateDefaults(first.name, payload);
			}
		}

		logAction({
			action: 'proxy_created',
			resource_type: 'frontend',
			resource_id: body.frontendName,
			details: `POST /api/config/proxies: ${body.frontendName} → ${body.backendName}`
		});
		return json({
			ok: true,
			frontend: body.frontendName,
			backend: body.backendName,
			bind: { address: bindAddress, port: bindPort }
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
