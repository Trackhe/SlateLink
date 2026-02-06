import type { PageServerLoad } from './$types';
import { getFrontends, getBackends } from '$lib/server/dataplane';

type Named = { name: string };

function toNamedList(raw: unknown): Named[] {
	if (Array.isArray(raw)) return raw.filter((x): x is Named => typeof x === 'object' && x !== null && 'name' in x && typeof (x as Named).name === 'string');
	const obj = raw as { data?: unknown[] };
	if (Array.isArray(obj?.data)) return obj.data.filter((x): x is Named => typeof x === 'object' && x !== null && 'name' in x && typeof (x as Named).name === 'string');
	return [];
}

export const load: PageServerLoad = async () => {
	try {
		const [frontendsRaw, backendsRaw] = await Promise.all([
			getFrontends(),
			getBackends()
		]);
		return {
			frontends: toNamedList(frontendsRaw),
			backends: toNamedList(backendsRaw),
			error: null
		};
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { frontends: [], backends: [], error: message };
	}
};
