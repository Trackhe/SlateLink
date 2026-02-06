import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteServer } from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		await deleteServer(params.name, params.server_name);
		logAction({
			action: 'server_deleted',
			resource_type: 'backend',
			resource_id: params.name,
			details: `DELETE server ${params.server_name} from backend ${params.name}`
		});
		return new Response(null, { status: 204 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
