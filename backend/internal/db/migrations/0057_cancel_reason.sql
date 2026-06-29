-- Optional cancel reason captured when a subscriber opens the billing portal to
-- cancel. Stored on both tables so orgs and personal accounts are covered.
ALTER TABLE users ADD COLUMN cancel_reason TEXT;
ALTER TABLE orgs  ADD COLUMN cancel_reason TEXT;
