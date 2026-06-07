-- 0005_page_props.sql — page properties (frontmatter) as a queryable JSONB bag.
--
-- Until now imported frontmatter was discarded: mdimport.StripFrontmatter pulled
-- a single `title:` out and dropped everything else. This column is the single
-- home for page metadata — the content half of "page properties". System fields
-- (title/created_at/updated_at/slug/id/link) stay column- or derivation-owned and
-- are NOT stored here; only the free-form tail lands in props. See
-- docs/page-properties.md for the reserved-key policy and ser/deser contract.
--
-- JSONB (not embedded YAML in body, not EAV): clean YAML<->JSONB ser/deser via
-- yaml.v3, and idiomatic containment queries (props @> '{"status":"draft"}',
-- props->'tags' ? 'x') backed by a single GIN index. jsonb_path_ops is the
-- smaller/faster operator class for the @>/? containment lookups we do.

ALTER TABLE pages
  ADD COLUMN props JSONB NOT NULL DEFAULT '{}';

CREATE INDEX idx_pages_props ON pages USING GIN (props jsonb_path_ops);

-- Revisions capture props so a snapshot records the full page state (body +
-- title + props). Captured whenever a snapshot is taken; a props-only edit does
-- not itself force a new revision (see docs/page-properties.md "Versioning").
ALTER TABLE page_revisions
  ADD COLUMN props JSONB NOT NULL DEFAULT '{}';
