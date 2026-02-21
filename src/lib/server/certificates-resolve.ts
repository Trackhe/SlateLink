/**
 * Server-only: Zertifikat für eine Domain in einem Store finden oder per ACME anfordern.
 */
import {
	getCrtStore,
	getCrtLoads,
	createCrtLoad,
	getAcmeProviders,
	triggerAcmeRenew,
	getStorageSslCertificateAsText
} from '$lib/server/dataplane';
import { readPemFromCertDirWithFallbacks } from '$lib/server/haproxy-certs-dir';
import { dumpSslCertViaDockerExec } from '$lib/server/haproxy-docker-exec';
import { dumpSslCertViaSocket } from '$lib/server/haproxy-socket';
import { parseLeafCertInfo } from '$lib/server/parse-cert';

const DEFAULT_CRT_BASE = '/usr/local/etc/haproxy/ssl';

/** Prüft, ob die Domain zu einer SAN-String (z. B. "DNS:example.com, DNS:*.example.com") passt. */
export function domainMatchesSan(domain: string, sanString: string | null | undefined): boolean {
	if (!domain || !sanString || typeof sanString !== 'string') return false;
	const d = domain.toLowerCase().trim();
	const parts = sanString.split(',').map((s) => s.trim());
	for (const part of parts) {
		const m = part.match(/^DNS:\s*(.+)$/i);
		if (!m) continue;
		const name = m[1].toLowerCase().trim();
		if (d === name) return true;
		if (name.startsWith('*.')) {
			const suffix = name.slice(1);
			if (d === suffix || (d.endsWith(suffix) && d.length > suffix.length)) return true;
		}
	}
	return false;
}

/** Prüft, ob die Domain in der Liste (z. B. aus CrtLoad.domains) vorkommt. */
export function domainMatchesDomainsList(
	domain: string,
	domains: string[] | null | undefined
): boolean {
	if (!domain || !Array.isArray(domains)) return false;
	const d = domain.toLowerCase().trim();
	for (const x of domains) {
		const name = String(x).toLowerCase().trim();
		if (d === name) return true;
		if (name.startsWith('*.')) {
			const suffix = name.slice(1);
			if (d === suffix || (d.endsWith(suffix) && d.length > suffix.length)) return true;
		}
	}
	return false;
}

async function getPemForCert(name: string): Promise<string | null> {
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
	if (!pem) {
		try {
			pem = await getStorageSslCertificateAsText(name);
		} catch {
			if (name.startsWith('@') && name.includes('/')) {
				const filePart = name.slice(name.indexOf('/') + 1);
				if (filePart) pem = await getStorageSslCertificateAsText(filePart);
			}
		}
	}
	return pem;
}

type CrtLoadItem = {
	certificate?: string;
	acme?: string;
	domains?: string[];
};

/**
 * Findet ein Zertifikat im Store, das die Domain abdeckt (CrtLoad.domains oder SAN aus PEM).
 * Gibt den vollen Dateipfad (crt_base/certificate) zurück oder null.
 */
export async function findCertPathForDomainInStore(
	storeName: string,
	domain: string
): Promise<string | null> {
	const store = (await getCrtStore(storeName).catch(() => null)) as {
		crt_base?: string;
	} | null;
	const base = ((store?.crt_base ?? DEFAULT_CRT_BASE) as string).replace(/\/$/, '');

	const loadsRaw = await getCrtLoads(storeName);
	const loadsArr = Array.isArray(loadsRaw)
		? loadsRaw
		: (loadsRaw as { data?: unknown[] })?.data ?? [];
	const loads = loadsArr as CrtLoadItem[];

	const d = domain.toLowerCase().trim();

	for (const load of loads) {
		const certName = load?.certificate;
		if (!certName || typeof certName !== 'string') continue;

		if (domainMatchesDomainsList(d, load.domains)) {
			return `${base}/${certName}`;
		}

		const fullName = load.acme ? `@${storeName}/${certName}` : certName;
		const pem = await getPemForCert(fullName);
		if (pem) {
			const info = parseLeafCertInfo(pem);
			if (info?.subjectAltName && domainMatchesSan(d, info.subjectAltName)) {
				return `${base}/${certName}`;
			}
			const cn = info?.subject?.trim();
			if (cn) {
				const cnNorm = cn.toLowerCase();
				if (d === cnNorm) return `${base}/${certName}`;
				if (cnNorm.startsWith('*.')) {
					const suffix = cnNorm.slice(1);
					if (d === suffix || (d.endsWith(suffix) && d.length > suffix.length)) {
						return `${base}/${certName}`;
					}
				}
			}
		}
	}
	return null;
}

/** Ersetzt Zeichen, die in Dateinamen problematisch sind. */
function safeCertSegment(s: string): string {
	return s.toLowerCase().trim().replace(/[^a-z0-9.-]/g, '-').replace(/-+/g, '-');
}

/** Lesbaren Dateinamen für ein ACME-Zertifikat aus Domain(s) erzeugen (z. B. example.com.pem oder example.com_san2.pem). */
function certFileNameForDomain(domain: string): string {
	const s = safeCertSegment(domain);
	return s ? `${s}.pem` : 'cert.pem';
}

