// import_mira imports a single mira (mira.cagdas.io) page into a Tela space
// via POST /api/spaces/{space_id}/import-mira (M18.A.3). Two modes, mutually
// exclusive: a https `source_url` fetched server-side under the host
// allowlist, or a raw mira block JSON `payload` posted inline. Returns the
// created page row wrapped in a `{ page: ... }` envelope per the M17 audit
// convention shared with create_page / update_page.

import { z } from "zod";
import { TelaApiError, type TelaClient } from "../client.js";

export const importMiraInputSchema = {
  space_id: z.number().int().positive().describe("Numeric Tela space id to import into."),
  parent_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional parent page id. Omit to import at the space root."),
  source_url: z
    .string()
    .url()
    .optional()
    .describe(
      "Public mira URL (e.g. https://mira.cagdas.io/p/<slug>). Backend fetches it server-side under an https-only host allowlist (default `mira.cagdas.io`), 5s timeout, 1 MiB response cap. Exactly one of source_url or payload is required.",
    ),
  payload: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Raw mira block JSON (the `.json` shape mira serves at /p/<slug>.json). Use when the URL is not publicly fetchable. Exactly one of source_url or payload is required. 1 MiB request body cap.",
    ),
};

const importMiraArgs = z.object(importMiraInputSchema);
export type ImportMiraArgs = z.infer<typeof importMiraArgs>;

interface PageRow {
  id: number;
  title: string;
  body: string;
  space_id: number;
  parent_id: number | null;
  position: number;
  created_at: string;
  updated_at: string;
}

interface ImportMiraResponse {
  page: PageRow;
}

export async function importMira(
  client: TelaClient,
  args: ImportMiraArgs,
): Promise<{ page: PageRow }> {
  const hasURL = args.source_url !== undefined && args.source_url.trim() !== "";
  const hasPayload = args.payload !== undefined;
  if (hasURL === hasPayload) {
    // Mirror the backend's error envelope shape for symmetry: agents that key
    // on `code: "bad_request"` see the same value whether the rejection
    // happened client-side or after the round-trip.
    throw new TelaApiError(400, {
      error: "exactly one of source_url or payload required",
      code: "bad_request",
    });
  }
  const body: Record<string, unknown> = {};
  if (args.parent_id !== undefined) body.parent_id = args.parent_id;
  if (hasURL) body.source_url = args.source_url;
  if (hasPayload) body.payload = args.payload;
  const res = await client.postJSON<ImportMiraResponse>(
    `/api/spaces/${args.space_id}/import-mira`,
    body,
  );
  return { page: res.page };
}
