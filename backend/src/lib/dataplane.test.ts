/**
 * Tests for Data Plane API client. Mocks fetch to avoid real DPA.
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { getInfo, getConfigurationVersion, getFrontends } from "./dataplane";

const originalFetch = globalThis.fetch;

describe("dataplane getInfo", () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("returns parsed JSON when response ok", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ api: { version: "v3.2.7" } }), {
          status: 200,
        })
      )
    );
    const info = await getInfo();
    expect(info).toEqual({ api: { version: "v3.2.7" } });
  });

  test("throws when response not ok", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("Unauthorized", { status: 401 }))
    );
    try {
      await getInfo();
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toContain("Data Plane API info failed");
    }
  });
});

describe("dataplane getConfigurationVersion", () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("returns version number from response", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ version: 42 }), { status: 200 })
      )
    );
    const version = await getConfigurationVersion();
    expect(version).toBe(42);
  });

  test("throws when version missing in response", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({}), { status: 200 })
      )
    );
    try {
      await getConfigurationVersion();
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toContain(
        "version response missing version field"
      );
    }
  });
});

describe("dataplane getFrontends", () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("returns array when response is array (v3)", async () => {
    const data = [{ name: "fe_main" }];
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify(data), { status: 200 })
      )
    );
    const frontends = await getFrontends();
    expect(frontends).toEqual(data);
  });

  test("returns data.data when response is wrapped", async () => {
    const data = [{ name: "fe_main" }];
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data }), { status: 200 })
      )
    );
    const frontends = await getFrontends();
    expect(frontends).toEqual(data);
  });
});
