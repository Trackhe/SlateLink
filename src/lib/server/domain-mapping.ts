/**
 * domain_mapping.txt: zentrale crt-list für alle Frontend-Regeln.
 * Format: @store/cert.pem domain1 domain2  oder  /path/cert.pem domain1 domain2
 * HAProxy nutzt @store/cert → schaut im Cert-Store, sonst Pfad/ACME.
 * Datei liegt in HAPROXY_SSL_CERTS_DIR (Host), in HAProxy-Config: DOMAIN_MAPPING_CRT_LIST_PATH.
 * Inhalt wird aus frontend_rules (Regeln) gebaut; optional pending für neue Regel vor dem Speichern.
 */
import { mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSslCertsWriteDir } from '$lib/server/config';
import {
	getAllFrontendRules,
	getConfig,
	CONFIG_KEY_DEFAULT_SSL_CRT_LIST,
	type BindCertRef
} from '$lib/server/db';
import { DEFAULT_CRT_STORE_NAME, DEFAULT_CRT_FILENAME } from '$lib/server/default-crt-store';
import { resolveCertToStore, getCrtLoads } from '$lib/server/dataplane';
import { toDpaList } from '$lib/server/dpa-utils';

/** Pfad, wie ihn HAProxy in der Bind-Config sieht (crt_list). Muss zu resources.ssl_certs_dir passen. */
export const DOMAIN_MAPPING_CRT_LIST_PATH = '/usr/local/etc/haproxy/ssl/domain_mapping.txt';

const FILENAME = 'domain_mapping.txt';

export type { BindCertRef };

/** Eintrag für domain_mapping (Regel oder pending). */
export type PendingMappingEntry = {
	feName: string;
	bindName?: string;
	ref: BindCertRef;
	domains: string[];
};

function certSpecFromRef(ref: BindCertRef): string {
	if (ref.type === 'store') return `@${ref.store}/${ref.cert}`;
	return `/usr/local/etc/haproxy/ssl/${ref.cert}`;
}

function commentFor(certSpec: string, domains: string[], ref: BindCertRef): string {
	const certLabel = ref.type === 'store' ? ref.cert : ref.cert;
	if (domains.length === 0) return `# ${certLabel} (Standard-Zertifikat)`;
	if (ref.type === 'store') {
		if (domains.length === 1) return `# Das ${certLabel} Zertifikat aus dem Store nur für "${domains[0]}" nutzen`;
		return `# Das ${certLabel} Zertifikat aus dem Store für ${domains.join(', ')} nutzen`;
	}
	if (domains.length === 1) return `# ${certLabel} nur für "${domains[0]}" nutzen`;
	return `# ${certLabel} für ${domains.join(', ')} nutzen`;
}

/**
 * Baut den Inhalt von domain_mapping.txt aus frontend_rules (Regeln).
 * Optional: pending = neue Einträge (z. B. neue Regel vor dem Speichern).
 */
