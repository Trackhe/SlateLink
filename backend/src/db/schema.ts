/**
 * SQLite schema: stats_snapshots (statistics history), audit_log (action log).
 * Column names are full words; no abbreviations (e.g. resource_type not res_type).
 */

export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS stats_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proxy_name TEXT NOT NULL,
    server_name TEXT NOT NULL,
    bytes_in INTEGER NOT NULL DEFAULT 0,
    bytes_out INTEGER NOT NULL DEFAULT 0,
    rate INTEGER NOT NULL DEFAULT 0,
    request_rate INTEGER NOT NULL DEFAULT 0,
    response_4xx INTEGER NOT NULL DEFAULT 0,
    response_5xx INTEGER NOT NULL DEFAULT 0,
    response_time INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_stats_snapshots_created_at ON stats_snapshots(created_at)`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details TEXT,
    source_ip TEXT,
    request_id TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type ON audit_log(resource_type)`,
];

export type StatsSnapshotRow = {
  id: number;
  proxy_name: string;
  server_name: string;
  bytes_in: number;
  bytes_out: number;
  rate: number;
  request_rate: number;
  response_4xx: number;
  response_5xx: number;
  response_time: number | null;
  created_at: string;
};

export type AuditLogRow = {
  id: number;
  timestamp: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: string | null;
  source_ip: string | null;
  request_id: string | null;
};
