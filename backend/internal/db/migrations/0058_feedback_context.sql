-- 0058_feedback_context.sql — feedback provenance + context for triage.
--
-- The in-app widget, the MCP submit_feedback tool, and direct API posts all land
-- in one inbox; these columns let the admin view tell them apart and jump to the
-- page a report is about.
--   source  — where it came from: 'web' (in-app widget), 'mcp' (agent tool), 'api'
--             (direct bearer POST). Stamped server-side, never client-trusted.
--   kind    — optional user-chosen type: 'idea' | 'bug' | 'other'. NULL = unspecified.
--   context — free-form JSONB the client + backend stamp (route, page_id, space_id,
--             page_title, app_version, app_commit, theme, viewport, user_agent).
-- JSONB (cf. notifications.data, pages.props): clean ser/deser, queryable later.
ALTER TABLE feedback ADD COLUMN source  TEXT  NOT NULL DEFAULT 'web';
ALTER TABLE feedback ADD COLUMN kind    TEXT;
ALTER TABLE feedback ADD COLUMN context JSONB NOT NULL DEFAULT '{}';
