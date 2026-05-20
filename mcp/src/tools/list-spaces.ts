import { z } from "zod";
import type { TelaClient } from "../client.js";

export const listSpacesInputSchema = z.object({});

interface SpaceRow {
  id: number;
  name: string;
  slug: string;
}

interface ListSpacesResponse {
  spaces: SpaceRow[];
}

export async function listSpaces(client: TelaClient): Promise<{ spaces: SpaceRow[] }> {
  const res = await client.getJSON<ListSpacesResponse>("/api/spaces");
  const spaces = (res.spaces ?? []).map((s) => ({ id: s.id, name: s.name, slug: s.slug }));
  return { spaces };
}
