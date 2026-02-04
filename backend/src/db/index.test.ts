/**
 * Tests for database client and schema. Uses in-memory SQLite.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { schemaStatements } from "./schema";

describe("db/schema", () => {
  let database: Database;

  beforeEach(() => {
    database = new Database(":memory:");
    for (const statement of schemaStatements) {
      database.run(statement);
    }
  });

  test("creates audit_log table and allows insert/select", () => {
    database
      .prepare(
        `INSERT INTO audit_log (action, resource_type, resource_id, details)
         VALUES (?, ?, ?, ?)`
      )
      .run("frontend.create", "frontend", "fe_main", '{"name":"fe_main"}');
    const row = database
      .prepare("SELECT * FROM audit_log WHERE action = ?")
      .get("frontend.create") as {
      id: number;
      action: string;
      resource_type: string;
      resource_id: string | null;
      details: string | null;
    };
    expect(row).toBeDefined();
    expect(row.action).toBe("frontend.create");
    expect(row.resource_type).toBe("frontend");
    expect(row.resource_id).toBe("fe_main");
    expect(row.details).toContain("fe_main");
  });

  test("creates stats_snapshots table and allows insert/select", () => {
    database
      .prepare(
        `INSERT INTO stats_snapshots (proxy_name, server_name, bytes_in, bytes_out, rate, request_rate)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run("http_main", "FRONTEND", 1000, 2000, 5, 10);
    const row = database
      .prepare("SELECT * FROM stats_snapshots WHERE proxy_name = ?")
      .get("http_main") as { proxy_name: string; bytes_in: number };
    expect(row).toBeDefined();
    expect(row.proxy_name).toBe("http_main");
    expect(row.bytes_in).toBe(1000);
  });
});
