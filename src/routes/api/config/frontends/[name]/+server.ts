import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFrontend, getBinds, getBind, getBackends, getDefaults, updateDefaults, updateFrontend, deleteFrontend, syncRedirectHttpToHttps } from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';
import { getFrontendOptions, setFrontendOptions } from '$lib/server/db';
import { toDpaList } from '$lib/server/dpa-utils';
function toNamedList(raw: unknown): { name: string }[] {
	return toDpaList(raw)
		.filter((x): x is { name?: string } => typeof x === 'object' && x !== null && 'name' in x)
		.filter((x) => typeof x.name === 'string')
		.map((x) => ({ name: x.name! }));
}

function optionsFromDefaults(defaultsRaw: unknown): { forwardClientIp: boolean; forwardProto: boolean; websocketSupport: boolean } {
	const list = toDpaList(defaultsRaw);
	const first = list[0] as Record<string, unknown> | undefined;
	if (!first) return { forwardClientIp: false, forwardProto: false, websocketSupport: false, redirectHttpToHttps: false };
	const forwardfor = first.forwardfor as { enabled?: string } | undefined;
	const forwardClientIp = forwardfor?.enabled === 'enabled';
	const ct = Number(first.client_timeout);
	const websocketSupport = ct >= 3600000;
	return { forwardClientIp, forwardProto: false, websocketSupport, redirectHttpToHttps: false };
}

function mergeOptions(
	fromDefaults: { forwardClientIp: boolean; forwardProto: boolean; websocketSupport: boolean; redirectHttpToHttps: boolean },
	stored: { forwardClientIp?: boolean; forwardProto?: boolean; websocketSupport?: boolean; redirectHttpToHttps?: boolean } | null
): { forwardClientIp: boolean; forwardProto: boolean; websocketSupport: boolean; redirectHttpToHttps: boolean } {
	if (!stored) return fromDefaults;
	return {
		forwardClientIp: stored.forwardClientIp ?? fromDefaults.forwardClientIp,
		forwardProto: stored.forwardProto ?? fromDefaults.forwardProto,
		websocketSupport: stored.websocketSupport ?? fromDefaults.websocketSupport,
		redirectHttpToHttps: stored.redirectHttpToHttps ?? fromDefaults.redirectHttpToHttps
	};
}

export const GET: RequestHandler = async ({ params }) => {
	try {
		const [frontend, bindsRaw, backendsRaw, defaultsRaw] = await Promise.all([
			getFrontend(params.name),
			getBinds(params.name),
			getBackends(),
			getDefaults()
		]);
		const fromDefaults = optionsFromDefaults(defaultsRaw);
		const stored = getFrontendOptions(params.name);
		const options = mergeOptions(fromDefaults, stored);
		const bindList = toDpaList(bindsRaw) as { name?: string }[];
		const bindsWithDetails = await Promise.all(
			bindList.map(async (b) => {
				const name = typeof b?.name === 'string' ? b.name : null;
				const base = { ...b } as Record<string, unknown>;
				if (name) {
					try {
						const full = (await getBind(params.name, name)) as Record<string, unknown> | undefined;
						if (full && typeof full === 'object') Object.assign(base, full);
					} catch {
						// keep list data only
					}
				}
				const domains = stored?.bindDomains?.[name ?? ''];
				if (domains && domains.length > 0) base.domains = domains;
				const certRef = stored?.bindCertRef?.[name ?? ''];
				if (certRef && typeof certRef === 'object') {
					const ref = certRef as { type: string; store?: string; cert?: string };
					base.ssl_certificate =
						ref.type === 'store' && ref.store && ref.cert
							? `@${ref.store}/${ref.cert}`
							: ref.cert ?? base.ssl_certificate;
				}
				return base;
			})
		);
		return json({
			frontend,
			binds: bindsWithDetails,
			backends: toNamedList(backendsRaw),
			options,
			error: null
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ frontend: null, binds: [], backends: [], options: { forwardClientIp: false, forwardProto: false, websocketSupport: false, redirectHttpToHttps: false }, error: message }, { status: 502 });
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		if (!body || typeof body !== 'object') {
			return json({ error: 'Body must be JSON object' }, { status: 400 });
		}
		const options = body.options as { forwardClientIp?: boolean; forwardProto?: boolean; websocketSupport?: boolean } | undefined;
		const { options: _opts, ...frontendBody } = body;
		const result = await updateFrontend(params.name, frontendBody);

		if (options) {
			setFrontendOptions(params.name, {
				forwardClientIp: options.forwardClientIp,
				forwardProto: options.forwardProto,
				websocketSupport: options.websocketSupport,
				redirectHttpToHttps: options.redirectHttpToHttps
			});
		}
		await syncRedirectHttpToHttps(params.name, options?.redirectHttpToHttps ?? false);
		if (options && (options.forwardClientIp || options.websocketSupport)) {
			const defaultsRaw = await getDefaults();
			const defaultsList = toDpaList(defaultsRaw);
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
			action: 'frontend_updated',
			resource_type: 'frontend',
			resource_id: params.name,
			details: 'PUT /api/config/frontends/' + params.name
		});
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		await deleteFrontend(params.name);
		logAction({
			action: 'frontend_deleted',
			resource_type: 'frontend',
			resource_id: params.name,
			details: 'DELETE /api/config/frontends/' + params.name
		});
		return new Response(null, { status: 204 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
