/**
 * Tests for stats parser. Mocks fetch to avoid real HAProxy.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { config } from "../config";

const originalFetch = globalThis.fetch;

describe("stats fetchAndParseStats", () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("parses CSV and returns structured rows", async () => {
    const csv = `# pxname,svname,bin,bout,rate,req_rate,hrsp_4xx,hrsp_5xx,rtime
fe_main,FRONTEND,1000,2000,5,10,0,0,
http_backend,s1,500,600,2,4,1,0,10`;
    globalThis.fetch = () =>
      Promise.resolve(new Response(csv, { status: 200 }));

    const { fetchAndParseStats } = await import("./stats");
    const rows = await fetchAndParseStats();

    expect(rows.length).toBeGreaterThanOrEqual(2);
    const frontend = rows.find((r) => r.serverName === "FRONTEND");
    expect(frontend).toBeDefined();
    expect(frontend!.bytesIn).toBe(1000);
    expect(frontend!.bytesOut).toBe(2000);
    expect(frontend!.rate).toBe(5);
    expect(frontend!.requestRate).toBe(10);
  });

  test("throws when fetch fails", async () => {
    globalThis.fetch = () =>
      Promise.resolve(new Response("Error", { status: 502 }));

    const { fetchAndParseStats } = await import("./stats");
    try {
      await fetchAndParseStats();
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toContain("HAProxy stats fetch failed");
    }
  });
});
