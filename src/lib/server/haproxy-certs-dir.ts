/**
 * Server-only: PEM aus dem gemounteten ssl_certs_dir lesen (ohne Stats-Socket).
 * Nutzbar wenn HAPROXY_SSL_CERTS_DIR auf dasselbe Verzeichnis zeigt wie im HAProxy-Container
 * (z. B. Bind-Mount: Host /host/ssl = Container ssl_certs_dir).
 */
import { readFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { haproxySslCertsDir } from '$lib/server/config';

/**
 * Liest PEM aus HAPROXY_SSL_CERTS_DIR, falls gesetzt.
 * name z. B. @customdocker/asd.pem oder asd.pem (kein .., kein absoluter Pfad).
 */
export async function readPemFromCertDir(name: string): Promise<string | null> {
	const baseDir = haproxySslCertsDir;
	if (!baseDir || !name) return null;

	// Nur relative Teile erlauben (kein .., kein absoluter Pfad)
	const normalized = name.replace(/\\/g, '/').trim();
	if (normalized.startsWith('/') || normalized.includes('..')) return null;

	const fullPath = resolve(join(baseDir, normalized));
	const baseResolved = resolve(baseDir);
	if (!fullPath.startsWith(baseResolved)) return null;

	try {
		const content = await readFile(fullPath, 'utf8');
		if (content.trimStart().startsWith('-----BEGIN')) return content.trim();
		return null;
	} catch {
		return null;
	}
}

/**
 * Probiert verschiedene Dateinamen (z. B. @store/file.pem und file.pem).
 */
export async function readPemFromCertDirWithFallbacks(name: string): Promise<string | null> {
	let pem = await readPemFromCertDir(name);
	if (pem) return pem;
	if (name.startsWith('@') && name.includes('/')) {
		const filePart = name.slice(name.indexOf('/') + 1);
		if (filePart) pem = await readPemFromCertDir(filePart);
	}
	return pem;
}

/**
 * Löscht eine Zertifikatsdatei aus HAPROXY_SSL_CERTS_DIR, falls gesetzt.
 * certificate = reiner Dateiname (z. B. example.com.pem), keine Pfade, kein ..
 * Gibt true zurück wenn gelöscht, false wenn nicht vorhanden oder nicht erlaubt.
 */
export async function deleteCertFileFromSslDir(certificate: string): Promise<boolean> {
	const baseDir = haproxySslCertsDir;
	if (!baseDir || !certificate) return false;

	const name = certificate.replace(/\\/g, '/').trim();
	if (name.startsWith('/') || name.includes('..') || name.includes('/')) return false;

	const fullPath = resolve(join(baseDir, name));
	const baseResolved = resolve(baseDir);
	if (!fullPath.startsWith(baseResolved)) return false;

	try {
		await unlink(fullPath);
		return true;
	} catch (err: unknown) {
		if (err && typeof err === 'object' && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
			return false;
		}
		throw err;
	}
}
