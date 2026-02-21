import type { PageServerLoad } from './$types';
import {
	getCrtStores,
	getCrtStore,
	getCrtLoads,
	getAcmeProviders,
	getAcmeRuntimeStatus,
	getStorageSslCertificates,
	getRuntimeSslCerts,
	getSslCertificatesUsedInBinds
} from '$lib/server/dataplane';
import { getCertSpecsFromDomainMappingFile } from '$lib/server/domain-mapping';
import { ensureDefaultCrtStore } from '$lib/server/default-crt-store';

function toList(raw: unknown): { name: string }[] {
	const arr = Array.isArray(raw) ? raw : [];
	return arr
		.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null && 'name' in x)
		.map((x) => ({ name: String(x.name) }));
}

function loadList(raw: unknown): Record<string, unknown>[] {
	const arr = Array.isArray(raw) ? raw : [];
	return arr.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null);
}

function toStorageList(raw: unknown): { storage_name?: string; file?: string }[] {
	const arr = Array.isArray(raw) ? raw : [];
	return arr
		.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
		.map((x) => ({
			storage_name: typeof x.storage_name === 'string' ? x.storage_name : undefined,
			file: typeof x.file === 'string' ? x.file : undefined
		}));
}

type AcmeCert = {
	certificate?: string;
	state?: string;
	expiries_in?: string;
	expiry_date?: string;
	scheduled_renewal?: string;
	renewal_in?: string;
	acme_section?: string;
};

function toAcmeList(raw: unknown): AcmeCert[] {
	const arr = Array.isArray(raw) ? raw : [];
	return arr.filter(
		(x): x is AcmeCert =>
			typeof x === 'object' && x !== null && typeof (x as AcmeCert).certificate === 'string'
	);
}

export type RuntimeCert = {
	file?: string;
	storage_name?: string;
	subject?: string;
	chain_issuer?: string;
	issuers?: string;
	not_after?: string;
	not_before?: string;
	status?: string;
};

function toRuntimeCertList(raw: unknown): RuntimeCert[] {
	const arr = Array.isArray(raw) ? raw : [];
	return arr
		.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
		.map((x) => ({
			file: typeof x.file === 'string' ? x.file : undefined,
			storage_name: typeof x.storage_name === 'string' ? x.storage_name : undefined,
			subject: typeof x.subject === 'string' ? x.subject : undefined,
			chain_issuer: typeof x.chain_issuer === 'string' ? x.chain_issuer : undefined,
			issuers: typeof x.issuers === 'string' ? x.issuers : undefined,
			not_after: typeof x.not_after === 'string' ? x.not_after : undefined,
			not_before: typeof x.not_before === 'string' ? x.not_before : undefined,
			status: typeof x.status === 'string' ? x.status : undefined
		}));
}

export const load: PageServerLoad = async () => {
	try {
		await ensureDefaultCrtStore();
		const [raw, acmeRaw, acmeStatusRaw, storageRaw, runtimeRaw, certsUsedInBindsSet, certsFromMapping] =
			await Promise.all([
				getCrtStores(),
				getAcmeProviders(),
				getAcmeRuntimeStatus().catch(() => []),
				getStorageSslCertificates().catch(() => []),
				getRuntimeSslCerts().catch(() => []),
				getSslCertificatesUsedInBinds().catch(() => new Set<string>()),
				getCertSpecsFromDomainMappingFile().catch(() => new Set<string>())
			]);
		const certsUsedInBindsMerged = new Set([...certsUsedInBindsSet, ...certsFromMapping]);
		const storeList = toList(raw);
		const acmeList = (Array.isArray(acmeRaw) ? acmeRaw : [])
			.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null && 'name' in x)
			.map((x) => String(x.name))
			.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
		const acmeStatus = (Array.isArray(acmeStatusRaw) ? acmeStatusRaw : []) as {
			certificate?: string;
			state?: string;
			expiries_in?: string;
			expiry_date?: string;
			acme_section?: string;
			scheduled_renewal?: string;
			renewal_in?: string;
		}[];

		const storesWithDetails = await Promise.all(
			storeList.map(async (s) => {
				try {
					const [storeRaw, loadsRaw] = await Promise.all([
						getCrtStore(s.name),
						getCrtLoads(s.name)
					]);
					const store = storeRaw as Record<string, unknown>;
					const loads = loadList(loadsRaw);
					const loadsSorted = [...loads].sort((a, b) => {
						const nameA = String((a as { certificate?: string }).certificate ?? '');
						const nameB = String((b as { certificate?: string }).certificate ?? '');
						return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
					});
					return {
						name: s.name,
						crt_base: store?.crt_base ?? '',
						key_base: store?.key_base ?? '',
						loads: loadsSorted
					};
				} catch {
					return { name: s.name, crt_base: '', key_base: '', loads: [] };
				}
			})
		);
		const storesSorted = [...storesWithDetails].sort((a, b) =>
			a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
		);
		const certificatesRaw = toStorageList(storageRaw);
		const certificates = [...certificatesRaw].sort((a, b) => {
			const keyA = (a.storage_name ?? a.file ?? '').toString();
			const keyB = (b.storage_name ?? b.file ?? '').toString();
			return keyA.localeCompare(keyB, undefined, { sensitivity: 'base' });
		});
		const acmeCertificates = toAcmeList(acmeStatusRaw);
		const runtimeCertsRaw = toRuntimeCertList(runtimeRaw);
		const runtimeCerts = [...runtimeCertsRaw].sort((a, b) => {
			const keyA = (a.storage_name ?? a.file ?? '').toString();
			const keyB = (b.storage_name ?? b.file ?? '').toString();
			return keyA.localeCompare(keyB, undefined, { sensitivity: 'base' });
		});
		const certsUsedInBinds = Array.from(certsUsedInBindsMerged).sort((a, b) =>
			a.localeCompare(b, undefined, { sensitivity: 'base' })
		);
		return {
			stores: storesSorted,
			acmeProviders: acmeList,
			acmeStatus,
			certificates,
			acmeCertificates,
			runtimeCerts,
			certsUsedInBinds,
			error: null
		};
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return {
			stores: [],
			acmeProviders: [],
			acmeStatus: [],
			certificates: [],
			acmeCertificates: [],
			runtimeCerts: [],
			certsUsedInBinds: [],
			error: message
		};
	}
};
