import type { PageServerLoad } from './$types';
import { getFrontend, getBinds, getBackends } from '$lib/server/dataplane';
import { toDpaList } from '$lib/server/dpa-utils';

function toNamedList(raw: unknown): { name: string }[] {
	return toList(raw)
		.filter((x): x is { name?: string } => typeof x === 'object' && x !== null && 'name' in x)
		.filter((x) => typeof x.name === 'string')
		.map((x) => ({ name: x.name! }));
}

export const load: PageServerLoad = async ({ params }) => {
	try {
		const [frontend, bindsRaw, backendsRaw] = await Promise.all([
			getFrontend(params.name),
			getBinds(params.name),
			getBackends()
		]);
		return {
			frontend,
			binds: toDpaList(bindsRaw),
			backends: toNamedList(backendsRaw),
			error: null
		};
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { frontend: null, binds: [], backends: [], error: message };
	}
};
