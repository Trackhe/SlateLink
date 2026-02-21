/**
 * Eingebauter Default-Zertifikat-Store "default":
 * - Enthält ein einfaches selbstsigniertes Zertifikat (default.pem).
 * - Wird für die crt_list genutzt, wenn kein anderes Zertifikat/Store gewählt ist.
 * - Der Store darf nicht gelöscht werden.
 */
import { mkdirSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import forge from 'node-forge';
import { getSslCertsWriteDir } from '$lib/server/config';
import {
	getCrtStores,
	createCrtStore,
	getCrtLoads,
	createCrtLoad
} from '$lib/server/dataplane';

export const DEFAULT_CRT_STORE_NAME = 'default';
export const DEFAULT_CRT_FILENAME = 'default.pem';
const CRT_BASE_IN_CONTAINER = '/usr/local/etc/haproxy/ssl';

function toStoreList(raw: unknown): { name?: string }[] {
	if (!Array.isArray(raw)) return [];
	return raw.filter(
		(x): x is Record<string, unknown> => typeof x === 'object' && x !== null && 'name' in x
	) as { name?: string }[];
}

function toLoadList(raw: unknown): { certificate?: string }[] {
	if (!Array.isArray(raw)) return [];
	return raw.filter(
		(x): x is Record<string, unknown> => typeof x === 'object' && x !== null
	) as { certificate?: string }[];
}

/** Erzeugt ein selbstsigniertes PEM (Zertifikat + privater Schlüssel in einer Datei für HAProxy). */
function generateSelfSignedPem(): string {
	const keys = forge.pki.rsa.generateKeyPair(2048);
	const cert = forge.pki.createCertificate();
	cert.publicKey = keys.publicKey;
	cert.serialNumber = '01';
	cert.validity.notBefore = new Date();
	cert.validity.notAfter = new Date();
	cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
	const attrs = [
		{ name: 'commonName', value: 'SlateLink Default' },
		{ name: 'organizationName', value: 'SlateLink' }
	];
	cert.setSubject(attrs);
	cert.setIssuer(attrs);
	cert.sign(keys.privateKey, forge.md.sha256.create());
	const certPem = forge.pki.certificateToPem(cert);
	const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
	return `${certPem}${keyPem}`;
}

/**
 * Stellt sicher, dass der Default-Store existiert und ein selbstsigniertes Zertifikat enthält.
 * Idempotent: legt nur an, was fehlt.
 */
export async function ensureDefaultCrtStore(): Promise<void> {
	const baseDir = getSslCertsWriteDir();
	if (!baseDir) return;

	const pemPath = join(baseDir, DEFAULT_CRT_FILENAME);
	if (!existsSync(pemPath)) {
		try {
			mkdirSync(baseDir, { recursive: true });
		} catch {
			// ignore
		}
		const pem = generateSelfSignedPem();
		await writeFile(pemPath, pem, 'utf8');
	}

	const storesRaw = await getCrtStores();
	const stores = toStoreList(Array.isArray(storesRaw) ? storesRaw : (storesRaw as { data?: unknown })?.data ?? []);
	const hasDefaultStore = stores.some((s) => (s.name ?? '').trim() === DEFAULT_CRT_STORE_NAME);
	if (!hasDefaultStore) {
		await createCrtStore({
			name: DEFAULT_CRT_STORE_NAME,
			crt_base: CRT_BASE_IN_CONTAINER,
			key_base: CRT_BASE_IN_CONTAINER
		});
	}

	const loadsRaw = await getCrtLoads(DEFAULT_CRT_STORE_NAME);
	const loads = toLoadList(Array.isArray(loadsRaw) ? loadsRaw : (loadsRaw as { data?: unknown[] })?.data ?? []);
	const hasDefaultPem = loads.some((l) => (l.certificate ?? '').trim() === DEFAULT_CRT_FILENAME);
	if (!hasDefaultPem) {
		await createCrtLoad(DEFAULT_CRT_STORE_NAME, { certificate: DEFAULT_CRT_FILENAME });
	}
}
