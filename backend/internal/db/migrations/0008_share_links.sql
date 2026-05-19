-- 0008_share_links.sql
-- M15.0 PublicShare: public sharing of pages without login.
--
-- One row per share token. A page may have multiple active shares so that
-- revoking one does not break the others. include_descendants extends the
-- share to cover the source page's live subtree (queried at request time —
-- pages added later are included automatically). Soft-delete via revoked_at
-- so audit trail survives revocation.
--
-- password_hash is NULL when the share is open; argon2id-encoded otherwise
-- (auth.HashPassword from M6.0). Plaintext passwords are never stored.

CREATE TABLE share_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  include_descendants INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  -- modernc.org/sqlite auto-converts TIMESTAMP columns to RFC3339 on read
  -- (e.g. "2026-05-20T00:49:44Z"), which breaks the "YYYY-MM-DD HH:MM:SS"
  -- wire convention used everywhere else in Tela. Migrations 0001-0007 store
  -- datetimes in TEXT columns for that reason; matching them here keeps the
  -- frontend's parseSqliteTs path uniform across tables.
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  revoked_at TEXT
);

CREATE INDEX idx_share_links_page_active
  ON share_links(page_id)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_share_links_token
  ON share_links(token);
