-- 0005_yjs.sql
-- M7.1 LiveCollab: opaque Yjs update + snapshot persistence.
--
-- The server is a dumb relay+persister: it does not understand Yjs CRDT
-- internals. Clients send opaque binary update blobs over /ws/pages/{id};
-- the server appends each blob with a monotonic per-page seq.
--
-- page_yjs_snapshots holds a periodic full-state blob produced by an
-- elected client. After a snapshot at seq=S persists for a grace window
-- (~15 min), pre-snapshot updates (seq < S) are GC'd.
--
-- Both tables cascade on pages(id) — Yjs state lives and dies with the
-- page. pages.body stays the canonical markdown; these tables are an
-- overlay that can be dropped entirely without data loss.

CREATE TABLE page_yjs_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  payload BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (page_id, seq)
);

CREATE INDEX idx_page_yjs_updates_page_seq ON page_yjs_updates(page_id, seq DESC);

CREATE TABLE page_yjs_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  state BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (page_id, seq)
);

CREATE INDEX idx_page_yjs_snapshots_page_seq ON page_yjs_snapshots(page_id, seq DESC);
