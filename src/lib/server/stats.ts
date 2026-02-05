/**
 * Server-only: Stats-Snapshots (DPA getStats → SQLite). writeStatsSnapshot, getStatsHistory.
 */
import { getStats } from '$lib/server/dataplane';
import { getDatabase } from '$lib/server/db/index';
import type { StatsSnapshotRow } from '$lib/server/db/index';

/** Aktuelle Stats von der DPA holen und als Snapshot in die DB schreiben. */
export async function writeStatsSnapshot(): Promise<{ id: number }> {
	const data = await getStats();
	const payload = JSON.stringify(data);
	const db = getDatabase();
	const stmt = db.prepare(
		`INSERT INTO stats_snapshots (payload) VALUES (?)`
	);
	const result = stmt.run(payload);
	return { id: result.lastInsertRowid as number };
}

export type StatsHistoryOptions = {
	from?: string;
	to?: string;
	limit?: number;
	offset?: number;
};

/** Snapshots aus der DB lesen (from, to, limit, offset). */
export function getStatsHistory(
	options: StatsHistoryOptions = {}
): StatsSnapshotRow[] {
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

	const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
	const limit = Math.min(options.limit ?? 50, 500);
	const offset = options.offset ?? 0;

	const stmt = db.prepare(
		`SELECT id, created_at, payload FROM stats_snapshots ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`
	);
	return stmt.all(...params, limit, offset) as StatsSnapshotRow[];
}
