-- 0047_user_autowatch.sql — per-user "autowatch" preference. When on (default),
-- you automatically follow a page you create, edit, or comment on (Confluence-
-- style autowatch) so you hear about later changes without an explicit follow.
-- Turn it off to stop auto-subscribing (e.g. an agent/PAT user editing many
-- pages who doesn't want to follow them all). Gates the auto-follow calls in
-- createPageCore / updatePageCore / createCommentCore — not manual follows.
ALTER TABLE users ADD COLUMN autowatch INTEGER NOT NULL DEFAULT 1;