/** Mehrere Domains: erste Domain als Basis, dann _san + Anzahl (z. B. example.com_san2.pem). */
function certFileNameForDomains(domains: string[]): string {
	const first = safeCertSegment(domains[0] ?? '');
	if (!first) return 'cert.pem';
	if (domains.length <= 1) return `${first}.pem`;
	return `${first}_san${domains.length}.pem`;
}

const ACME_WAIT_MS = 60_000;
const ACME_POLL_MS = 2_000;

/**
 * Prüft, ob ein CrtLoad (per Konfiguration oder SAN) alle angegebenen Domains abdeckt.
 */
async function certCoversAllDomains(
	storeName: string,
	load: CrtLoadItem,
	domains: string[]
): Promise<boolean> {
	const certName = load?.certificate;
	if (!certName || typeof certName !== 'string') return false;
	const normalized = domains.map((d) => d.toLowerCase().trim()).filter(Boolean);
	if (normalized.length === 0) return false;

	if (load.domains && Array.isArray(load.domains)) {
		if (normalized.every((d) => domainMatchesDomainsList(d, load.domains))) return true;
	}

	const fullName = load.acme ? `@${storeName}/${certName}` : certName;
	const pem = await getPemForCert(fullName);
	if (!pem) return false;
	const info = parseLeafCertInfo(pem);
	const san = info?.subjectAltName ?? '';
	const cn = info?.subject?.toLowerCase().trim();
	for (const d of normalized) {
		if (domainMatchesSan(d, san)) continue;
		if (cn && (d === cn || (cn.startsWith('*.') && (d === cn.slice(1) || d.endsWith(cn.slice(1))))))
			continue;
		return false;
	}
	return true;
}

/**
 * Sucht ein Zertifikat im Store, das alle angegebenen Domains abdeckt (SAN/ACME-Bundle).
 */
export async function findCertPathForDomainsInStore(
	storeName: string,
	domains: string[]
): Promise<string | null> {
	const store = (await getCrtStore(storeName).catch(() => null)) as { crt_base?: string } | null;
	const base = ((store?.crt_base ?? DEFAULT_CRT_BASE) as string).replace(/\/$/, '');

	const loadsRaw = await getCrtLoads(storeName);
	const loadsArr = Array.isArray(loadsRaw)
		? loadsRaw
		: (loadsRaw as { data?: unknown[] })?.data ?? [];
	const loads = loadsArr as CrtLoadItem[];

	const normalized = domains.map((d) => d.toLowerCase().trim()).filter(Boolean);
	if (normalized.length === 0) return null;

	for (const load of loads) {
		const covered = await certCoversAllDomains(storeName, load, normalized);
		if (covered && load?.certificate) return `${base}/${load.certificate}`;
	}
	return null;
}

/**
 * Stellt sicher, dass im Store ein Zertifikat für die Domain existiert.
 * Wenn ein passendes existiert: gibt dessen Pfad zurück.
 * Wenn keins existiert: legt einen neuen CrtLoad (ACME + domain) an, triggert Renew und wartet
 * bis das Zertifikat verfügbar ist (oder Timeout), dann wird der Pfad zurückgegeben.
 */
export async function resolveCertForDomainInStore(
	storeName: string,
	domain: string
): Promise<string> {
	return resolveCertForDomainsInStore(storeName, [domain]);
}

/**
 * Stellt sicher, dass im Store ein Zertifikat für alle Domains existiert (SAN-Bundle).
 * Sucht ein bestehendes Zertifikat, das alle Domains abdeckt; sonst wird ein neuer CrtLoad
 * mit allen domains angelegt und per ACME angefordert.
 */
export async function resolveCertForDomainsInStore(
	storeName: string,
	domains: string[]
): Promise<string> {
	const normalized = domains.map((d) => d.trim()).filter(Boolean);
	if (normalized.length === 0) {
		throw new Error('Mindestens eine Domain angeben.');
	}

	const existing = await findCertPathForDomainsInStore(storeName, normalized);
	if (existing) return existing;

	const acmeList = await getAcmeProviders();
	const providers = Array.isArray(acmeList) ? acmeList : [];
	const first = providers[0] as { name?: string } | undefined;
	const acmeProvider = first?.name;
	if (!acmeProvider) {
		throw new Error(
			'Kein passendes Zertifikat für die angegebenen Domains im Store. Bitte unter „ACME“ mindestens einen Provider anlegen, damit ein Zertifikat angefordert werden kann.'
		);
	}

	const certFileName = certFileNameForDomains(normalized);
	try {
		await createCrtLoad(storeName, {
			certificate: certFileName,
			acme: acmeProvider,
			domains: normalized
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (!/already exists|duplicate|conflict/i.test(msg)) throw e;
	}

	const certId = `@${storeName}/${certFileName}`;
	await triggerAcmeRenew(certId);

	const store = (await getCrtStore(storeName).catch(() => null)) as { crt_base?: string } | null;
	const base = ((store?.crt_base ?? DEFAULT_CRT_BASE) as string).replace(/\/$/, '');
	const path = `${base}/${certFileName}`;

	const deadline = Date.now() + ACME_WAIT_MS;
	while (Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, ACME_POLL_MS));
		const pem = await getPemForCert(certId);
		if (pem && pem.includes('-----BEGIN CERTIFICATE-----')) {
			return path;
		}
	}

	return path;
}
