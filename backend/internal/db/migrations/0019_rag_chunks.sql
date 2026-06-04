-- 0019_rag_chunks.sql — semantic-retrieval (RAG) layer.
--
-- Owned entirely by internal/rag. Additive and inert until something writes
-- rows: no triggers touch the `pages` table, no existing query reads these,
-- and the feature no-ops unless TELA_RAG_EMBED_URL is configured. Safe to ship
-- dark.
--
-- A page is split into heading-aware chunks (internal/rag/chunk.go); each chunk
-- stores its raw markdown plus a 1024-d embedding packed as a little-endian
-- float32 BLOB (internal/rag/vector.go). `content_hash` lets a reindex reuse an
-- existing vector when a chunk's embed-text is unchanged. `embedding` is
-- nullable so a row can exist before/without a successful embed call.

CREATE TABLE page_chunks (
  id           INTEGER PRIMARY KEY,
  page_id      INTEGER NOT NULL,
  space_id     INTEGER NOT NULL,
  ord          INTEGER NOT NULL,            -- 0-based position within the page
  heading_path TEXT    NOT NULL DEFAULT '', -- "Deploy > Production"
  content      TEXT    NOT NULL,            -- raw markdown slice (returned to callers)
  content_hash TEXT    NOT NULL,            -- sha256(model \0 embed_text); reuse key
  embedding    BLOB,                        -- packed []float32 LE; NULL until embedded
  model        TEXT    NOT NULL DEFAULT '', -- embedding model that produced `embedding`
  dim          INTEGER NOT NULL DEFAULT 0,  -- embedding dimension (len(embedding)/4)
  created_at   TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at   TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX idx_page_chunks_page  ON page_chunks(page_id);
CREATE INDEX idx_page_chunks_space ON page_chunks(space_id);

-- Chunk-level FTS5 for the lexical half of hybrid search. External-content
-- table mirrored from page_chunks via triggers, exactly like pages_fts
-- (0002_search.sql). Separate from pages_fts so page- and chunk-granular
-- search never interfere.
CREATE VIRTUAL TABLE page_chunks_fts USING fts5(
  content,
  content='page_chunks',
  content_rowid='id',
  tokenize='porter unicode61'
);

CREATE TRIGGER page_chunks_ai AFTER INSERT ON page_chunks BEGIN
  INSERT INTO page_chunks_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER page_chunks_ad AFTER DELETE ON page_chunks BEGIN
  INSERT INTO page_chunks_fts(page_chunks_fts, rowid, content) VALUES ('delete', old.id, old.content);
END;

CREATE TRIGGER page_chunks_au AFTER UPDATE OF content ON page_chunks BEGIN
  INSERT INTO page_chunks_fts(page_chunks_fts, rowid, content) VALUES ('delete', old.id, old.content);
  INSERT INTO page_chunks_fts(rowid, content) VALUES (new.id, new.content);
END;
