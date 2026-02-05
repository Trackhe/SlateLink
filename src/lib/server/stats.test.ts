import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getStatsHistory, deleteSnapshotsOlderThanDays } from "./stats";
import { getDatabase } from "./db/index";
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

describe("stats", () => {
  it("getStatsHistory returns empty when no snapshots", () => {
    const result = getStatsHistory();
    expect(result).toEqual([]);
  });

  it("getStatsHistory returns inserted snapshots", () => {
    const db = getDatabase();
    db.prepare("INSERT INTO stats_snapshots (payload) VALUES (?)").run(
      '{"key":"a"}'
    );
    db.prepare("INSERT INTO stats_snapshots (payload) VALUES (?)").run(
      '{"key":"b"}'
    );
    const result = getStatsHistory({ limit: 10 });
    expect(result.length).toBe(2);
    expect(result[0].payload).toBe('{"key":"b"}');
    expect(result[1].payload).toBe('{"key":"a"}');
  });

  it("getStatsHistory respects limit", () => {
    const db = getDatabase();
    for (let i = 0; i < 5; i++) {
      db.prepare("INSERT INTO stats_snapshots (payload) VALUES (?)").run(
        JSON.stringify({ i })
      );
    }
    const result = getStatsHistory({ limit: 2 });
    expect(result.length).toBe(2);
  });

  it("deleteSnapshotsOlderThanDays removes old rows", () => {
    const db = getDatabase();
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    db.prepare(
      "INSERT INTO stats_snapshots (created_at, payload) VALUES (?, ?)"
    ).run(oldDate.toISOString(), "{}");
    db.prepare("INSERT INTO stats_snapshots (payload) VALUES (?)").run("{}");
    const deleted = deleteSnapshotsOlderThanDays(5);
    expect(deleted).toBe(1);
    const remaining = getStatsHistory({ limit: 10 });
    expect(remaining.length).toBe(1);
  });
});
