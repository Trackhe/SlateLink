/**
 * Server-only: Stats-Snapshots (DPA getStats → SQLite). writeStatsSnapshot, getStatsHistory.
 * Optional: periodischer Timer und Retention.
 */
import { getStats } from '$lib/server/dataplane';
import { getDatabase } from '$lib/server/db/index';
import type { StatsSnapshotRow } from '$lib/server/db/index';
import {
	statsSnapshotIntervalMs,
	statsRetentionDays
} from '$lib/server/config';

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

/** Snapshots löschen, die älter als die angegebene Anzahl Tage sind. */
export function deleteSnapshotsOlderThanDays(days: number): number {
	if (days <= 0) return 0;
	const db = getDatabase();
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - days);
	const iso = cutoff.toISOString();
	const result = db.prepare(
		`DELETE FROM stats_snapshots WHERE created_at < ?`
	).run(iso);
	return result.changes;
}

let timerStarted = false;

/** Startet den periodischen Stats-Snapshot-Timer (einmal pro App-Start). */
export function startStatsSnapshotTimer(): void {
	if (timerStarted) return;
	timerStarted = true;
	if (statsSnapshotIntervalMs <= 0) return;

	const tick = async () => {
		try {
			await writeStatsSnapshot();
			if (statsRetentionDays > 0) {
				deleteSnapshotsOlderThanDays(statsRetentionDays);
			}
		} catch {
			// Fehler loggen, Timer läuft weiter
		}
	};

	setInterval(tick, statsSnapshotIntervalMs);
	// Ersten Snapshot nach kurzer Verzögerung (damit DPA erreichbar ist)
	setTimeout(tick, 5000);
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
