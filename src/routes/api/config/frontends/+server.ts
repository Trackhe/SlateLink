import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createFrontend,
	createBind,
	getDefaults,
	updateDefaults
} from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

type FrontendBody = {
	name: string;
	default_backend: string;
	bindAddress?: string;
	bindPort?: number;
	bindName?: string;
	options?: {
		forwardClientIp?: boolean;
		websocketSupport?: boolean;
		forwardProto?: boolean;
	};
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as FrontendBody;
		if (!body || typeof body !== 'object' || !body.name || !body.default_backend) {
			return json(
				{ error: 'Body must be JSON with name and default_backend. Optional: bindAddress, bindPort, options' },
				{ status: 400 }
			);
		}
		const name = String(body.name).trim();
		const default_backend = String(body.default_backend).trim();
		const bindPort = Number(body.bindPort);
		const bindAddress = (body.bindAddress ?? '*').trim();
		const bindName = body.bindName ?? `bind_${Number.isInteger(bindPort) && bindPort > 0 ? bindPort : 80}`;
		const options = body.options ?? {};

		await createFrontend({
			name,
			mode: 'http',
			default_backend,
			maxconn: 3000
		});

		if (Number.isInteger(bindPort) && bindPort >= 1 && bindPort <= 65535) {
			await createBind(name, {
				name: bindName,
				address: bindAddress,
				port: bindPort
			});
		}

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
					payload.client_timeout = 3600000;
					payload.server_timeout = 3600000;
					payload.connect_timeout = 10000;
				}
				await updateDefaults(first.name, payload);
			}
		}

		logAction({
			action: 'frontend_created',
			resource_type: 'frontend',
			resource_id: name,
			details: `POST /api/config/frontends: ${name} → ${default_backend}`
		});
		return json({
			ok: true,
			name,
			default_backend,
			bind: bindPort >= 1 && bindPort <= 65535 ? { address: bindAddress, port: bindPort } : null
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
