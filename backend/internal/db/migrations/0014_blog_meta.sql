-- 0014_blog_meta.sql — author/blog identity for the public surfaces.
--
-- Public spaces (0012) render as blog front pages and authors get a /u/{handle}
-- home. Both were bare — just a title and a list of post titles. These two
-- free-text fields give each a human-written tagline so the public pages read as
-- a tailored blog, not a raw index:
--
--   spaces.description — the blog's standfirst, shown under the space name on its
--                        front page. Editor+ editable (it's curation, not a
--                        publish decision like visibility).
--   users.bio          — a one/two-line author bio, shown on /u/{handle}. Self
--                        editable from profile settings.
--
-- Both default to '' (NOT NULL) so every existing row reads cleanly with no
-- backfill. Outbound, read-only content — exposed only through the public read
-- API; carries no access meaning.

ALTER TABLE spaces ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE users  ADD COLUMN bio         TEXT NOT NULL DEFAULT '';
