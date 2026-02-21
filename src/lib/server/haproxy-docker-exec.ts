/**
 * Server-only: PEM per "docker exec" aus dem HAProxy-Container (dump ssl cert).
 * Nutzbar wenn SlateLink auf dem Host oder in einem Container mit Docker-Zugriff läuft –
 * ohne Stats-Socket zu mounten oder per TCP zu exponieren.
 * Siehe: https://www.haproxy.com/documentation/haproxy-runtime-api/reference/dump-ssl-cert/
 */
import { spawn } from 'node:child_process';
import { haproxyContainerName, haproxyStatsSocketInContainer } from '$lib/server/config';

const DOCKER_EXEC_TIMEOUT_MS = 10_000;
const MAX_BUFFER = 2 * 1024 * 1024;

/** Extrahiert PEM-Blöcke aus der Ausgabe. */
function extractPem(raw: string): string | null {
	const pemRegex =
		/-----BEGIN\s+[^\n]+-----\r?\n[\s\S]*?-----END\s+[^\n]+-----/gi;
	const blocks = raw.match(pemRegex);
	if (!blocks || blocks.length === 0) return null;
	return blocks.join('\n').trim() || null;
}

/**
 * Führt im HAProxy-Container "dump ssl cert <name>" aus und liefert die PEM-Ausgabe.
 * Cert-Name wird per Base64 übergeben, um Sonderzeichen sicher zu handhaben.
 */
export async function dumpSslCertViaDockerExec(name: string): Promise<string | null> {
	const container = haproxyContainerName;
	if (!container || !name) return null;

	const certB64 = Buffer.from(name, 'utf8').toString('base64');
	const socketPath = haproxyStatsSocketInContainer;
	// Im Container: CERT_B64 decodieren und an dump ssl cert übergeben
	const innerCmd = `echo "dump ssl cert $(echo "$CERT_B64" | base64 -d)" | socat stdio "${socketPath}"`;

	return new Promise((resolve) => {
		const proc = spawn(
			'docker',
			['exec', '-e', `CERT_B64=${certB64}`, container, 'sh', '-c', innerCmd],
			{
				stdio: ['ignore', 'pipe', 'pipe'],
				shell: false
			}
		);

		let stdout = '';
		let stderr = '';
		let totalLength = 0;

		proc.stdout?.on('data', (chunk: Buffer) => {
			const s = chunk.toString('utf8');
			totalLength += s.length;
			if (totalLength <= MAX_BUFFER) stdout += s;
		});
		proc.stderr?.on('data', (chunk: Buffer) => {
			stderr += chunk.toString('utf8');
		});

		const timer = setTimeout(() => {
			proc.kill('SIGKILL');
			resolve(extractPem(stdout) || null);
		}, DOCKER_EXEC_TIMEOUT_MS);

		proc.on('close', (code) => {
			clearTimeout(timer);
			resolve(extractPem(stdout) || null);
		});
		proc.on('error', () => {
			clearTimeout(timer);
			resolve(null);
		});
	});
}
