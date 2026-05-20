import { z } from "zod";
import type { TelaClient } from "../client.js";

export const listPagesInputSchema = {
  space_id: z.number().int().positive().describe("Numeric Tela space id."),
  parent_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Restrict to direct children of this page. Omit for root pages."),
};

const listPagesArgs = z.object(listPagesInputSchema);
export type ListPagesArgs = z.infer<typeof listPagesArgs>;

interface PageRow {
  id: number;
  title: string;
  parent_id: number | null;
  position: number;
  space_id: number;
}

interface ListPagesResponse {
  pages: PageRow[];
}

export async function listPages(client: TelaClient, args: ListPagesArgs): Promise<{ pages: PageRow[] }> {
  const params: Record<string, string | number> = { space_id: args.space_id };
  if (args.parent_id !== undefined) params.parent_id = args.parent_id;
  const res = await client.getJSON<ListPagesResponse>("/api/pages", params);
  const pages = (res.pages ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    parent_id: p.parent_id,
    position: p.position,
    space_id: p.space_id,
  }));
  return { pages };
}
