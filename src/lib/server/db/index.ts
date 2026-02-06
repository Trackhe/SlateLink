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
