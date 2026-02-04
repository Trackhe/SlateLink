/**
 * Stats collector: fetches HAProxy stats (CSV from stats frontend), parses and optionally writes snapshots to SQLite.
 * Single responsibility; no abbreviations in variable names.
 */

import { config } from "../config";
import { getDatabase } from "../db";
import type { StatsSnapshotRow } from "../db";

export interface ParsedStatsRow {
  proxyName: string;
  serverName: string;
  bytesIn: number;
  bytesOut: number;
  rate: number;
  requestRate: number;
  response4xx: number;
  response5xx: number;
  responseTime: number | null;
}

function parseInteger(value: string): number {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Fetches HAProxy stats as CSV from the stats frontend and parses into structured rows.
 * CSV format: first line is header with column names (pxname, svname, bin, bout, rate, req_rate, hrsp_4xx, hrsp_5xx, rtime, ...).
 */
export async function fetchAndParseStats(): Promise<ParsedStatsRow[]> {
  const statsUrl = config.haproxyStatsUrl.replace(/\/$/, "");
  const url = statsUrl.endsWith("/stats")
    ? `${statsUrl};csv`
    : `${statsUrl}${statsUrl.includes("?") ? "&" : "?"}stats;csv`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HAProxy stats fetch failed: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  const lines = text.trim().split("\n").filter((line) => line.length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const columnNames = headerLine.split(",").map((name) => name.trim().replace(/^#\s*/, ""));
  const columnIndex = (name: string): number => {
    const index = columnNames.indexOf(name);
    return index >= 0 ? index : -1;
  };

  const proxyNameIndex = columnIndex("pxname");
  const serverNameIndex = columnIndex("svname");
  const bytesInIndex = columnIndex("bin");
  const bytesOutIndex = columnIndex("bout");
  const rateIndex = columnIndex("rate");
  const requestRateIndex = columnIndex("req_rate");
  const response4xxIndex = columnIndex("hrsp_4xx");
  const response5xxIndex = columnIndex("hrsp_5xx");
  const responseTimeIndex = columnIndex("rtime");

  const rows: ParsedStatsRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const getValue = (index: number): string =>
      index >= 0 && index < values.length ? values[index].trim() : "";
    const proxyName = getValue(proxyNameIndex);
    const serverName = getValue(serverNameIndex);
    if (!proxyName && !serverName) continue;

    rows.push({
      proxyName: proxyName || "",
      serverName: serverName || "",
      bytesIn: parseInteger(getValue(bytesInIndex)),
      bytesOut: parseInteger(getValue(bytesOutIndex)),
      rate: parseInteger(getValue(rateIndex)),
      requestRate: parseInteger(getValue(requestRateIndex)),
      response4xx: parseInteger(getValue(response4xxIndex)),
      response5xx: parseInteger(getValue(response5xxIndex)),
      responseTime:
        responseTimeIndex >= 0 && values[responseTimeIndex]
          ? parseInteger(values[responseTimeIndex].trim()) || null
          : null,
    });
  }
  return rows;
}

/**
 * Writes current parsed stats as a snapshot into stats_snapshots.
 */
export function writeStatsSnapshot(rows: ParsedStatsRow[]): void {
  const database = getDatabase();
  const statement = database.prepare(
    `INSERT INTO stats_snapshots (proxy_name, server_name, bytes_in, bytes_out, rate, request_rate, response_4xx, response_5xx, response_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const row of rows) {
    statement.run(
      row.proxyName,
      row.serverName,
      row.bytesIn,
      row.bytesOut,
      row.rate,
      row.requestRate,
      row.response4xx,
      row.response5xx,
      row.responseTime ?? null
    );
  }
}
