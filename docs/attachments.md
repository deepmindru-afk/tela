# Attachments

Files attached to a page — uploads from the editor **and** files
[rclone-synced](webdav-sync.md) into the page's folder — backed by the unified
`space_files` blob store (migration `0015`). The same store backs editor image
uploads.

## Model

A page's attachments are the `space_files` whose `parent_page_id` is that page.
A file dropped into `pageX/` over WebDAV is already parented to `pageX`, so
synced files become attachments with **no body edit** and no sync-layer rewrite
of the markdown.

- **Inline** placement lives in the body (markdown): images as `![](url)`,
  other files as a `:::file{name="…" size="…"}\n<url>\n:::` card
  (`milkdown-file.ts`, block id `file`). Authoritative position, syncs as text.
- **The Attachments strip** (below the title, reader + editor) is a sidecar
  rendered from SQL — it lists *all* files on the page. A chip carries an
  "embedded" marker when the body already references that file's hash (computed
  by scanning the body, stateless). In the editor a chip can be deleted.

## API

- `GET  /api/pages/{id}/attachments` — session-authed; lists the page's files
  with `{id, name, mime, byte_size, hash, url, embedded}`.
- `POST /api/pages/{id}/attachments` — editor+; multipart `file`. Dedupes
  identical bytes; disambiguates a name collision with a `-<hash8>` suffix so a
  distinct upload never clobbers an existing one (e.g. two pasted `image.png`).
- `DELETE /api/pages/{id}/attachments/{file_id}` — editor+; soft-delete.
- `GET /api/files/{space_id}/{hash}.{ext}` — **public**, content-addressed,
  immutable cache. Keyed by hash (not path) so a body embed survives a sync
  rename. Raster images (png/jpeg/gif/webp) serve **inline**; everything else is
  forced to download (`Content-Disposition: attachment` + `nosniff`) so embedded
  HTML/SVG can't execute as stored-XSS from our origin.

## Notes

- **Serve identity is a capability hash.** Like `/api/images/`, anyone with the
  URL can fetch the bytes regardless of space privacy. Fine for most wikis; if
  strict private-space enforcement is needed, gate the serve route on visibility
  (costs the immutable-cache win).
- **Storage** is Postgres `bytea`, capped per file by `TELA_WEBDAV_FILE_MAX_BYTES`
  (default 50 MiB). It bloats DB/backups; the serve-route abstraction lets blobs
  move to filesystem/S3 later without changing URLs.
- **Legacy image/diagram serve** (`/api/images/`, `/api/diagrams/`) stays for
  existing page bodies; new uploads use `/api/files/`. Retiring the old tables
  is a later cleanup.
- **Conflicts** on a file are last-write-wins (see [webdav-sync.md](webdav-sync.md));
  no per-file history.
