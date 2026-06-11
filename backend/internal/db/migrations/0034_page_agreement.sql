-- 0034_page_agreement.sql — the corroboration/contradiction signal for the
-- epistemic trust strip (Slice 2). For each page, a background worker
-- (internal/agreement, the LLM sibling of internal/summarize) compares it
-- against its nearest same-space pages and records how many corroborate vs
-- dispute it, plus the dispute details. Computed, never authored — the page
-- body is untouched; this table is pure machine bookkeeping keyed by the body
-- hash, exactly like page_summaries.
--
-- Same-space only: a reader who can see the page can see every page named here,
-- so surfacing a dispute never leaks a page across access boundaries.

CREATE TABLE page_agreement (
  page_id     BIGINT PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,
  src_hash    TEXT NOT NULL,                 -- sha256(body) at compute time
  model       TEXT NOT NULL,
  corroborate INTEGER NOT NULL DEFAULT 0,    -- # same-space pages that agree
  dispute     INTEGER NOT NULL DEFAULT 0,    -- # that contradict
  disputes    TEXT NOT NULL DEFAULT '[]',    -- JSON: [{page_id,title,reason}]
  computed_at TEXT NOT NULL DEFAULT tela_now(),
  last_error  TEXT NOT NULL DEFAULT '',
  attempts    INTEGER NOT NULL DEFAULT 0
);
