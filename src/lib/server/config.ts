/**
 * Server-only: DPA- und App-Konfiguration aus privaten Env-Variablen.
 * Nur aus +server.ts oder $lib/server/* importieren.
 */
import { join } from 'node:path';
import { env } from '$env/dynamic/private';

const baseUrl = (env.DATAPLANE_API_URL ?? 'http://localhost:5555').replace(/\/$/, '');
const user = env.DATAPLANE_API_USER ?? 'admin';
const password = env.DATAPLANE_API_PASSWORD ?? '';

const auth =
	Buffer.from(`${user}:${password}`, 'utf-8').toString('base64');

export const dpaBaseUrl = baseUrl;
export const dpaAuthHeader = `Basic ${auth}`;

/** Pfad zur SQLite-Datenbank (z. B. data/app.db). */
export const databasePath =
	env.DATABASE_PATH ?? 'data/app.db';

/** Intervall für Stats-Snapshots in ms (0 = Timer aus). Default 60_000 (1 min). */
export const statsSnapshotIntervalMs =
	Math.max(0, parseInt(env.STATS_SNAPSHOT_INTERVAL_MS ?? '60000', 10) || 0);

/** Snapshots älter als diese Anzahl Tage löschen (0 = keine Retention). Default 30. */
export const statsRetentionDays =
	Math.max(0, parseInt(env.STATS_RETENTION_DAYS ?? '30', 10) || 0);

/** Intervall für Zertifikat-Sync (Runtime → Storage) in ms (0 = Timer aus). Default 3_600_000 (1 h). */
export const certSyncIntervalMs =
	Math.max(0, parseInt(env.CERT_SYNC_INTERVAL_MS ?? '3600000', 10) || 0);

/**
 * HAProxy Stats/Runtime-Socket (Unix oder TCP).
 * Wenn gesetzt: PEM von geladenen Zertifikaten per "dump ssl cert" abrufbar.
 * z. B. /run/haproxy.stat oder 127.0.0.1:9999
 */
export const haproxyStatsSocket = (env.HAPROXY_STATS_SOCKET ?? '').trim() || null;

/**
 * Pfad zum SSL-Zertifikatsverzeichnis auf dem Host (oder im SlateLink-Container).
 * Nur für bereits auf Disk gespeicherte Zertifikate; DPA hält Certs oft nur im RAM.
 */
export const haproxySslCertsDir = (env.HAPROXY_SSL_CERTS_DIR ?? '').trim() || null;

/** Schreib-Verzeichnis für SSL-Dateien (domain_mapping.txt, default.pem): HAPROXY_SSL_CERTS_DIR oder haproxy/ssl. */
export function getSslCertsWriteDir(): string {
	if (haproxySslCertsDir) return haproxySslCertsDir;
	try {
		return join(process.cwd(), 'haproxy', 'ssl');
	} catch {
		return '';
	}
}

/**
 * HAProxy-Container-Name für docker exec (z. B. haproxy_main).
 * Wenn gesetzt: PEM per "dump ssl cert" im Container abrufbar – SlateLink auf Host
 * oder in Container mit Docker-Zugriff, ohne Stats-Socket zu mounten/exponieren.
 */
export const haproxyContainerName = (env.HAPROXY_CONTAINER_NAME ?? '').trim() || null;

/** Pfad zum Stats-Socket im HAProxy-Container (für docker exec). Default wie typisch in DPA-Setups. */
export const haproxyStatsSocketInContainer =
	(env.HAPROXY_STATS_SOCKET_IN_CONTAINER ?? '').trim() || '/run/haproxy.stat';
