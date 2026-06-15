-- Per-admin "feedback inbox last seen" marker, for the unread badge. NULL = never
-- viewed (all feedback counts as unseen). Stamped to tela_now() when an instance
-- admin opens the Feedback tab.
ALTER TABLE users ADD COLUMN feedback_seen_at TEXT;
