import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "./index";
import type { AuditLogRow, StatsSnapshotRow } from "./index";

vi.mock("$env/dynamic/private", () => ({
  env: { ...process.env, DATABASE_PATH: ":memory:" },
}));

beforeEach(() => {
  process.env.DATABASE_PATH = ":memory:";
});
afterEach(() => {
  closeDatabase();
});

describe("db", () => {
  it("creates schema and returns database", () => {
    const db = getDatabase();
    expect(db).toBeDefined();
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toContain("audit_log");
    expect(tables.map((t) => t.name)).toContain("stats_snapshots");
  });

  it("inserts and selects from audit_log", () => {
    const db = getDatabase();
    db.prepare(
      "INSERT INTO audit_log (action, resource_type) VALUES (?, ?)"
    ).run("test_action", "test_type");
    const row = db.prepare("SELECT * FROM audit_log LIMIT 1").get() as AuditLogRow;
    expect(row.action).toBe("test_action");
    expect(row.resource_type).toBe("test_type");
  });

  it("inserts and selects from stats_snapshots", () => {
    const db = getDatabase();
    db.prepare("INSERT INTO stats_snapshots (payload) VALUES (?)").run(
      '{"foo":1}'
    );
    const row = db
      .prepare("SELECT * FROM stats_snapshots LIMIT 1")
      .get() as StatsSnapshotRow;
    expect(row.payload).toBe('{"foo":1}');
  });
});
