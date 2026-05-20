import { z } from "zod";
import type { TelaClient } from "../client.js";

export const listBacklinksInputSchema = {
  page_id: z.number().int().positive().describe("The target page. Returns pages that link TO this page."),
};

const listBacklinksArgs = z.object(listBacklinksInputSchema);
export type ListBacklinksArgs = z.infer<typeof listBacklinksArgs>;

interface BacklinkRow {
  page_id: number;
  space_id: number;
  title: string;
}

interface ListBacklinksResponse {
  backlinks: BacklinkRow[];
}

export interface BacklinkResult {
  id: number;
  title: string;
  space_id: number;
}

export async function listBacklinks(
  client: TelaClient,
  args: ListBacklinksArgs,
): Promise<{ backlinks: BacklinkResult[] }> {
  const res = await client.getJSON<ListBacklinksResponse>(`/api/pages/${args.page_id}/backlinks`);
  const backlinks = (res.backlinks ?? []).map((b) => ({
    id: b.page_id,
    title: b.title,
    space_id: b.space_id,
  }));
  return { backlinks };
}
