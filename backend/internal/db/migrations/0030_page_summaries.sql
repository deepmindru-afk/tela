-- 0030_page_summaries.sql — generation bookkeeping for LLM page summaries.
--
-- The summary TEXT itself lives in pages.props->>'summary' (where the blog
-- excerpt, public meta description and hover hint already read it); this table
-- records HOW it was produced so the worker can tell fresh from stale and the
-- admin status view can mirror the search-index freshness pattern.
--
-- src_hash is sha256(body) at generation time: a body edit changes the hash and
-- the row reads stale, with no extra column on pages and no updated_at coupling
-- (a summary write must never look like a user edit). last_error/attempts carry
-- the failure state for the retry/backoff loop; a failed-only row keeps
-- src_hash '' so status reads failed-never-generated.

CREATE TABLE page_summaries (
  page_id      BIGINT PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,
  src_hash     TEXT NOT NULL,
  model        TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT tela_now(),
  last_error   TEXT NOT NULL DEFAULT '',
  attempts     INTEGER NOT NULL DEFAULT 0
);
