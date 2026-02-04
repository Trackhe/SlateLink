/**
 * Database client and migrations. Uses Bun built-in SQLite.
 * Single module for all DB access to avoid duplicate connection logic.
 */

import { mkdirSync } from "fs";
import { dirname } from "path";
import { Database } from "bun:sqlite";
import { schemaStatements } from "./schema";
import { config } from "../config";

let database: Database | null = null;

/** Only for tests: inject in-memory DB. Call with null to reset. */
export function setDatabaseOverride(override: Database | null): void {
  database = override;
}

function ensureDatabaseDirectory(): void {
  const databasePath = config.databasePath;
  if (databasePath === ":memory:") return;
  const directory = dirname(databasePath);
  if (directory && directory !== databasePath) {
    try {
      mkdirSync(directory, { recursive: true });
    } catch {
      // ignore; sqlite will fail with clear error if path invalid
    }
  }
}

export function getDatabase(): Database {
  if (database !== null) return database;
  ensureDatabaseDirectory();
  database = new Database(config.databasePath);
  runMigrations(database);
  return database;
}

function runMigrations(db: Database): void {
  for (const statement of schemaStatements) {
    db.run(statement);
  }
}

export function closeDatabase(): void {
  if (database !== null) {
    database.close();
    database = null;
  }
}

export type { StatsSnapshotRow, AuditLogRow } from "./schema";
export { schemaStatements } from "./schema";
