import type { PageServerLoad } from './$types';
import { getInfo, getStats } from '$lib/server/dataplane';

export const load: PageServerLoad = async () => {
	let data: Record<string, unknown> | null = null;
	let stats: unknown = null;
	let error: string | null = null;
	let statsError: string | null = null;

	try {
		data = (await getInfo()) as Record<string, unknown>;
	} catch (e) {
		error = e instanceof Error ? e.message : String(e);
	}

	let rawStats: unknown = null;
	if (data) {
		try {
			const raw = await getStats();
			rawStats = raw;
			// DPA liefert { stats: [ { name, type, stats: { req_tot, bin, bout, ... }, backend_name? } ] }
			const arr =
				Array.isArray(raw)
					? raw
					: (raw && typeof raw === 'object' && Array.isArray((raw as { stats?: unknown[] }).stats))
						? (raw as { stats: unknown[] }).stats
						: (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown[] }).data))
							? (raw as { data: unknown[] }).data
							: [];
			// Pro Eintrag: { name, type, stats } → flach machen für Tabelle: { type, name, req_tot, bin, ... }
			stats = arr.map((item: unknown) => {
				if (item == null || typeof item !== 'object') return item;
				const row = item as { name?: string; type?: string; stats?: Record<string, unknown>; backend_name?: string };
				const name = row.backend_name ? `${row.name} (${row.backend_name})` : (row.name ?? '');
				return { type: row.type ?? '', name, ...(row.stats ?? {}) };
			});
		} catch (e) {
			statsError = e instanceof Error ? e.message : String(e);
		}
	}

	return { data, stats, error, statsError, rawStats };
};
