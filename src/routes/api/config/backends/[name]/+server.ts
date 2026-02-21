import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getBackend,
	getFrontends,
	getServers,
	frontendNamesUsingBackend,
	updateBackend,
	deleteBackend
} from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

function toList(raw: unknown): unknown[] {
	return Array.isArray(raw) ? raw : (raw as { data?: unknown[] })?.data ?? [];
}

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
			servers: toList(serversRaw),
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
		const body = await request.json();
		if (!body || typeof body !== 'object') {
			return json({ error: 'Body must be JSON object' }, { status: 400 });
		}
		const result = await updateBackend(params.name, body as Record<string, unknown>);
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