export async function buildDomainMappingContent(
	pending: PendingMappingEntry[] = []
): Promise<string> {
	const lines: string[] = [
		'# domain_mapping.txt – von SlateLink verwaltet',
		'# Pro Zeile: Zertifikat (@store/datei.pem oder Pfad), optional gefolgt von Domain(s) für SNI',
		''
	];

	for (const p of pending) {
		let ref = p.ref;
		if (ref.type === 'path') {
			const resolved = await resolveCertToStore(ref.cert);
			if (resolved) ref = { type: 'store', store: resolved.store, cert: resolved.cert };
		}
		const certSpec = certSpecFromRef(ref);
		const domainList = (p.domains ?? []).filter((d) => typeof d === 'string' && d.trim());
		const line = domainList.length > 0 ? `${certSpec} ${domainList.join(' ')}` : certSpec;
		lines.push(commentFor(certSpec, domainList, ref));
		lines.push(line);
		lines.push('');
	}

	const rules = getAllFrontendRules();
	for (const r of rules) {
		if (!r.cert_ref) continue;
		let ref = r.cert_ref;
		if (ref.type === 'path') {
			const resolved = await resolveCertToStore(ref.cert);
			if (resolved) ref = { type: 'store', store: resolved.store, cert: resolved.cert };
		}
		if (ref.type === 'store' && !ref.cert) {
			try {
				const loadsRaw = await getCrtLoads(ref.store);
				const loads = toDpaList(loadsRaw) as { certificate?: string }[];
				const firstLoad = loads.find((load) => load?.certificate);
				if (firstLoad?.certificate) ref = { type: 'store', store: ref.store, cert: firstLoad.certificate };
			} catch {
				// Store nicht lesbar, überspringen
				continue;
			}
		}
		const certSpec = certSpecFromRef(ref);
		const domainList = (r.domains ?? []).filter((d) => typeof d === 'string' && d.trim());
		const line = domainList.length > 0 ? `${certSpec} ${domainList.join(' ')}` : certSpec;
		lines.push(commentFor(certSpec, domainList, ref));
		lines.push(line);
		lines.push('');
	}

	// Wenn keine Zertifikatszeile aus Regeln: eingebauter Store "default" oder Nutzer-Auswahl aus DB.
	// crt-list erwartet @store/certificate (z. B. @default/default.pem), nicht @store/.
	const hasCertLine = lines.some((l) => l.trim() && !l.trim().startsWith('#'));
	const defaultSpec = getConfig(CONFIG_KEY_DEFAULT_SSL_CRT_LIST)?.trim();
	const specToUse = defaultSpec || `store:${DEFAULT_CRT_STORE_NAME}`;
	if (!hasCertLine) {
		let certSpec: string;
		if (specToUse.startsWith('store:')) {
			const storeName = specToUse.slice(6).trim();
			// Eingebauter Store: immer @default/default.pem; andere Stores: @name/ (erster Load), hier nur default sicher.
			certSpec =
				storeName === DEFAULT_CRT_STORE_NAME
					? `@${DEFAULT_CRT_STORE_NAME}/${DEFAULT_CRT_FILENAME}`
					: `@${storeName}/`;
		} else {
			certSpec = `/usr/local/etc/haproxy/ssl/${specToUse}`;
		}
		lines.push(defaultSpec ? '# Standard-Zertifikat für HTTPS-Binds (aus Konfiguration)' : '# Eingebauter Default-Store (selbstsigniertes Zertifikat)');
		lines.push(certSpec);
		lines.push('');
	}

	return lines.join('\n').trimEnd() + '\n';
}


/**
 * Schreibt domain_mapping.txt (crt_list für HTTPS-Binds). Verzeichnis: HAPROXY_SSL_CERTS_DIR oder haproxy/ssl.
 * pending = optionale neue Einträge (z. B. vor createBind). Stellt vorher den Default-Store sicher.
 */
export async function writeDomainMappingFile(
	pending: PendingMappingEntry[] = []
): Promise<void> {
	const { ensureDefaultCrtStore } = await import('$lib/server/default-crt-store');
	await ensureDefaultCrtStore();
	const baseDir = getSslCertsWriteDir();
	if (!baseDir) return;
	try {
		mkdirSync(baseDir, { recursive: true });
	} catch {
		// Verzeichnis existiert evtl. bereits
	}
	const content = await buildDomainMappingContent(pending);
	const path = join(baseDir, FILENAME);
	await writeFile(path, content, 'utf8');
}

/**
 * Liest domain_mapping.txt und liefert alle Zertifikats-Spezifikationen (erste Spalte jeder Zeile).
 * Für „wird in Binds verwendet“: mit getSslCertificatesUsedInBinds() zusammenführen.
 */
export async function getCertSpecsFromDomainMappingFile(): Promise<Set<string>> {
	const baseDir = getSslCertsWriteDir();
	if (!baseDir) return new Set();
	const path = join(baseDir, FILENAME);
	try {
		const content = await readFile(path, 'utf8');
		const used = new Set<string>();
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const first = trimmed.split(/\s+/)[0];
			if (first) used.add(first);
		}
		return used;
	} catch {
		return new Set();
	}
}
