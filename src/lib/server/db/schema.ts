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
	`CREATE INDEX IF NOT EXISTS idx_stats_created_at ON stats_snapshots(created_at)`,
	`CREATE TABLE IF NOT EXISTS frontend_options (
		frontend_name TEXT PRIMARY KEY,
		options_json TEXT NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS frontend_rules (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		frontend_name TEXT NOT NULL,
		domains_json TEXT NOT NULL,
		backend_name TEXT NOT NULL,
		cert_ref_json TEXT,
		redirect_http_to_https INTEGER NOT NULL DEFAULT 0,
		sort_order INTEGER NOT NULL DEFAULT 0
	)`,
	`CREATE INDEX IF NOT EXISTS idx_frontend_rules_frontend ON frontend_rules(frontend_name)`,
	`CREATE TABLE IF NOT EXISTS config (
		key TEXT PRIMARY KEY,
		value TEXT
	)`
];
