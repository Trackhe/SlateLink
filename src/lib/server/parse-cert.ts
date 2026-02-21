/**
 * Parst das erste (Leaf-)Zertifikat aus einem PEM-String und liefert alle lesbaren Felder.
 * Keine Entschlüsselung – nur Auslesen der öffentlichen X.509-Daten.
 */
import { X509Certificate } from 'node:crypto';

export type LeafCertInfo = {
	subject: string;
	issuer: string;
	serialNumber: string;
	notBefore: string;
	notAfter: string;
	fingerprintSha1: string;
	fingerprint256: string;
	keyType: string | null;
	keyInfo: string | null;
	signatureAlgorithm: string | null;
	subjectAltName: string | null;
};

const BEGIN = '-----BEGIN CERTIFICATE-----';
const END = '-----END CERTIFICATE-----';

/** Ersten CERTIFICATE-Block aus PEM extrahieren (Leaf bei Ketten). */
function extractFirstCertPem(pem: string): string | null {
	const idxBegin = pem.indexOf(BEGIN);
	if (idxBegin === -1) return null;
	const idxEnd = pem.indexOf(END, idxBegin);
	if (idxEnd === -1) return null;
	return pem.slice(idxBegin, idxEnd + END.length);
}

/** Alle CERTIFICATE-Blöcke aus PEM extrahieren (Reihenfolge: Leaf, Intermediate, Root). */
function extractAllCertPems(pem: string): string[] {
	const out: string[] = [];
	let pos = 0;
	while (true) {
		const idxBegin = pem.indexOf(BEGIN, pos);
		if (idxBegin === -1) break;
		const idxEnd = pem.indexOf(END, idxBegin);
		if (idxEnd === -1) break;
		out.push(pem.slice(idxBegin, idxEnd + END.length));
		pos = idxEnd + END.length;
	}
	return out;
}

function parseOneCert(singlePem: string): LeafCertInfo | null {
	try {
		const x = new X509Certificate(singlePem);
		let keyType: string | null = null;
		let keyInfo: string | null = null;
		try {
			const pk = x.publicKey;
			const type = (pk as { asymmetricKeyType?: string }).asymmetricKeyType ?? null;
			keyType = type ? String(type).toUpperCase() : null;
			if (type === 'rsa') {
				const size = (pk as { asymmetricKeySize?: number }).asymmetricKeySize;
				keyInfo = size != null ? `${size} Bit` : 'RSA';
			} else if (type === 'ec') {
				const jwk = (pk as { export?: (opts: { format: string }) => unknown }).export?.({ format: 'jwk' }) as { crv?: string } | undefined;
				keyInfo = jwk?.crv ?? 'EC';
			}
		} catch {
			// optional
		}
		return {
			subject: x.subject,
			issuer: x.issuer,
			serialNumber: x.serialNumber,
			notBefore: x.validFrom,
			notAfter: x.validTo,
			fingerprintSha1: x.fingerprint,
			fingerprint256: x.fingerprint256,
			keyType,
			keyInfo,
			signatureAlgorithm: x.signatureAlgorithm ?? null,
			subjectAltName: x.subjectAltName ?? null
		};
	} catch {
		return null;
	}
}

export function parseLeafCertInfo(pem: string): LeafCertInfo | null {
	const singlePem = extractFirstCertPem(pem);
	return singlePem ? parseOneCert(singlePem) : null;
}

/** Alle Zertifikate aus dem PEM parsen (Leaf, dann i. d. R. Intermediate, dann Root). */
export function parseAllCertsFromPem(pem: string): LeafCertInfo[] {
	const pems = extractAllCertPems(pem);
	const result: LeafCertInfo[] = [];
	for (const singlePem of pems) {
		const info = parseOneCert(singlePem);
		if (info) result.push(info);
	}
	return result;
}
