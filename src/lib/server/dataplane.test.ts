import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	getInfo,
	getConfigurationVersion,
	getFrontends,
	getFrontend,
	getBackends,
	getBackend,
	frontendNamesUsingBackend,
	usedConfigNames,
	bindEndpointKey,
	getAllUsedBindEndpoints,
	deleteBind,
	deleteServer,
} from "./dataplane";

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

  it("getFrontend(name) calls correct path", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ name: "http_front", mode: "http" }),
    });
    const result = await getFrontend("http_front");
    expect(result).toEqual({ name: "http_front", mode: "http" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-dpa:5555/v3/services/haproxy/configuration/frontends/http_front",
      expect.any(Object)
    );
  });

  it("getBackends calls correct path", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ name: "default_fallback" }]),
    });
    const result = await getBackends();
    expect(result).toEqual([{ name: "default_fallback" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-dpa:5555/v3/services/haproxy/configuration/backends",
      expect.any(Object)
    );
  });

  it("getBackend(name) calls correct path", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ name: "default_fallback", mode: "http" }),
    });
    const result = await getBackend("default_fallback");
    expect(result).toEqual({ name: "default_fallback", mode: "http" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-dpa:5555/v3/services/haproxy/configuration/backends/default_fallback",
      expect.any(Object)
    );
  });

  describe("frontendNamesUsingBackend", () => {
    it("returns names when frontends is array", () => {
      const list = [
        { name: "fe1", default_backend: "be1" },
        { name: "fe2", default_backend: "be2" },
        { name: "fe3", default_backend: "be1" },
      ];
      expect(frontendNamesUsingBackend(list, "be1")).toEqual(["fe1", "fe3"]);
      expect(frontendNamesUsingBackend(list, "be2")).toEqual(["fe2"]);
      expect(frontendNamesUsingBackend(list, "be3")).toEqual([]);
    });

    it("returns names when frontends is { data: [] }", () => {
      const raw = {
        data: [
          { name: "www", default_backend: "webservers" },
        ],
      };
      expect(frontendNamesUsingBackend(raw, "webservers")).toEqual(["www"]);
      expect(frontendNamesUsingBackend(raw, "other")).toEqual([]);
    });

    it("returns [] for invalid or empty input", () => {
      expect(frontendNamesUsingBackend(null, "be")).toEqual([]);
      expect(frontendNamesUsingBackend(undefined, "be")).toEqual([]);
      expect(frontendNamesUsingBackend([], "be")).toEqual([]);
    });

    it("skips entries without name", () => {
      const list = [{ default_backend: "be1" }];
      expect(frontendNamesUsingBackend(list, "be1")).toEqual([]);
    });
  });

  describe("usedConfigNames", () => {
    it("returns all frontend and backend names", () => {
      const fronts = [{ name: "fe1" }, { name: "fe2" }];
      const backs = [{ name: "be1" }];
      const used = usedConfigNames(fronts, backs);
      expect(used.has("fe1")).toBe(true);
      expect(used.has("fe2")).toBe(true);
      expect(used.has("be1")).toBe(true);
      expect(used.has("other")).toBe(false);
    });

    it("handles { data: [] } format", () => {
      const used = usedConfigNames({ data: [{ name: "www" }] }, []);
      expect(used.has("www")).toBe(true);
    });

    it("returns empty set for empty input", () => {
      expect(usedConfigNames([], []).size).toBe(0);
      expect(usedConfigNames(null, undefined).size).toBe(0);
    });
  });

  describe("bindEndpointKey", () => {
    it("normalizes address and port to key", () => {
      expect(bindEndpointKey("*", 80)).toBe("*:80");
      expect(bindEndpointKey("0.0.0.0", 443)).toBe("0.0.0.0:443");
      expect(bindEndpointKey(undefined, 8080)).toBe("*:8080");
      expect(bindEndpointKey("", 80)).toBe("*:80");
    });
  });

  describe("getAllUsedBindEndpoints", () => {
    it("returns used bind keys from all frontends", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ name: "fe1" }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ address: "*", port: 80 }]),
        });
      const used = await getAllUsedBindEndpoints();
      expect(used.has("*:80")).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("returns empty set when no frontends", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });
      const used = await getAllUsedBindEndpoints();
      expect(used.size).toBe(0);
    });
  });

  describe("deleteBind", () => {
    it("calls DELETE with frontend and bind name", async () => {
      const headers = new Map([["Configuration-Version", "1"]]);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          headers,
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: new Map(),
          json: () => Promise.resolve(undefined),
        });
      await deleteBind("fe1", "bind_80");
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        "http://test-dpa:5555/v3/services/haproxy/configuration/frontends/fe1/binds/bind_80?version=1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("deleteServer", () => {
    it("calls DELETE with backend and server name", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Map([["Configuration-Version", "1"]]),
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: new Map(),
          json: () => Promise.resolve(undefined),
        });
      await deleteServer("be1", "srv1");
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        "http://test-dpa:5555/v3/services/haproxy/configuration/backends/be1/servers/srv1?version=1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
