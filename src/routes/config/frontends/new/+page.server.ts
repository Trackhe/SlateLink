import type { PageServerLoad } from './$types';
import { getBackends } from '$lib/server/dataplane';

type Named = { name: string };

function toNamedList(raw: unknown): Named[] {
	if (Array.isArray(raw)) {
		return raw.filter(
			(x): x is Named => typeof x === 'object' && x !== null && 'name' in x && typeof (x as Named).name === 'string'
		);
	}
	const obj = raw as { data?: unknown[] };
	if (Array.isArray(obj?.data)) {
		return obj.data.filter(
			(x): x is Named => typeof x === 'object' && x !== null && 'name' in x && typeof (x as Named).name === 'string'
		);
	}
	return [];
}

export const load: PageServerLoad = async () => {
	try {
		const backendsRaw = await getBackends();
		return { backends: toNamedList(backendsRaw) };
	} catch (e) {
		return { backends: [] };
	}
};
