import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createFrontend,
	createBind,
	getDefaults,
	updateDefaults,
	getFrontends,
	getBackends,
	usedConfigNames,
	getAllUsedBindEndpoints,
	bindEndpointKey,
	syncRedirectHttpToHttps
} from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';
import { setFrontendOptions } from '$lib/server/db';

type BindEntry = { name?: string; address?: string; port: number };

type FrontendBody = {
	name: string;
	default_backend: string;
	/** Mehrere Binds (wie beim Bearbeiten). Wenn gesetzt, werden bindAddress/bindPort ignoriert. */
	binds?: BindEntry[];
	bindAddress?: string;
	bindPort?: number;
	bindName?: string;
	options?: {
		forwardClientIp?: boolean;
		websocketSupport?: boolean;
		forwardProto?: boolean;
		redirectHttpToHttps?: boolean;
	};
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as FrontendBody;
		if (!body || typeof body !== 'object' || !body.name || !body.default_backend) {
			return json(
				{ error: 'Body must be JSON with name and default_backend. Optional: binds[], bindAddress, bindPort, options' },
				{ status: 400 }
			);
		}
		const name = String(body.name).trim();
		const default_backend = String(body.default_backend).trim();
		const [frontendsRaw, backendsRaw] = await Promise.all([getFrontends(), getBackends()]);
		if (usedConfigNames(frontendsRaw, backendsRaw).has(name)) {
			return json(
				{ error: 'Name bereits vergeben (Frontend oder Backend). Namen müssen eindeutig sein.' },
				{ status: 409 }
			);
		}
		const options = body.options ?? {};

		// Binds: entweder Array oder ein einzelner Bind (Legacy)
		const bindsList: BindEntry[] = Array.isArray(body.binds) && body.binds.length > 0
			? body.binds.filter((b) => typeof b === 'object' && b !== null && Number(b.port) >= 1 && Number(b.port) <= 65535)
			: [];
		const useSingleBind = bindsList.length === 0 && body.bindPort != null;
		const singlePort = Number(body.bindPort);
		const singleAddress = (body.bindAddress ?? '*').trim();
		if (useSingleBind && Number.isInteger(singlePort) && singlePort >= 1 && singlePort <= 65535) {
			bindsList.push({
				name: body.bindName ?? `bind_${singlePort}`,
				address: singleAddress,
				port: singlePort
			});
		}

		const usedBinds = await getAllUsedBindEndpoints();
		for (const b of bindsList) {
			const addr = (b.address ?? '*').trim() || '*';
			const port = Number(b.port);
			const key = bindEndpointKey(addr, port);
			if (usedBinds.has(key)) {
				return json(
					{ error: `Bind-Adresse ${addr}:${port} ist bereits vergeben. Jeder Listen-Endpunkt (Adresse:Port) darf nur einmal vorkommen.` },
					{ status: 409 }
				);
			}
			usedBinds.add(key);
		}

		if (bindsList.length === 0) {
			return json(
				{ error: 'Mindestens ein Bind (Adresse + Port 1–65535) ist nötig.' },
				{ status: 400 }
			);
		}

		await createFrontend({
			name,
			mode: 'http',
			default_backend,
			maxconn: 3000
		});

		for (const b of bindsList) {
			const bindName = (b.name ?? '').trim() || `bind_${b.port}`;
			await createBind(name, {
				name: bindName,
				address: (b.address ?? '*').trim() || '*',
				port: Number(b.port)
			});
		}

		setFrontendOptions(name, {
			forwardClientIp: options.forwardClientIp,
			forwardProto: options.forwardProto,
			websocketSupport: options.websocketSupport,
			redirectHttpToHttps: options.redirectHttpToHttps
		});

		await syncRedirectHttpToHttps(name, options.redirectHttpToHttps ?? false);

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
			binds: bindsList.map((b) => ({ address: (b.address ?? '*').trim() || '*', port: Number(b.port) }))
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
