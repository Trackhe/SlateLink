import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteBind } from '$lib/server/dataplane';
import { logAction } from '$lib/server/audit';

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		await deleteBind(params.name, params.bind_name);
		logAction({
			action: 'bind_deleted',
			resource_type: 'frontend',
			resource_id: params.name,
			details: `DELETE bind ${params.bind_name} from frontend ${params.name}`
		});
		return new Response(null, { status: 204 });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
