import type { PageServerLoad } from './$types';
import { getAcmeProviders } from '$lib/server/dataplane';

function toList(raw: unknown): { name: string; directory?: string }[] {
	const arr = Array.isArray(raw) ? raw : [];
	return arr
		.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null && 'name' in x)
		.map((x) => ({
			name: String(x.name),
			directory: typeof x.directory === 'string' ? x.directory : undefined
		}));
}

export const load: PageServerLoad = async () => {
	try {
		const raw = await getAcmeProviders();
		return { providers: toList(raw), error: null };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { providers: [], error: message };
	}
};
