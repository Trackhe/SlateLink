/**
 * Audit logger: writes every mutating action to SQLite audit_log.
 * Single function logAction(); no business logic here.
 */

import { getDatabase } from "../db";
import type { AuditLogRow } from "../db";

export type AuditAction =
  | "frontend.create"
  | "frontend.update"
  | "frontend.delete"
  | "backend.create"
  | "backend.update"
  | "backend.delete"
  | "server.create"
  | "server.update"
  | "server.delete"
  | "certificate.upload"
  | "certificate.replace"
  | "certificate.delete"
  | "configuration.reload"
  | "error";

export type AuditResourceType =
  | "frontend"
  | "backend"
  | "server"
  | "certificate"
  | "configuration";

export interface AuditEntryInput {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  details?: string | null;
  sourceIp?: string | null;
  requestId?: string | null;
}

export function logAction(entry: AuditEntryInput): AuditLogRow | null {
  const database = getDatabase();
  const statement = database.prepare(
    `INSERT INTO audit_log (action, resource_type, resource_id, details, source_ip, request_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  statement.run(
    entry.action,
    entry.resourceType,
    entry.resourceId ?? null,
    entry.details ?? null,
    entry.sourceIp ?? null,
    entry.requestId ?? null
  );
  const row = database
    .prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 1")
    .get() as AuditLogRow | undefined;
  return row ?? null;
}

export function getAuditLog(options: {
  fromTimestamp?: string | null;
  toTimestamp?: string | null;
  action?: string | null;
  resourceType?: string | null;
  limit?: number;
  offset?: number;
}): AuditLogRow[] {
  const database = getDatabase();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.fromTimestamp) {
    conditions.push("timestamp >= ?");
    params.push(options.fromTimestamp);
  }
  if (options.toTimestamp) {
    conditions.push("timestamp <= ?");
    params.push(options.toTimestamp);
  }
  if (options.action) {
    conditions.push("action = ?");
    params.push(options.action);
  }
  if (options.resourceType) {
    conditions.push("resource_type = ?");
    params.push(options.resourceType);
  }

  const whereClause =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  const limit = Math.min(Math.max(0, options.limit ?? 100), 500);
  const offset = Math.max(0, options.offset ?? 0);
  params.push(limit, offset);

  const query = `SELECT * FROM audit_log ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
  const statement = database.prepare(query);
  const rows = statement.all(...params) as AuditLogRow[];
  return rows;
}
