import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getBackend,
	getFrontends,
	getServers,
	getServer,
	updateServer,
	frontendNamesUsingBackend,
	updateBackend,
	deleteBackend
} from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';
import { toDpaList } from '$lib/server/dpa-utils';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const [backend, frontendsRaw, serversRaw] = await Promise.all([
			getBackend(params.name),
			getFrontends(),
			getServers(params.name)
		]);
		const frontendsUsingThis = frontendNamesUsingBackend(frontendsRaw, params.name);
		return json({
			backend,
			servers: toDpaList(serversRaw),
			frontendsUsingThis,
			canDelete: frontendsUsingThis.length === 0,
			error: null
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ backend: null, servers: [], frontendsUsingThis: [], canDelete: false, error: message }, { status: 502 });
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const body = (await request.json()) as Record<string, unknown>;
		if (!body || typeof body !== 'object') {
			return json({ error: 'Body must be JSON object' }, { status: 400 });
		}
		const useHttpsBackend = body.mode === 'https';
		const payload = { ...body };
		if (useHttpsBackend) payload.mode = 'http';
		const result = await updateBackend(params.name, payload);
		if (useHttpsBackend) {
			const serversRaw = await getServers(params.name);
			const list = Array.isArray(serversRaw) ? serversRaw : (serversRaw as { data?: unknown[] })?.data ?? [];
			for (const s of list) {
				const serverName = (s as { name?: string }).name;
				if (typeof serverName !== 'string') continue;
				const existing = (await getServer(params.name, serverName)) as Record<string, unknown> | undefined;
				const merged = existing ? { ...existing, ssl: 'enabled' as const, verify: 'none' as const } : { ssl: 'enabled' as const, verify: 'none' as const };
				await updateServer(params.name, serverName, merged);
			}
		}
		logAction({
			action: 'backend_updated',
			resource_type: 'backend',
			resource_id: params.name,
			details: 'PUT /api/config/backends/' + params.name
		});
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const frontendsRaw = await getFrontends();
		const using = frontendNamesUsingBackend(frontendsRaw, params.name);
		if (using.length > 0) {
			return json(
				{
					error: 'Backend kann nicht gelöscht werden: mindestens ein Frontend verweist darauf.',
					frontends: using
				},
				{ status: 409 }
			);
		}
		await deleteBackend(params.name);
		logAction({
			action: 'backend_deleted',
			resource_type: 'backend',
			resource_id: params.name,
			details: 'DELETE /api/config/backends/' + params.name
		});
		return new Response(null, { status: 204 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
