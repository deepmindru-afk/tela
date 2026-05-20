// submit_feedback posts free-text feedback about Tela or the tela-mcp server
// itself (friction, bugs, missing capabilities) to the M17 backend. Distinct
// from page-content comments: feedback targets the system, not the wiki
// content. Backed by POST /api/feedback — accepts any bearer scope including
// read (path-aware carve-out in the bearer middleware), so even lowest-trust
// agents can report friction.

import { z } from "zod";
import type { TelaClient } from "../client.js";

export const submitFeedbackInputSchema = {
  subject: z.string().min(1).max(200).describe("Short title for the feedback (1-200 chars after trim)."),
  body: z.string().min(1).max(8000).describe("Full feedback text (1-8000 chars after trim)."),
};

const submitFeedbackArgs = z.object(submitFeedbackInputSchema);
export type SubmitFeedbackArgs = z.infer<typeof submitFeedbackArgs>;

interface FeedbackRow {
  id: number;
  created_at: string;
  created_by_user_id: number | null;
  created_by_api_key_id: number | null;
  subject: string;
  body: string;
}

interface SubmitFeedbackResponse {
  feedback: FeedbackRow;
}

export async function submitFeedback(
  client: TelaClient,
  args: SubmitFeedbackArgs,
): Promise<{ feedback: FeedbackRow }> {
  const res = await client.postJSON<SubmitFeedbackResponse>("/api/feedback", {
    subject: args.subject,
    body: args.body,
  });
  return { feedback: res.feedback };
}
