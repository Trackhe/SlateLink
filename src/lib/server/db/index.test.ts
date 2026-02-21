import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getAllFrontendRules,
  getDatabase,
  closeDatabase,
  createFrontendRule,
  getFrontendRuleById,
  updateFrontendRule,
  deleteFrontendRule,
} from "./index";
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

  it("creates, updates and deletes frontend rules", () => {
    const id = createFrontendRule({
      frontend_name: "fe_http",
      domains: ["example.com"],
      backend_name: "be_http",
      cert_ref: { type: "path", cert: "example.pem" },
      redirect_http_to_https: true,
      sort_order: 0,
    });
    const created = getFrontendRuleById(id);
    expect(created?.frontend_name).toBe("fe_http");
    expect(created?.domains).toEqual(["example.com"]);
    expect(created?.redirect_http_to_https).toBe(true);

    updateFrontendRule(id, {
      domains: ["www.example.com"],
      backend_name: "be_www",
      cert_ref: null,
      redirect_http_to_https: false,
    });
    const updated = getFrontendRuleById(id);
    expect(updated?.backend_name).toBe("be_www");
    expect(updated?.domains).toEqual(["www.example.com"]);
    expect(updated?.cert_ref).toBeNull();
    expect(updated?.redirect_http_to_https).toBe(false);

    deleteFrontendRule(id);
    expect(getFrontendRuleById(id)).toBeNull();
  });

  it("falls back for invalid frontend_rules json columns", () => {
    const db = getDatabase();
    db.prepare(
      "INSERT INTO frontend_rules (frontend_name, domains_json, backend_name, cert_ref_json, redirect_http_to_https, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("fe_invalid", "{not-json}", "be_invalid", "{not-json}", 1, 1);

    const rules = getAllFrontendRules();
    const invalidRule = rules.find((rule) => rule.frontend_name === "fe_invalid");
    expect(invalidRule?.domains).toEqual([]);
    expect(invalidRule?.cert_ref).toBeNull();
  });
});
