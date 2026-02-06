/**
 * HAProxy-Log: entweder via Docker (docker logs) oder aus einer Log-Datei.
 * Env: HAPROXY_CONTAINER_NAME (z. B. haproxy_main) oder HAPROXY_LOG_FILE (Pfad zur Datei).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const DEFAULT_TAIL = 500;
const MAX_TAIL = 2000;

export const GET: RequestHandler = async ({ url }) => {
	const tailParam = url.searchParams.get('tail');
	const tail = Math.min(
		Math.max(1, tailParam != null ? parseInt(tailParam, 10) : DEFAULT_TAIL),
		MAX_TAIL
	);

	const containerName = env.HAPROXY_CONTAINER_NAME;
	const logFilePath = env.HAPROXY_LOG_FILE;

	try {
		if (logFilePath) {
			// Log aus Datei lesen (z. B. gemountetes Volume)
			if (!existsSync(logFilePath)) {
				return json({ error: 'Log-Datei nicht gefunden', lines: [] }, { status: 404 });
			}
			const content = readFileSync(logFilePath, 'utf-8');
			const lines = content.split(/\r?\n/).filter((l) => l.length > 0);
			const lastLines = lines.slice(-tail);
			return json({ lines: lastLines, source: 'file' });
		}

		if (containerName) {
			// Docker-Logs des HAProxy-Containers
			const out = execSync(`docker logs "${containerName}" --tail ${tail} 2>&1`, {
				encoding: 'utf-8',
				timeout: 10_000,
				maxBuffer: 2 * 1024 * 1024
			});
			const lines = (out || '').split(/\r?\n/).filter((l) => l.length > 0);
			return json({ lines, source: 'docker' });
		}

		return json(
			{
				error:
					'Weder HAPROXY_CONTAINER_NAME noch HAPROXY_LOG_FILE gesetzt. In .env z. B. HAPROXY_CONTAINER_NAME=haproxy_main eintragen.',
				lines: []
			},
			{ status: 503 }
		);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return json({ error: message, lines: [] }, { status: 500 });
	}
};
