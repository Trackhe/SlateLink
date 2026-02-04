/**
 * Stats: GET /api/stats (live from HAProxy) and /api/stats/history (SQLite).
 */

import { Elysia } from "elysia";
import { getDatabase } from "../db";
import { fetchAndParseStats, writeStatsSnapshot } from "../lib/stats";
import type { StatsSnapshotRow } from "../db";

export const statsRoutes = new Elysia({ prefix: "/api" })
  .get("/stats", async () => {
    const rows = await fetchAndParseStats();
    return { live: rows };
  })
  .get("/stats/snapshot", async () => {
    const rows = await fetchAndParseStats();
    writeStatsSnapshot(rows);
    return { written: rows.length };
  })
  .get("/stats/history", async ({ query }) => {
    const database = getDatabase();
    const limit = Math.min(
      500,
      Math.max(0, query.limit != null ? parseInt(String(query.limit), 10) : 100)
    );
    const offset = Math.max(
      0,
      query.offset != null ? parseInt(String(query.offset), 10) : 0
    );
    const fromTimestamp = query.from ?? null;
    const toTimestamp = query.to ?? null;

    let whereClause = "";
    const params: (string | number)[] = [];
    if (fromTimestamp) {
      whereClause = "WHERE created_at >= ?";
      params.push(fromTimestamp);
    }
    if (toTimestamp) {
      whereClause = whereClause
        ? whereClause + " AND created_at <= ?"
        : "WHERE created_at <= ?";
      params.push(toTimestamp);
    }
    params.push(limit, offset);

    const rows = database
      .prepare(
        `SELECT * FROM stats_snapshots ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .all(...params) as StatsSnapshotRow[];
    return { entries: rows };
  });
