/**
 * Server-only: DPA- und App-Konfiguration aus privaten Env-Variablen.
 * Nur aus +server.ts oder $lib/server/* importieren.
 */
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
