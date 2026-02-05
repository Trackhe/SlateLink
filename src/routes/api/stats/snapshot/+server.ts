import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeStatsSnapshot } from '$lib/server/stats';

/** Snapshot der aktuellen Stats (DPA) in die DB schreiben. */
export const GET: RequestHandler = async () => {
	try {
		const result = await writeStatsSnapshot();
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
