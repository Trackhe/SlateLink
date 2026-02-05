/**
 * Server-only: Audit-Log (SQLite). logAction schreibt, getAuditLog liest mit Filter.
 */
import { getDatabase } from '$lib/server/db/index';
import type { AuditLogRow } from '$lib/server/db/index';

export type AuditEntry = {
	action: string;
	resource_type?: string | null;
	resource_id?: string | null;
	details?: string | null;
};

export type AuditLogOptions = {
	from?: string;
	to?: string;
	action?: string;
	resource_type?: string;
	limit?: number;
	offset?: number;
};

export function logAction(entry: AuditEntry): { id: number } {
	const db = getDatabase();
	const stmt = db.prepare(
		`INSERT INTO audit_log (action, resource_type, resource_id, details)
     VALUES (?, ?, ?, ?)`
	);
	const result = stmt.run(
		entry.action,
		entry.resource_type ?? null,
		entry.resource_id ?? null,
		entry.details ?? null
	);
	return { id: result.lastInsertRowid as number };
}

export function getAuditLog(options: AuditLogOptions = {}): AuditLogRow[] {
	const db = getDatabase();
	const conditions: string[] = [];
	const params: (string | number)[] = [];

	if (options.from) {
		conditions.push('created_at >= ?');
		params.push(options.from);
	}
	if (options.to) {
		conditions.push('created_at <= ?');
		params.push(options.to);
	}
	if (options.action) {
		conditions.push('action = ?');
		params.push(options.action);
	}
	if (options.resource_type) {
		conditions.push('resource_type = ?');
		params.push(options.resource_type);
	}

	const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
	const limit = Math.min(options.limit ?? 50, 500);
	const offset = options.offset ?? 0;

	const stmt = db.prepare(
		`SELECT id, created_at, action, resource_type, resource_id, details
     FROM audit_log ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
	);
	return stmt.all(...params, limit, offset) as AuditLogRow[];
}
