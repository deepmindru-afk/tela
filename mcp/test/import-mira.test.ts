import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TelaApiError } from "../src/client.js";
import { importMira, importMiraInputSchema } from "../src/tools/import-mira.js";
import { makeFlakyClient, makeMockClient } from "./fixtures.js";

describe("import_mira", () => {
  const samplePage = {
    id: 42,
    title: "Imported mira page",
    body: "# Imported mira page\n\nbody text\n\n<!-- mira-source: https://mira.cagdas.io/p/foo -->\n",
    space_id: 1,
    parent_id: 7,
    position: 3,
    created_at: "2026-05-21 19:00:00",
    updated_at: "2026-05-21 19:00:00",
  };

  it("POSTs the source_url path to /api/spaces/{space_id}/import-mira and returns the page wrapped", async () => {
    const { client, requests } = makeMockClient({ status: 201, body: { page: samplePage } });
    const out = await importMira(client, {
      space_id: 1,
      parent_id: 7,
      source_url: "https://mira.cagdas.io/p/foo",
    });
    expect(out.page.id).toBe(42);
    expect(out.page.space_id).toBe(1);
    expect(out.page.parent_id).toBe(7);
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url).toBe("http://test.local/api/spaces/1/import-mira");
    expect(requests[0].headers["Content-Type"]).toBe("application/json");
    expect(requests[0].headers["Authorization"]).toBe("Bearer tela_pat_test");
    expect(JSON.parse(requests[0].body as string)).toEqual({
      parent_id: 7,
      source_url: "https://mira.cagdas.io/p/foo",
    });
  });

  it("POSTs the payload path without source_url and omits parent_id when unset", async () => {
    const { client, requests } = makeMockClient({ status: 201, body: { page: samplePage } });
    const out = await importMira(client, {
      space_id: 1,
      payload: { template: "page", blocks: [] },
    });
    expect(out.page.id).toBe(42);
    expect(JSON.parse(requests[0].body as string)).toEqual({
      payload: { template: "page", blocks: [] },
    });
  });

  it("rejects client-side when both source_url and payload are provided", async () => {
    const { client, requests } = makeMockClient({ status: 201, body: { page: samplePage } });
    await expect(
      importMira(client, {
        space_id: 1,
        source_url: "https://mira.cagdas.io/p/foo",
        payload: { template: "page", blocks: [] },
      }),
    ).rejects.toMatchObject({ status: 400, code: "bad_request" });
    expect(requests).toHaveLength(0);
  });

  it("rejects client-side when neither source_url nor payload is provided", async () => {
    const { client, requests } = makeMockClient({ status: 201, body: { page: samplePage } });
    await expect(
      importMira(client, { space_id: 1 } as unknown as { space_id: number; source_url: string }),
    ).rejects.toMatchObject({ status: 400, code: "bad_request" });
    expect(requests).toHaveLength(0);
  });

  it("treats an empty/whitespace source_url as absent and accepts the payload-only path", async () => {
    const { client, requests } = makeMockClient({ status: 201, body: { page: samplePage } });
    await importMira(client, {
      space_id: 1,
      source_url: "   ",
      payload: { template: "page", blocks: [] },
    } as unknown as { space_id: number; source_url: string; payload: Record<string, unknown> });
    expect(JSON.parse(requests[0].body as string)).toEqual({
      payload: { template: "page", blocks: [] },
    });
  });

  it("surfaces 403 forbidden envelope as TelaApiError", async () => {
    const { client } = makeMockClient({
      status: 403,
      body: { error: "source_url host is not on the mira allowlist", code: "forbidden" },
    });
    await expect(
      importMira(client, { space_id: 1, source_url: "https://evil.example/p/x" }),
    ).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });

  it("surfaces 413 oversized response envelope as TelaApiError", async () => {
    const { client } = makeMockClient({
      status: 413,
      body: { error: "source_url response exceeds 1 MiB", code: "bad_request" },
    });
    await expect(
      importMira(client, { space_id: 1, source_url: "https://mira.cagdas.io/p/huge" }),
    ).rejects.toBeInstanceOf(TelaApiError);
  });

  it("surfaces 404 space_not_found envelope as TelaApiError", async () => {
    const { client } = makeMockClient({
      status: 404,
      body: { error: "space not found", code: "space_not_found" },
    });
    await expect(
      importMira(client, { space_id: 999, source_url: "https://mira.cagdas.io/p/foo" }),
    ).rejects.toMatchObject({ status: 404, code: "space_not_found" });
  });

  it("retries once on 5xx then succeeds", async () => {
    const { client, requests } = makeFlakyClient([
      { status: 502, body: { error: "boom", code: "internal" } },
      { status: 201, body: { page: samplePage } },
    ]);
    const out = await importMira(client, {
      space_id: 1,
      source_url: "https://mira.cagdas.io/p/foo",
    });
    expect(out.page.id).toBe(42);
    expect(requests).toHaveLength(2);
  });
});

describe("import_mira input schema", () => {
  const parse = z.object(importMiraInputSchema).safeParse.bind(z.object(importMiraInputSchema));

  it("requires a positive space_id", () => {
    expect(parse({ space_id: 0, source_url: "https://mira.cagdas.io/p/x" }).success).toBe(false);
    expect(parse({ space_id: -1, source_url: "https://mira.cagdas.io/p/x" }).success).toBe(false);
  });

  it("rejects a parent_id of zero", () => {
    expect(
      parse({ space_id: 1, parent_id: 0, source_url: "https://mira.cagdas.io/p/x" }).success,
    ).toBe(false);
  });

  it("rejects a malformed source_url", () => {
    expect(parse({ space_id: 1, source_url: "not-a-url" }).success).toBe(false);
  });

  it("accepts an https source_url alone", () => {
    expect(parse({ space_id: 1, source_url: "https://mira.cagdas.io/p/x" }).success).toBe(true);
  });

  it("accepts a payload object alone", () => {
    expect(parse({ space_id: 1, payload: { template: "page", blocks: [] } }).success).toBe(true);
  });

  it("the at-least-one / at-most-one rule is enforced at the function layer, not the schema", () => {
    expect(parse({ space_id: 1 }).success).toBe(true);
    expect(
      parse({
        space_id: 1,
        source_url: "https://mira.cagdas.io/p/x",
        payload: { template: "page" },
      }).success,
    ).toBe(true);
  });
});
