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
