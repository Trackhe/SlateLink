/**
 * Server-only: HAProxy Stats/Runtime-Socket für "dump ssl cert".
 * Liefert PEM von aktuell geladenen Zertifikaten (inkl. nur im RAM liegende).
 * Siehe: https://www.haproxy.com/documentation/haproxy-runtime-api/reference/dump-ssl-cert/
 */
import * as net from 'node:net';
import { haproxyStatsSocket } from '$lib/server/config';

const READ_TIMEOUT_MS = 5000;
const CMD = 'dump ssl cert';

/**
 * Sendet "dump ssl cert <name>" an den HAProxy-Socket und liest die PEM-Antwort.
 * name z. B. @customdocker/asd.pem oder /path/to/cert.pem
 */
export async function dumpSslCertViaSocket(name: string): Promise<string | null> {
	const socketPathOrHost = haproxyStatsSocket;
	if (!socketPathOrHost) return null;

	return new Promise((resolve) => {
		const isUnix = socketPathOrHost.startsWith('/') || !socketPathOrHost.includes(':');
		const socket = isUnix
			? net.createConnection(socketPathOrHost as string)
			: net.createConnection(
					parseInt(socketPathOrHost.split(':')[1] ?? '9999', 10),
					socketPathOrHost.split(':')[0] ?? '127.0.0.1'
				);

		let buffer = '';
		let resolved = false;

		const done = (result: string | null) => {
			if (resolved) return;
			resolved = true;
			socket.destroy();
			clearTimeout(timer);
			resolve(result);
		};

		const timer = setTimeout(() => {
			done(extractPem(buffer) || null);
		}, READ_TIMEOUT_MS);

		socket.on('data', (data: Buffer) => {
			buffer += data.toString('utf8');
			// Wenn wir mindestens ein vollständiges PEM haben, fertig
			if (/-----END\s+(?:RSA\s+)?(?:PRIVATE\s+KEY|CERTIFICATE)-----/i.test(buffer)) {
				done(extractPem(buffer));
			}
		});

		socket.on('error', () => {
			done(null);
		});

		socket.on('close', () => {
			done(extractPem(buffer) || null);
		});

		socket.on('connect', () => {
			socket.write(`${CMD} ${name}\n`);
		});
	});
}

/** Extrahiert PEM-Blöcke aus der Socket-Ausgabe (inkl. evtl. Prompt/Fehlertext). */
function extractPem(raw: string): string | null {
	const pemRegex =
		/-----BEGIN\s+[^\n]+-----\r?\n[\s\S]*?-----END\s+[^\n]+-----/gi;
	const blocks = raw.match(pemRegex);
	if (!blocks || blocks.length === 0) return null;
	return blocks.join('\n').trim() || null;
}
