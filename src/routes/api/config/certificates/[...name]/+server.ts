import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getStorageSslCertificateAsText,
	getRuntimeSslCert,
	createStorageSslCertificateFromPem,
	replaceStorageSslCertificate
} from '$lib/server/dataplane';
import { dumpSslCertViaSocket } from '$lib/server/haproxy-socket';
import { readPemFromCertDirWithFallbacks } from '$lib/server/haproxy-certs-dir';
import { dumpSslCertViaDockerExec } from '$lib/server/haproxy-docker-exec';
import { parseLeafCertInfo, parseAllCertsFromPem, type LeafCertInfo } from '$lib/server/parse-cert';

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

/**
 * GET /api/config/certificates/[@store/]name
 * Versucht, PEM-Inhalt zu liefern (ohne Socket-Mount):
 * - HAPROXY_SSL_CERTS_DIR: PEM von Disk (nur wenn Cert schon auf Disk)
 * - HAPROXY_CONTAINER_NAME: docker exec "dump ssl cert" im Container (Certs im RAM)
 * - HAPROXY_STATS_SOCKET: direkter Socket (dump ssl cert)
 * - DPA Storage als Text (falls DPA PEM zurückgibt)
 */
export const GET: RequestHandler = async ({ params }) => {
	const raw = Array.isArray(params.name) ? params.name : [params.name ?? ''];
	const name = raw.map((s) => decodeURIComponent(s)).join('/');
	if (!name) {
		return json({ error: 'Name fehlt' }, { status: 400 });
	}
	try {
		let pem: string | null = null;

		// 1) Certs-Dir: PEM von Disk (nur gespeicherte Certs)
		pem = await readPemFromCertDirWithFallbacks(name);

		// 2) Docker exec: "dump ssl cert" im HAProxy-Container – funktioniert auch für Certs nur im RAM
		if (!pem) {
			pem = await dumpSslCertViaDockerExec(name);
			if (!pem && name.startsWith('@') && name.includes('/')) {
				const filePart = name.slice(name.indexOf('/') + 1);
				if (filePart) pem = await dumpSslCertViaDockerExec(filePart);
			}
		}

		// 3) Stats-Socket (falls gesetzt, z. B. TCP-Port vom Container)
		if (!pem) {
			pem = await dumpSslCertViaSocket(name);
			if (!pem && name.startsWith('@') && name.includes('/')) {
				const filePart = name.slice(name.indexOf('/') + 1);
				if (filePart) pem = await dumpSslCertViaSocket(filePart);
			}
		}

		// 4) Storage: Fallback, falls DPA PEM als Rohtext zurückgibt
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

		// 5) Runtime: Einzelzertifikat für erweiterte Metadaten (serial, fingerprints, not_before, …)
		let runtime: unknown = null;
		try {
			runtime = await getRuntimeSslCert(name);
		} catch {
			// z. B. 404 wenn nur im Storage oder noch nicht geladen
		}

		// 6) Alle Zertifikate aus PEM parsen (Leaf + Intermediate + Root)
		let leaf: LeafCertInfo | null = null;
		let chain: LeafCertInfo[] = [];
		if (pem) {
			chain = parseAllCertsFromPem(pem);
			leaf = chain[0] ?? parseLeafCertInfo(pem);
		}

		return json({
			pem: pem ?? undefined,
			runtime: runtime ?? undefined,
			leaf: leaf ?? undefined,
			chain: chain.length > 0 ? chain : undefined
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};

/**
 * POST /api/config/certificates/[@store/]name
 * Speichert dieses Zertifikat im DPA-Storage (ssl_certs_dir).
 * PEM wird wie bei GET geholt; wenn das Cert schon auf Disk ist → PUT (ersetzen, z. B. nach Renewal), sonst POST (neu).
 */
export const POST: RequestHandler = async ({ params }) => {
	const raw = Array.isArray(params.name) ? params.name : [params.name ?? ''];
	const name = raw.map((s) => decodeURIComponent(s)).join('/');
	if (!name) {
		return json({ error: 'Name fehlt' }, { status: 400 });
	}
	try {
		const pem = await getPemForName(name);
		if (!pem) {
			return json({ error: 'PEM konnte nicht geladen werden (Socket/Docker/Certs-Dir prüfen).' }, { status: 502 });
		}
		try {
			await replaceStorageSslCertificate(name, pem);
		} catch (replaceErr) {
			const msg = replaceErr instanceof Error ? replaceErr.message : String(replaceErr);
			if (msg.includes('404')) {
				await createStorageSslCertificateFromPem(name, pem);
			} else {
				throw replaceErr;
			}
		}
		return json({ ok: true });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message }, { status: 502 });
	}
};
