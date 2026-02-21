/**
 * Server-only: SQLite-Zugriff (better-sqlite3). Nutzt DATABASE_PATH aus config.
 */
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import Database from 'better-sqlite3';
import { databasePath } from '$lib/server/config';
import { schemaStatements } from './schema';

let db: ReturnType<typeof Database> | null = null;

function getDb(): Database.Database {
	if (!db) {
		try {
			mkdirSync(dirname(databasePath), { recursive: true });
		} catch {
			// Verzeichnis existiert evtl. bereits
		}
		db = new Database(databasePath);
		for (const sql of schemaStatements) {
			db.exec(sql);
		}
		// Migration: created_at nachrüsten, falls Tabelle ohne diese Spalte existierte
		const auditInfo = db.prepare("PRAGMA table_info(audit_log)").all() as { name: string }[];
		if (auditInfo.length > 0 && !auditInfo.some((c) => c.name === 'created_at')) {
			db.exec(`ALTER TABLE audit_log ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))`);
			db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at)`);
		}
		const statsInfo = db.prepare("PRAGMA table_info(stats_snapshots)").all() as { name: string }[];
		if (statsInfo.length > 0 && !statsInfo.some((c) => c.name === 'created_at')) {
			db.exec(`ALTER TABLE stats_snapshots ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))`);
			db.exec(`CREATE INDEX IF NOT EXISTS idx_stats_created_at ON stats_snapshots(created_at)`);
		}
	}
	return db;
}

export function getDatabase(): Database.Database {
	return getDb();
}

export function closeDatabase(): void {
	if (db) {
		db.close();
		db = null;
	}
}

export type AuditLogRow = {
	id: number;
	created_at: string;
	action: string;
	resource_type: string | null;
	resource_id: string | null;
	details: string | null;
};

export type StatsSnapshotRow = {
	id: number;
	created_at: string;
	payload: string;
};

export type BindCertRef =
	| { type: 'store'; store: string; cert: string }
	| { type: 'path'; cert: string };

export type FrontendOptions = {
	forwardClientIp?: boolean;
	forwardProto?: boolean;
	websocketSupport?: boolean;
	redirectHttpToHttps?: boolean;
	/** Pro Bind-Name die beim Anlegen angegebenen Domains (nur Anzeige). */
	bindDomains?: Record<string, string[]>;
	/** Pro Bind-Name die Zertifikatsreferenz für domain_mapping.txt (@store/cert oder path). */
	bindCertRef?: Record<string, BindCertRef>;
};

export function getFrontendOptions(frontendName: string): FrontendOptions | null {
	const row = getDb().prepare('SELECT options_json FROM frontend_options WHERE frontend_name = ?').get(frontendName) as { options_json: string } | undefined;
	if (!row) return null;
	try {
		return JSON.parse(row.options_json) as FrontendOptions;
	} catch {
		return null;
	}
}

export function setFrontendOptions(frontendName: string, options: FrontendOptions): void {
	getDb()
		.prepare('INSERT INTO frontend_options (frontend_name, options_json) VALUES (?, ?) ON CONFLICT(frontend_name) DO UPDATE SET options_json = excluded.options_json')
		.run(frontendName, JSON.stringify(options));
}

/** Setzt die gespeicherten Domains für einen Bind (Anzeige in der UI). */
export function setBindDomains(frontendName: string, bindName: string, domains: string[]): void {
	const current = getFrontendOptions(frontendName) ?? {};
	const bindDomains = { ...(current.bindDomains ?? {}), [bindName]: domains };
	setFrontendOptions(frontendName, { ...current, bindDomains });
}

/** Entfernt die gespeicherten Domains für einen Bind. */
export function removeBindDomains(frontendName: string, bindName: string): void {
	const current = getFrontendOptions(frontendName) ?? {};
	const bindDomains = { ...(current.bindDomains ?? {}) };
	delete bindDomains[bindName];
	setFrontendOptions(frontendName, { ...current, bindDomains });
}

/** Setzt die Zertifikatsreferenz für einen Bind (für domain_mapping.txt). */
export function setBindCertRef(
	frontendName: string,
	bindName: string,
	ref: BindCertRef
): void {
	const current = getFrontendOptions(frontendName) ?? {};
	const bindCertRef = { ...(current.bindCertRef ?? {}), [bindName]: ref };
	setFrontendOptions(frontendName, { ...current, bindCertRef });
}

/** Entfernt die Zertifikatsreferenz für einen Bind. */
export function removeBindCertRef(frontendName: string, bindName: string): void {
	const current = getFrontendOptions(frontendName) ?? {};
	const bindCertRef = { ...(current.bindCertRef ?? {}) };
	delete bindCertRef[bindName];
	setFrontendOptions(frontendName, { ...current, bindCertRef });
}

// --- Frontend-Regeln (Domain → Backend, Zertifikat, Redirect) ---

type FrontendRuleDbRow = {
	id: number;
	frontend_name: string;
	domains_json: string;
	backend_name: string;
	cert_ref_json: string | null;
	redirect_http_to_https: number;
	sort_order: number;
};

export type FrontendRuleRow = {
	id: number;
	frontend_name: string;
	domains: string[];
	backend_name: string;
	cert_ref: BindCertRef | null;
	redirect_http_to_https: boolean;
	sort_order: number;
};

function parseRuleRow(row: FrontendRuleDbRow): FrontendRuleRow {
	let domains: string[] = [];
	try {
		domains = JSON.parse(row.domains_json || '[]');
	} catch {
		// ignore
	}
	let cert_ref: BindCertRef | null = null;
	if (row.cert_ref_json) {
		try {
			cert_ref = JSON.parse(row.cert_ref_json) as BindCertRef;
		} catch {
			// ignore
		}
	}
	return {
		id: row.id,
		frontend_name: row.frontend_name,
		domains,
		backend_name: row.backend_name,
		cert_ref,
		redirect_http_to_https: row.redirect_http_to_https !== 0,
		sort_order: row.sort_order
	};
}

export function getAllFrontendRules(): FrontendRuleRow[] {
	const rows = getDb()
		.prepare(
			'SELECT id, frontend_name, domains_json, backend_name, cert_ref_json, redirect_http_to_https, sort_order FROM frontend_rules ORDER BY frontend_name, sort_order, id'
		)
		.all() as FrontendRuleDbRow[];
	return rows.map((r) => parseRuleRow(r));
}

export function getFrontendRules(frontendName: string): FrontendRuleRow[] {
	const rows = getDb()
		.prepare(
			'SELECT id, frontend_name, domains_json, backend_name, cert_ref_json, redirect_http_to_https, sort_order FROM frontend_rules WHERE frontend_name = ? ORDER BY sort_order, id'
		)
		.all(frontendName) as FrontendRuleDbRow[];
	return rows.map((r) => parseRuleRow(r));
}

export function getFrontendRuleById(id: number): FrontendRuleRow | null {
	const row = getDb()
		.prepare(
			'SELECT id, frontend_name, domains_json, backend_name, cert_ref_json, redirect_http_to_https, sort_order FROM frontend_rules WHERE id = ?'
		)
		.get(id) as FrontendRuleDbRow | undefined;
	return row ? parseRuleRow(row) : null;
}

export function createFrontendRule(rule: Omit<FrontendRuleRow, 'id'>): number {
	const maxOrder = getDb()
		.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM frontend_rules WHERE frontend_name = ?')
		.get(rule.frontend_name) as { m: number } | undefined;
	const sort_order = (maxOrder?.m ?? 0) + 1;
	const result = getDb()
		.prepare(
			'INSERT INTO frontend_rules (frontend_name, domains_json, backend_name, cert_ref_json, redirect_http_to_https, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
		)
		.run(
			rule.frontend_name,
			JSON.stringify(rule.domains),
			rule.backend_name,
			rule.cert_ref ? JSON.stringify(rule.cert_ref) : null,
			rule.redirect_http_to_https ? 1 : 0,
			sort_order
		);
	return result.lastInsertRowid as number;
}

export function updateFrontendRule(
	id: number,
	rule: { domains: string[]; backend_name: string; cert_ref: BindCertRef | null; redirect_http_to_https: boolean }
): void {
	getDb()
		.prepare(
			'UPDATE frontend_rules SET domains_json = ?, backend_name = ?, cert_ref_json = ?, redirect_http_to_https = ? WHERE id = ?'
		)
		.run(
			JSON.stringify(rule.domains),
			rule.backend_name,
			rule.cert_ref ? JSON.stringify(rule.cert_ref) : null,
			rule.redirect_http_to_https ? 1 : 0,
			id
		);
}

export function deleteFrontendRule(id: number): void {
	getDb().prepare('DELETE FROM frontend_rules WHERE id = ?').run(id);
}

// --- Config (Key-Value für z. B. Default-Zertifikat für crt_list) ---

export const CONFIG_KEY_DEFAULT_SSL_CRT_LIST = 'default_ssl_cert_crt_list';

export function getConfig(key: string): string | null {
	const row = getDb().prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string | null } | undefined;
	return row?.value ?? null;
}

export function setConfig(key: string, value: string | null): void {
	if (value === null || value === '') {
		getDb().prepare('DELETE FROM config WHERE key = ?').run(key);
		return;
	}
	getDb()
		.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
		.run(key, value);
}

