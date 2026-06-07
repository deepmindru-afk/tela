-- 0015_space_files.sql — non-markdown files in the WebDAV sync tree.
--
-- pages.body is canonical markdown forever and there is no block table, so the
-- WebDAV surface (dav_fs.go) used to ACCEPT-AND-DROP every non-.md write: a PDF
-- or image dropped into a mounted vault returned 200 but stored nothing, so it
-- never reached the other machines and silently vanished on the next listing.
-- This table is the blob store that lets such files round-trip — the sync layer
-- only; surfacing them in the app UI is a later, separate phase.
--
-- Identity is LOCATION, not an id: a raw file has no frontmatter to carry one,
-- so (space_id, parent_page_id, name) is the key. parent_page_id mirrors the
-- page tree's parent_id — a file nests under the same page-as-folder the page
-- tree uses (NULL = the space root). Keying by the parent PAGE id (not a path
-- string) means renaming/reparenting that folder-page keeps its files attached
-- instead of orphaning them at a stale path. Markdown (.md/.markdown) is always
-- a page and never lands here, so the two namespaces can't collide.
--
-- Blobs live in Postgres bytea (same content-addressed shape as page_images /
-- page_diagrams), capped per-file by TELA_WEBDAV_FILE_MAX_BYTES (default 50 MiB)
-- — it bloats DB/backups, so this is "carry your attachments", not Dropbox; a
-- filesystem/S3 backing is a later swap. Deletes are soft (deleted_at) so a
-- runaway sync can't destroy data — recoverable, same promise pages get.

CREATE TABLE space_files (
    id             BIGSERIAL PRIMARY KEY,
    space_id       BIGINT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    parent_page_id BIGINT REFERENCES pages(id) ON DELETE CASCADE,
    name           TEXT   NOT NULL,
    content_hash   TEXT   NOT NULL,
    mime           TEXT   NOT NULL,
    data           BYTEA  NOT NULL,
    byte_size      BIGINT NOT NULL,
    created_at     TEXT   NOT NULL DEFAULT tela_now(),
    updated_at     TEXT   NOT NULL DEFAULT tela_now(),
    deleted_at     TEXT
);

-- One live file per (space, parent-folder, name). COALESCE folds the NULL root
-- parent into 0 so the uniqueness also covers space-root files (NULLs are
-- otherwise all distinct). Partial on deleted_at IS NULL so a soft-deleted row
-- doesn't block re-creating a file at the same path.
CREATE UNIQUE INDEX space_files_loc
    ON space_files (space_id, (COALESCE(parent_page_id, 0)), name)
    WHERE deleted_at IS NULL;

-- Listing a directory is "all live files with this parent" — the per-request
-- load (one query per space, like the page tree) filters on space_id.
CREATE INDEX space_files_space ON space_files (space_id) WHERE deleted_at IS NULL;
