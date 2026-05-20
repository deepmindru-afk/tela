import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TelaApiError } from "../src/client.js";
import { submitFeedback, submitFeedbackInputSchema } from "../src/tools/submit-feedback.js";
import { makeFlakyClient, makeMockClient } from "./fixtures.js";

describe("submit_feedback", () => {
  it("POSTs JSON to /api/feedback with subject + body and returns the unwrapped row", async () => {
    const { client, requests } = makeMockClient({
      status: 201,
      body: {
        feedback: {
          id: 7,
          created_at: "2026-05-20 21:30:00",
          created_by_user_id: 2,
          created_by_api_key_id: 12,
          subject: "Slash menu invisible on first open",
          body: "Repro: open a fresh editor, press /...",
        },
      },
    });
    const out = await submitFeedback(client, {
      subject: "Slash menu invisible on first open",
      body: "Repro: open a fresh editor, press /...",
    });
    expect(out.feedback.id).toBe(7);
    expect(out.feedback.created_by_api_key_id).toBe(12);
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url).toBe("http://test.local/api/feedback");
    expect(requests[0].headers["Content-Type"]).toBe("application/json");
    expect(requests[0].headers["Authorization"]).toBe("Bearer tela_pat_test");
    expect(JSON.parse(requests[0].body as string)).toEqual({
      subject: "Slash menu invisible on first open",
      body: "Repro: open a fresh editor, press /...",
    });
  });

  it("surfaces 400 bad_request envelope as TelaApiError", async () => {
    const { client } = makeMockClient({
      status: 400,
      body: { error: "subject is required (1-200 chars after trim)", code: "bad_request" },
    });
    await expect(
      submitFeedback(client, { subject: "x", body: "y" }),
    ).rejects.toMatchObject({ status: 400, code: "bad_request" });
  });

  it("surfaces 401 unauthorized envelope as TelaApiError", async () => {
    const { client } = makeMockClient({
      status: 401,
      body: { error: "unauthorized", code: "unauthorized" },
    });
    await expect(submitFeedback(client, { subject: "x", body: "y" })).rejects.toBeInstanceOf(
      TelaApiError,
    );
  });

  it("retries once on 5xx then succeeds", async () => {
    const { client, requests } = makeFlakyClient([
      { status: 503, body: { error: "boom", code: "internal" } },
      {
        status: 201,
        body: {
          feedback: {
            id: 8,
            created_at: "2026-05-20 21:31:00",
            created_by_user_id: 2,
            created_by_api_key_id: 12,
            subject: "x",
            body: "y",
          },
        },
      },
    ]);
    const out = await submitFeedback(client, { subject: "x", body: "y" });
    expect(out.feedback.id).toBe(8);
    expect(requests).toHaveLength(2);
  });
});

describe("submit_feedback input schema", () => {
  const parse = z.object(submitFeedbackInputSchema).safeParse.bind(z.object(submitFeedbackInputSchema));

  it("rejects empty subject", () => {
    expect(parse({ subject: "", body: "ok" }).success).toBe(false);
  });

  it("rejects empty body", () => {
    expect(parse({ subject: "ok", body: "" }).success).toBe(false);
  });

  it("rejects subject over 200 chars", () => {
    expect(parse({ subject: "x".repeat(201), body: "ok" }).success).toBe(false);
  });

  it("rejects body over 8000 chars", () => {
    expect(parse({ subject: "ok", body: "x".repeat(8001) }).success).toBe(false);
  });

  it("accepts subject at 200 and body at 8000 chars", () => {
    expect(parse({ subject: "x".repeat(200), body: "x".repeat(8000) }).success).toBe(true);
  });
});
