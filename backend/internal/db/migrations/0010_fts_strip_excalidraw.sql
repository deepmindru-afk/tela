-- 0010_fts_strip_excalidraw.sql
-- M13.3a RichView: pass page bodies through tela_strip_excalidraw() before
-- handing them to the FTS5 index so the JSON inside ```excalidraw fences
-- doesn't pollute search results.
--
-- The UDF is registered at driver-init time in db/sqlite_funcs.go (modernc.
-- org/sqlite's MustRegisterDeterministicScalarFunction). The triggers below
-- replace the original pages_ai / pages_ad / pages_au from 0002_search.sql
-- with versions that route `body` through the UDF.
--
-- Rebuild caveat: FTS5's built-in `INSERT INTO pages_fts(pages_fts) VALUES
-- ('rebuild')` re-indexes directly from the content='pages' table without
-- applying our triggers — so we can't rely on `rebuild` to re-strip existing
-- rows. Instead we issue an explicit delete-all + reinsert with the UDF
-- applied. Anyone running `rebuild` later would silently re-index raw bodies;
-- if that ever becomes a real concern, lift the FTS table off content='pages'
-- and push from Go code at write time.

DROP TRIGGER IF EXISTS pages_ai;
DROP TRIGGER IF EXISTS pages_ad;
DROP TRIGGER IF EXISTS pages_au;

CREATE TRIGGER pages_ai AFTER INSERT ON pages BEGIN
  INSERT INTO pages_fts(rowid, title, body)
    VALUES (new.id, new.title, tela_strip_excalidraw(new.body));
END;

CREATE TRIGGER pages_ad AFTER DELETE ON pages BEGIN
  INSERT INTO pages_fts(pages_fts, rowid, title, body)
    VALUES ('delete', old.id, old.title, tela_strip_excalidraw(old.body));
END;

CREATE TRIGGER pages_au AFTER UPDATE OF title, body ON pages BEGIN
  INSERT INTO pages_fts(pages_fts, rowid, title, body)
    VALUES ('delete', old.id, old.title, tela_strip_excalidraw(old.body));
  INSERT INTO pages_fts(rowid, title, body)
    VALUES (new.id, new.title, tela_strip_excalidraw(new.body));
END;

-- Manual rebuild: wipe the FTS contents (the 'delete-all' command zeroes the
-- shadow tables without dropping the table itself) and reinsert every row
-- with the strip applied. Idempotent — safe to re-run if anyone needs to
-- migrate again.
INSERT INTO pages_fts(pages_fts) VALUES('delete-all');
INSERT INTO pages_fts(rowid, title, body)
  SELECT id, title, tela_strip_excalidraw(body) FROM pages;
