import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logAction, getAuditLog } from "./audit";
import { closeDatabase } from "./db/index";

vi.mock("$env/dynamic/private", () => ({
  env: { ...process.env, DATABASE_PATH: ":memory:" },
}));

beforeEach(() => {
  process.env.DATABASE_PATH = ":memory:";
});
afterEach(() => {
  closeDatabase();
});

describe("audit", () => {
  it("logAction inserts and returns id", () => {
    const { id } = logAction({ action: "test" });
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("logAction with optional fields", () => {
    const { id } = logAction({
      action: "create",
      resource_type: "backend",
      resource_id: "mybackend",
      details: "created via API",
    });
    expect(id).toBeGreaterThan(0);
    const entries = getAuditLog({ limit: 1 });
    expect(entries.length).toBe(1);
    expect(entries[0].action).toBe("create");
    expect(entries[0].resource_type).toBe("backend");
    expect(entries[0].resource_id).toBe("mybackend");
    expect(entries[0].details).toBe("created via API");
  });

  it("getAuditLog returns entries ordered by created_at desc", () => {
    logAction({ action: "first" });
    logAction({ action: "second" });
    const entries = getAuditLog({ limit: 10 });
    expect(entries.length).toBe(2);
    expect(entries[0].action).toBe("second");
    expect(entries[1].action).toBe("first");
  });

  it("getAuditLog filters by action", () => {
    logAction({ action: "create" });
    logAction({ action: "delete" });
    logAction({ action: "create" });
    const entries = getAuditLog({ action: "create", limit: 10 });
    expect(entries.length).toBe(2);
    expect(entries.every((e) => e.action === "create")).toBe(true);
  });

  it("getAuditLog respects limit", () => {
    for (let i = 0; i < 5; i++) logAction({ action: "x" });
    const entries = getAuditLog({ limit: 2 });
    expect(entries.length).toBe(2);
  });
});
