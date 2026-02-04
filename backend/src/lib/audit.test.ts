/**
 * Tests for audit logger. Uses in-memory SQLite via setDatabaseOverride.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { schemaStatements, setDatabaseOverride } from "../db";
import { logAction, getAuditLog } from "./audit";
import type { AuditLogRow } from "../db";

describe("audit logAction", () => {
  let database: Database;

  beforeEach(() => {
    database = new Database(":memory:");
    for (const statement of schemaStatements) {
      database.run(statement);
    }
    setDatabaseOverride(database);
  });

  afterEach(() => {
    setDatabaseOverride(null);
  });

  test("writes entry and returns row with id", () => {
    const result = logAction({
      action: "frontend.create",
      resourceType: "frontend",
      resourceId: "fe_test",
      details: '{"name":"fe_test"}',
    });

    expect(result).not.toBeNull();
    expect(result!.id).toBeGreaterThan(0);
    expect(result!.action).toBe("frontend.create");
    expect(result!.resource_type).toBe("frontend");
    expect(result!.resource_id).toBe("fe_test");

    const rows = database.prepare("SELECT * FROM audit_log").all() as AuditLogRow[];
    expect(rows.length).toBe(1);
  });

  test("writes entry with optional fields null", () => {
    const result = logAction({
      action: "certificate.upload",
      resourceType: "certificate",
    });

    expect(result).not.toBeNull();
    expect(result!.resource_id).toBeNull();
    expect(result!.details).toBeNull();
  });
});

describe("audit getAuditLog", () => {
  let database: Database;

  beforeEach(() => {
    database = new Database(":memory:");
    for (const statement of schemaStatements) {
      database.run(statement);
    }
    database
      .prepare(
        "INSERT INTO audit_log (action, resource_type, resource_id) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)"
      )
      .run(
        "frontend.create",
        "frontend",
        "fe_1",
        "backend.create",
        "backend",
        "be_1",
        "frontend.update",
        "frontend",
        "fe_1"
      );
    setDatabaseOverride(database);
  });

  afterEach(() => {
    setDatabaseOverride(null);
  });

  test("returns all entries without filter", () => {
    const entries = getAuditLog({ limit: 10, offset: 0 });
    expect(entries.length).toBe(3);
  });

  test("filters by action", () => {
    const entries = getAuditLog({
      action: "frontend.create",
      limit: 10,
      offset: 0,
    });
    expect(entries.length).toBe(1);
    expect(entries[0].action).toBe("frontend.create");
  });

  test("respects limit and offset", () => {
    const first = getAuditLog({ limit: 2, offset: 0 });
    const second = getAuditLog({ limit: 2, offset: 2 });
    expect(first.length).toBe(2);
    expect(second.length).toBe(1);
  });
});
