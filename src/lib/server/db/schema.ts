/**
 * SQLite-Schema für SlateLink. Wird bei erster DB-Nutzung angewendet.
 */
export const schemaStatements = [
	`CREATE TABLE IF NOT EXISTS audit_log (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		action TEXT NOT NULL,
		resource_type TEXT,
		resource_id TEXT,
		details TEXT
	)`,
	`CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at)`,
	`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action)`,
	`CREATE TABLE IF NOT EXISTS stats_snapshots (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		payload TEXT NOT NULL
	)`,
	`CREATE INDEX IF NOT EXISTS idx_stats_created_at ON stats_snapshots(created_at)`
];
