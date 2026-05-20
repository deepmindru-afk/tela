-- 0013_feedback.sql
-- M17.A.1 Feedback: meta-feedback channel for Tela + tela-mcp themselves
-- (bugs, friction, suggestions to the developers). DISTINCT from page-content
-- comments which target individual pages.
--
-- v0 is WRITE-ONLY. There is no GET endpoint, no admin UI, no triage status —
-- submissions accumulate in this table and PO inspects via sqlite shell when
-- curious. The reading surface is intentionally deferred until feedback
-- volume justifies an admin view (see M17 plan).
--
-- Provenance columns are both nullable + ON DELETE SET NULL so feedback rows
-- survive after a user is deleted or their bearer key is revoked. The two
-- columns are not mutually exclusive: bearer-authed requests stamp BOTH the
-- resolved user id AND the api_keys row id so the audit trail can attribute
-- the submission to a specific key without losing the human owner. Session
-- submissions leave created_by_api_key_id NULL.
--
-- Length caps mirror the MCP tool schema (subject 1–200, body 1–8000) so the
-- backend rejects the same shape the client would have rejected. The CHECK
-- constraint is defence-in-depth — the handler trims + validates before this
-- ever fires.

CREATE TABLE IF NOT EXISTS feedback (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
    created_by_user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by_api_key_id INTEGER REFERENCES api_keys(id) ON DELETE SET NULL,
    subject               TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
    body                  TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 8000)
);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
