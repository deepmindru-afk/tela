-- 0053_billing.sql — self-serve billing state (Polar). Entitlement still flows
-- through plan_key (limits.go reads it); these columns are the billing-side
-- bookkeeping the webhook reconciler maintains and the "Manage subscription"
-- portal needs. Both account kinds (a user's personal account and an org) can
-- hold a subscription, so the columns live on both tables — symmetric with
-- plan_key (migration 0017).
--
-- Reconciliation rule (see internal/api/billing.go): a paid subscription sets
-- plan_key to the mapped tier; `revoked` (period actually ended) downgrades back
-- to the free tier; `canceled` (cancel scheduled at period end) only flips
-- cancel_at_period_end so the UI can say "cancels on <date>" while access holds.

ALTER TABLE users ADD COLUMN polar_customer_id     TEXT;    -- Polar Customer id (stable per account)
ALTER TABLE users ADD COLUMN polar_subscription_id TEXT;    -- current subscription id (NULL once revoked)
ALTER TABLE users ADD COLUMN subscription_status   TEXT NOT NULL DEFAULT 'none'; -- none|active|canceled|past_due
ALTER TABLE users ADD COLUMN subscription_period_end TEXT;  -- current paid-through (UTC 'YYYY-MM-DD HH:MM:SS')
ALTER TABLE users ADD COLUMN subscription_cancel_at_period_end INTEGER NOT NULL DEFAULT 0; -- 1 = cancels at period_end

ALTER TABLE orgs ADD COLUMN polar_customer_id     TEXT;
ALTER TABLE orgs ADD COLUMN polar_subscription_id TEXT;
ALTER TABLE orgs ADD COLUMN subscription_status   TEXT NOT NULL DEFAULT 'none';
ALTER TABLE orgs ADD COLUMN subscription_period_end TEXT;
ALTER TABLE orgs ADD COLUMN subscription_cancel_at_period_end INTEGER NOT NULL DEFAULT 0;

-- Webhook idempotency. Polar redelivers on any non-2xx / slow response and can
-- duplicate or reorder events, so every delivery's standard-webhooks `webhook-id`
-- is recorded here and a second arrival is acknowledged without re-applying.
CREATE TABLE polar_webhook_events (
  event_id    TEXT PRIMARY KEY,           -- the `webhook-id` header (message id)
  event_type  TEXT NOT NULL,              -- the payload `type` (for debugging)
  received_at TEXT NOT NULL DEFAULT tela_now()
);
