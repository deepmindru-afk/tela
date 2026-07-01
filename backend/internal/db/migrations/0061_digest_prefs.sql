-- 0061_digest_prefs.sql — weekly digest opt-in + last-sent bookkeeping.
-- Opt-in (default off): a user gets the periodic recap only after enabling it.
-- digest_last_sent_at gates the per-user 7-day cadence so the send job is safe
-- to run on any schedule (and across restarts) without double-sending.
ALTER TABLE users ADD COLUMN digest_frequency    TEXT NOT NULL DEFAULT 'off';  -- 'off' | 'weekly'
ALTER TABLE users ADD COLUMN digest_last_sent_at TEXT NOT NULL DEFAULT '';
