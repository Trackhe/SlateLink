/**
 * Synchronisiert Runtime-Zertifikate in den DPA-Storage (ssl_certs_dir):
 * - Noch nicht auf Disk: anlegen (POST).
 * - Bereits auf Disk (z. B. nach ACME-Renewal): ersetzen (PUT), damit die Datei aktuell bleibt.
 */
import {
	getRuntimeSslCerts,
	getStorageSslCertificates,
	createStorageSslCertificateFromPem,
	replaceStorageSslCertificate
} from '$lib/server/dataplane';
import { dumpSslCertViaSocket } from '$lib/server/haproxy-socket';
import { dumpSslCertViaDockerExec } from '$lib/server/haproxy-docker-exec';
import { readPemFromCertDirWithFallbacks } from '$lib/server/haproxy-certs-dir';
import { certSyncIntervalMs } from '$lib/server/config';
import { toArray } from '$lib/server/dpa-utils';

function toStorageList(raw: unknown): Set<string> {
	const arr = toArray(raw);
	const names = new Set<string>();
	for (const x of arr) {
		if (typeof x !== 'object' || x === null) continue;
		const o = x as Record<string, unknown>;
		if (typeof o.storage_name === 'string' && o.storage_name) names.add(o.storage_name);
		if (typeof o.file === 'string' && o.file) names.add(o.file);
	}
	return names;
}

function toRuntimeCertList(raw: unknown): { storage_name?: string; file?: string; subject?: string; chain_issuer?: string; issuers?: string; not_after?: string }[] {
	const arr = toArray(raw);
	return arr
		.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
		.map((x) => ({
			storage_name: typeof x.storage_name === 'string' ? x.storage_name : undefined,
			file: typeof x.file === 'string' ? x.file : undefined,
			subject: typeof x.subject === 'string' ? x.subject : undefined,
			chain_issuer: typeof x.chain_issuer === 'string' ? x.chain_issuer : undefined,
			issuers: typeof x.issuers === 'string' ? x.issuers : undefined,
			not_after: typeof x.not_after === 'string' ? x.not_after : undefined
		}));
}

function runtimeName(r: { storage_name?: string; file?: string }): string {
	return r.storage_name ?? r.file ?? '';
}

function isLoadedCert(r: { subject?: string; chain_issuer?: string; issuers?: string; not_after?: string }): boolean {
	return (
		(typeof r.subject === 'string' && r.subject.trim() !== '') ||
		(typeof r.chain_issuer === 'string' && r.chain_issuer.trim() !== '') ||
		(typeof r.issuers === 'string' && r.issuers.trim() !== '') ||
		(typeof r.not_after === 'string' && r.not_after.trim() !== '')
	);
}

function isInStorage(r: { storage_name?: string; file?: string }, storageNames: Set<string>): boolean {
	const n = runtimeName(r);
	if (storageNames.has(n)) return true;
	if (r.storage_name != null && storageNames.has(r.storage_name)) return true;
	if (r.file != null && storageNames.has(r.file)) return true;
	const filePart = n.includes('/') ? n.slice(n.lastIndexOf('/') + 1) : null;
	return filePart != null && storageNames.has(filePart);
}

async function getPemForName(name: string): Promise<string | null> {
	let pem = await readPemFromCertDirWithFallbacks(name);
	if (pem) return pem;
	pem = await dumpSslCertViaDockerExec(name);
	if (pem) return pem;
	if (name.startsWith('@') && name.includes('/')) {
		const filePart = name.slice(name.indexOf('/') + 1);
		if (filePart) pem = await dumpSslCertViaDockerExec(filePart);
	}
	if (pem) return pem;
	pem = await dumpSslCertViaSocket(name);
	if (pem) return pem;
	if (name.startsWith('@') && name.includes('/')) {
		const filePart = name.slice(name.indexOf('/') + 1);
		if (filePart) pem = await dumpSslCertViaSocket(filePart);
	}
	return pem;
}

export type SyncResult = { saved: string[]; errors: { name: string; error: string }[] };

export async function syncRuntimeCertsToStorage(): Promise<SyncResult> {
	const saved: string[] = [];
	const errors: { name: string; error: string }[] = [];

	let storageRaw: unknown;
	let runtimeRaw: unknown;
	try {
		[storageRaw, runtimeRaw] = await Promise.all([
			getStorageSslCertificates().catch(() => []),
			getRuntimeSslCerts().catch(() => [])
		]);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return { saved: [], errors: [{ name: '', error: `Laden fehlgeschlagen: ${msg}` }] };
	}

	const storageNames = toStorageList(storageRaw);
	const runtimeCerts = toRuntimeCertList(runtimeRaw);
	const toAdd = runtimeCerts.filter((r) => {
		const name = runtimeName(r);
		if (!name || !isLoadedCert(r)) return false;
		return !isInStorage(r, storageNames);
	});
	const toUpdate = runtimeCerts.filter((r) => {
		const name = runtimeName(r);
		if (!name || !isLoadedCert(r)) return false;
		return isInStorage(r, storageNames);
	});

	for (const r of toAdd) {
		const name = runtimeName(r);
		const pem = await getPemForName(name);
		if (!pem) {
			errors.push({ name, error: 'PEM konnte nicht geladen werden (Socket/Docker exec?).' });
			continue;
		}
		try {
			await createStorageSslCertificateFromPem(name, pem);
			saved.push(name);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			errors.push({ name, error: msg });
		}
	}

	for (const r of toUpdate) {
		const name = runtimeName(r);
		const pem = await getPemForName(name);
		if (!pem) {
			errors.push({ name, error: 'PEM konnte nicht geladen werden (Update).' });
			continue;
		}
		try {
			await replaceStorageSslCertificate(name, pem);
			saved.push(name);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			errors.push({ name, error: msg });
		}
	}

	return { saved, errors };
}

/**
 * Einzelnes Zertifikat (nur im RAM) in den Storage schreiben („Save to disk“).
 * name z. B. @customdocker/test.pem
 */
export async function saveRuntimeCertToStorage(name: string): Promise<void> {
	return saveRuntimeCertToStorageAs(name, name);
}

/**
 * Zertifikat aus Runtime unter anderem Dateinamen im Storage speichern.
 * runtimeName = Name in HAProxy (z. B. @store/cert.pem), storageFileName = Dateiname auf Disk (z. B. cert.pem).
 */
export async function saveRuntimeCertToStorageAs(
	runtimeName: string,
	storageFileName: string
): Promise<void> {
	const pem = await getPemForName(runtimeName);
	if (!pem) {
		throw new Error('PEM konnte nicht geladen werden (Socket/Docker/Certs-Dir prüfen).');
	}
	try {
		await replaceStorageSslCertificate(storageFileName, pem);
	} catch (replaceErr) {
		const msg = replaceErr instanceof Error ? replaceErr.message : String(replaceErr);
		if (msg.includes('404')) {
			await createStorageSslCertificateFromPem(storageFileName, pem);
		} else {
			throw replaceErr;
		}
	}
}

let certSyncSchedulerStarted = false;

/** Startet den periodischen Zertifikat-Sync (Runtime → Storage), einmal pro App-Start. */
export function startCertSyncScheduler(): void {
	if (certSyncSchedulerStarted) return;
	certSyncSchedulerStarted = true;
	if (certSyncIntervalMs <= 0) return;

	const tick = async () => {
		try {
			await syncRuntimeCertsToStorage();
		} catch {
			// Fehler still, Timer läuft weiter
		}
	};

	setInterval(tick, certSyncIntervalMs);
	setTimeout(tick, 10_000);
}
