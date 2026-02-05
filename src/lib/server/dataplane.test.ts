import { describe, it, expect, vi, beforeEach } from "vitest";
import { getInfo, getConfigurationVersion, getFrontends } from "./dataplane";

const mockFetch = vi.fn();
vi.mock("$env/dynamic/private", () => ({
  env: {
    DATAPLANE_API_URL: "http://test-dpa:5555",
    DATAPLANE_API_USER: "admin",
    DATAPLANE_API_PASSWORD: "test",
  },
}));

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch;
});

describe("dataplane", () => {
  it("getInfo returns parsed JSON on 200", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ version: "3.0", api_version: "v3" }),
    });
    const result = await getInfo();
    expect(result).toEqual({ version: "3.0", api_version: "v3" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-dpa:5555/v3/info",
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  it("getInfo throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: () => Promise.resolve("Unauthorized") });
    await expect(getInfo()).rejects.toThrow(/DPA \/v3\/info: 401/);
  });

  it("getConfigurationVersion returns version from header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Map([["Configuration-Version", "42"]]),
      json: () => Promise.resolve({}),
    });
    const v = await getConfigurationVersion();
    expect(v).toBe(42);
  });

  it("getConfigurationVersion throws when header missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Map(),
      json: () => Promise.resolve({}),
    });
    await expect(getConfigurationVersion()).rejects.toThrow(/Configuration-Version header missing/);
  });

  it("getFrontends calls correct path", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ name: "http_front" }]),
    });
    const result = await getFrontends();
    expect(result).toEqual([{ name: "http_front" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-dpa:5555/v3/services/haproxy/configuration/frontends",
      expect.any(Object)
    );
  });
});
