import type { PageServerLoad } from './$types';
import {
	getFrontends,
	getBackends,
	getCrtStores,
	getStorageSslCertificates,
	getRuntimeSslCerts
} from '$lib/server/dataplane';
import { getAllFrontendRules, getConfig, CONFIG_KEY_DEFAULT_SSL_CRT_LIST } from '$lib/server/db';

type Named = { name: string };

function toNamedList(raw: unknown): Named[] {
	if (Array.isArray(raw)) return raw.filter((x): x is Named => typeof x === 'object' && x !== null && 'name' in x && typeof (x as Named).name === 'string');
	const obj = raw as { data?: unknown[] };
	if (Array.isArray(obj?.data)) return obj.data.filter((x): x is Named => typeof x === 'object' && x !== null && 'name' in x && typeof (x as Named).name === 'string');
	return [];
}

function toStoreList(raw: unknown): { name: string }[] {
	const arr = Array.isArray(raw) ? raw : [];
	return arr
		.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null && 'name' in x)
		.map((x) => ({ name: String(x.name) }));
}

function toCertList(raw: unknown): { storage_name?: string }[] {
	const arr = Array.isArray(raw) ? raw : [];
	return arr
		.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
		.map((x) => ({ storage_name: typeof x.storage_name === 'string' ? x.storage_name : undefined }));
}

function toRuntimeCertNames(raw: unknown): string[] {
	const arr = Array.isArray(raw) ? raw : [];
	const names: string[] = [];
	for (const x of arr) {
		if (typeof x !== 'object' || x === null) continue;
		const o = x as Record<string, unknown>;
		const n = (o.storage_name ?? o.file) as string | undefined;
		if (typeof n === 'string' && n.trim()) names.push(n.trim());
	}
	return [...new Set(names)];
}

export const load: PageServerLoad = async () => {
	try {
		const [frontendsRaw, backendsRaw, crtStoresRaw, sslCertsRaw, runtimeCertsRaw, rules, defaultSslCert] = await Promise.all([
			getFrontends(),
			getBackends(),
			getCrtStores(),
			getStorageSslCertificates(),
			getRuntimeSslCerts().catch(() => []),
			getAllFrontendRules(),
			Promise.resolve(getConfig(CONFIG_KEY_DEFAULT_SSL_CRT_LIST))
		]);
		const sslCerts = toCertList(sslCertsRaw);
		const storageNames = new Set(
			sslCerts.flatMap((c) => (c.storage_name ? [c.storage_name, c.storage_name.replace(/^@[^/]+\//, '')] : []))
		);
		const runtimeNames = toRuntimeCertNames(runtimeCertsRaw);
		const runtimeOnlyCerts = runtimeNames
			.filter((n) => !storageNames.has(n) && !storageNames.has(n.includes('/') ? n.slice(n.indexOf('/') + 1) : n))
			.map((name) => ({ name }));

		return {
			frontends: toNamedList(frontendsRaw),
			backends: toNamedList(backendsRaw),
			crtStores: toStoreList(crtStoresRaw),
			sslCertificates: sslCerts,
			runtimeOnlyCerts,
			rules: Array.isArray(rules) ? rules : [],
			defaultSslCertCrtList: defaultSslCert ?? '',
			error: null
		};
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return {
			frontends: [],
			backends: [],
			crtStores: [],
			sslCertificates: [],
			runtimeOnlyCerts: [],
			rules: [],
			defaultSslCertCrtList: '',
			error: message
		};
	}
};
