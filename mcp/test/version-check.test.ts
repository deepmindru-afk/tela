import { describe, expect, it } from "vitest";
import { runVersionCheck } from "../src/version-check.js";

function mockFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
}

describe("runVersionCheck (defensive semver)", () => {
  it("handles version='dev' without throwing", async () => {
    const log: string[] = [];
    await runVersionCheck({
      baseUrl: "http://test.local",
      builtAgainst: "0.1.0",
      fetchImpl: mockFetch({ version: "dev", commit: "unknown", built_at: "x" }),
      logger: (m) => log.push(m),
    });
    expect(log.some((m) => m.includes("skipping semver compat check"))).toBe(true);
  });

  it("handles empty version string without throwing", async () => {
    const log: string[] = [];
    await runVersionCheck({
      baseUrl: "http://test.local",
      builtAgainst: "0.1.0",
      fetchImpl: mockFetch({ version: "", commit: "unknown", built_at: "x" }),
      logger: (m) => log.push(m),
    });
    expect(log.some((m) => m.includes("skipping") || m.includes("no version"))).toBe(true);
  });

  it("handles git-describe short SHA ('4f4eeea') as non-semver", async () => {
    const log: string[] = [];
    await runVersionCheck({
      baseUrl: "http://test.local",
      builtAgainst: "0.1.0",
      fetchImpl: mockFetch({ version: "4f4eeea", commit: "4f4eeea", built_at: "x" }),
      logger: (m) => log.push(m),
    });
    expect(log.some((m) => m.includes("skipping semver compat check"))).toBe(true);
  });

  it("warns when backend > built-against on valid semver", async () => {
    const log: string[] = [];
    await runVersionCheck({
      baseUrl: "http://test.local",
      builtAgainst: "0.1.0",
      fetchImpl: mockFetch({ version: "0.2.0", commit: "abc", built_at: "x" }),
      logger: (m) => log.push(m),
    });
    expect(log.some((m) => m.includes("> built-against"))).toBe(true);
  });

  it("silently succeeds when versions match", async () => {
    const log: string[] = [];
    await runVersionCheck({
      baseUrl: "http://test.local",
      builtAgainst: "0.1.0",
      fetchImpl: mockFetch({ version: "0.1.0", commit: "abc", built_at: "x" }),
      logger: (m) => log.push(m),
    });
    expect(log).toEqual([]);
  });

  it("does not throw when probe returns non-2xx", async () => {
    const log: string[] = [];
    await runVersionCheck({
      baseUrl: "http://test.local",
      builtAgainst: "0.1.0",
      fetchImpl: mockFetch({ error: "boom", code: "internal" }, 500),
      logger: (m) => log.push(m),
    });
    expect(log.some((m) => m.includes("version probe HTTP 500"))).toBe(true);
  });

  it("does not throw when fetch rejects", async () => {
    const log: string[] = [];
    const dead = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    await runVersionCheck({
      baseUrl: "http://test.local",
      builtAgainst: "0.1.0",
      fetchImpl: dead,
      logger: (m) => log.push(m),
    });
    expect(log.some((m) => m.includes("version probe failed"))).toBe(true);
  });
});
