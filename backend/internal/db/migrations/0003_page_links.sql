-- 0003_page_links.sql
-- M5.2 wikilinks + backlinks: denormalized outgoing-link table.
--
-- Maintained by the API layer on page create/update (parse tela://page/{N}
-- out of body → delete-then-insert outgoing rows) and on page delete
-- (cache last_known_title for incoming rows before the page row is gone).
--
-- No FK to pages on purpose: an orphan row (target_id referencing a
-- non-existent page) is how the frontend detects a broken wikilink.
-- last_known_title is the cached title captured at deletion time so
-- broken links still render with a usable label.
--
-- Empty on migration. First save of each page repopulates its outgoing
-- rows naturally. Pages that contain wikilinks at the time this migration
-- runs need a no-op save to backfill — there are no triggers and SQLite
-- has no built-in regex, so a SQL-only backfill isn't worth the complexity
-- for v0.

CREATE TABLE page_links (
  source_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL,
  last_known_title TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (source_id, target_id)
);

CREATE INDEX idx_page_links_target ON page_links(target_id);
